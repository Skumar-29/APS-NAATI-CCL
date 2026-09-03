(function(){
'use strict';
const VM_VERSION='V21.0.1 Voice Manager';
const CLOUD_PREFIX='cloud:';
const CLIENT_CACHE='aps-naati-tts-v21-1';
let currentCloudAudio=null,currentCloudUrl='';
let lastMissingToastAt=0;

function codeOf(lang){return String(lang||'en').toLowerCase().split(/[-_]/)[0]||'en';}
function infoFor(lang){try{return typeof languageInfo==='function'?languageInfo(codeOf(lang)):{id:codeOf(lang)};}catch{return {id:codeOf(lang)};}}
function localeFor(lang){const code=codeOf(lang);const info=infoFor(code);return code==='en'?'en-GB':(info.targetLocale||info.locale||code);}
function targetProfile(lang){const info=infoFor(lang);return info.voiceProfile||{};}
function cloudConfig(lang){const cfg=targetProfile(lang).cloudFallback;return cfg&&cfg.enabled!==false&&cfg.endpoint?cfg:null;}
function browserVoices(){try{return typeof speechVoices==='function'?speechVoices():('speechSynthesis'in window?speechSynthesis.getVoices():[]);}catch{return [];}}
function languageVoices(lang){const prefix=codeOf(lang);return browserVoices().filter(v=>String(v.lang||'').toLowerCase().replace('_','-').startsWith(prefix));}
function exactVoice(names,voices){for(const wanted of names||[]){const low=String(wanted||'').toLowerCase();const exact=voices.find(v=>String(v.name||'').toLowerCase()===low);if(exact)return exact;}return null;}
function preferredNames(lang){const code=codeOf(lang);if(code==='en')return ['Google UK English Female','Google UK English','Google English'];return targetProfile(code).preferredLocalNames||[];}
function preferredBrowserVoice(lang){const voices=languageVoices(lang);if(!voices.length)return null;return exactVoice(preferredNames(lang),voices)||voices.find(v=>/^google\b/i.test(String(v.name||'')))||voices.find(v=>v.localService)||voices[0]||null;}
function cloudValue(cfg){return cfg?.voiceName?`${CLOUD_PREFIX}${cfg.voiceName}`:'';}
function isCloudSelection(value){return String(value||'').startsWith(CLOUD_PREFIX);}
function cloudVoiceName(value,cfg){return isCloudSelection(value)?String(value).slice(CLOUD_PREFIX.length):(cfg?.voiceName||'');}
function effectiveSelection(lang,speaker='general'){
  try{return typeof selectedVoiceName==='function'?selectedVoiceName(lang,speaker):'';}catch{return '';}
}
function automaticLabel(lang){const v=preferredBrowserVoice(lang);if(v)return v.name;const cfg=cloudConfig(lang);if(cfg)return `${cfg.label||cfg.voiceName||'Online voice'} (online fallback)`;return 'No matching voice';}

// Prefer the requested Google voices when the user has not made a manual choice.
const baseGetVoice=typeof getVoice==='function'?getVoice:null;
getVoice=function v21GetVoice(lang,name){
  const code=codeOf(lang),voices=languageVoices(code);
  if(isCloudSelection(name))return null;
  if(name){const selected=voices.find(v=>v.name===name)||browserVoices().find(v=>v.name===name);if(selected)return selected;}
  const preferred=preferredBrowserVoice(code);if(preferred)return preferred;
  return baseGetVoice?baseGetVoice(lang,name):null;
};

const baseVoiceOptions=typeof voiceOptions==='function'?voiceOptions:null;
voiceOptions=function v21VoiceOptions(lang,selected){
  let html=baseVoiceOptions?baseVoiceOptions(lang,selected):'';
  const cfg=cloudConfig(lang),value=cloudValue(cfg);
  if(cfg&&value){html+=`<option value="${esc(value)}" ${selected===value?'selected':''}>☁ ${esc(cfg.label||`${targetLanguageName(codeOf(lang))} online voice`)} · ${esc(cfg.voiceName||'Google Cloud')}</option>`;}
  return html;
};

function cancelCloudAudio(){
  const a=currentCloudAudio;currentCloudAudio=null;
  if(a){try{a.pause();a.currentTime=0;a.removeAttribute('src');a.load();}catch{}}
  if(currentCloudUrl){try{URL.revokeObjectURL(currentCloudUrl);}catch{}currentCloudUrl='';}
}
window.apsCancelVoicePlayback=cancelCloudAudio;
if('speechSynthesis'in window){
  try{const nativeCancel=speechSynthesis.cancel.bind(speechSynthesis);speechSynthesis.cancel=function(){cancelCloudAudio();return nativeCancel();};}catch{}
}
if(typeof stopAllSpeech==='function'){
  const baseStopAllSpeech=stopAllSpeech;
  stopAllSpeech=function v21StopAllSpeech(){cancelCloudAudio();return baseStopAllSpeech();};
}

async function authToken(){
  try{if(typeof getFirebaseIdToken==='function')return await getFirebaseIdToken();}catch{}
  try{const u=window.firebase?.auth?.()?.currentUser;if(u?.getIdToken)return await u.getIdToken();}catch{}
  return '';
}
async function digestText(value){
  const raw=String(value||'');
  try{const bytes=new TextEncoder().encode(raw),hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}catch{let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
}
async function cacheRequestFor(text,locale,voiceName){const hash=await digestText(`${locale}|${voiceName}|${String(text||'').trim()}`);return new Request(`${location.origin}/__aps_voice_cache__/${hash}.mp3`);}
async function cachedCloudBlob(text,locale,voiceName){if(!('caches'in window))return null;try{const cache=await caches.open(CLIENT_CACHE),req=await cacheRequestFor(text,locale,voiceName),res=await cache.match(req);return res?await res.blob():null;}catch{return null;}}
async function putCloudBlob(text,locale,voiceName,blob){if(!('caches'in window))return;try{const cache=await caches.open(CLIENT_CACHE),req=await cacheRequestFor(text,locale,voiceName);await cache.put(req,new Response(blob,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'public,max-age=31536000,immutable'}}));}catch{}}
async function fetchCloudBlob(text,lang,voiceName,cfg){
  const locale=cfg.languageCode||localeFor(lang);let blob=await cachedCloudBlob(text,locale,voiceName);if(blob)return {blob,cached:true};
  if(!navigator.onLine)throw new Error('Internet is required the first time this voice is used.');
  const token=await authToken();if(!token)throw new Error('Sign in is required to use the online voice.');
  const response=await fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({text:String(text||''),languageCode:locale,voiceName,audioEncoding:'MP3'})});
  if(!response.ok){let message='Online voice is unavailable.';try{const j=await response.json();message=j?.message||j?.error||message;}catch{}throw new Error(message);}
  blob=await response.blob();if(!blob.size)throw new Error('Online voice returned empty audio.');await putCloudBlob(text,locale,voiceName,blob);return {blob,cached:false};
}
function playCloudBlob(blob,rate=1,token=null){return new Promise(resolve=>{
  cancelCloudAudio();
  if(token!==null&&typeof vocabTokenActive==='function'&&!vocabTokenActive(token))return resolve({ok:false,reason:'cancelled'});
  const url=URL.createObjectURL(blob),audio=new Audio(url);currentCloudAudio=audio;currentCloudUrl=url;audio.preload='auto';audio.playbackRate=Math.max(.5,Math.min(1.6,Number(rate)||1));
  try{audio.preservesPitch=true;}catch{}
  let settled=false;const finish=(result)=>{if(settled)return;settled=true;if(currentCloudAudio===audio)currentCloudAudio=null;if(currentCloudUrl===url){try{URL.revokeObjectURL(url);}catch{}currentCloudUrl='';}resolve(result);};
  audio.onended=()=>finish({ok:true,reason:'cloud-ended'});audio.onerror=()=>finish({ok:false,reason:'cloud-audio-error'});
  audio.play().catch(()=>finish({ok:false,reason:'cloud-play-blocked'}));
});}
async function speakCloud(text,lang,rate,token,speaker,selected){
  const cfg=cloudConfig(lang);if(!cfg)return {ok:false,reason:'cloud-not-configured'};
  const voiceName=cloudVoiceName(selected,cfg);try{const {blob}=await fetchCloudBlob(text,lang,voiceName,cfg);if(token!==null&&typeof vocabTokenActive==='function'&&!vocabTokenActive(token))return {ok:false,reason:'cancelled'};return await playCloudBlob(blob,rate,token);}catch(error){console.warn(VM_VERSION,error);showToast?.(error?.message||`${targetLanguageName(codeOf(lang))} online voice could not play.`);return {ok:false,reason:'cloud-error'};}
}

const baseSpeak=typeof speak==='function'?speak:null;
speak=async function v21Speak(text,lang='en',rate=.9,token=null,speaker='general'){
  const content=String(text||'').trim();if(!content)return {ok:true,reason:'empty'};
  const code=codeOf(lang),selected=effectiveSelection(code,speaker),local=getVoice(code,selected),cfg=cloudConfig(code);
  if(isCloudSelection(selected))return speakCloud(content,code,rate,token,speaker,selected);
  if(local&&baseSpeak)return baseSpeak(content,code,rate,token,speaker);
  if(cfg)return speakCloud(content,code,rate,token,speaker,selected);
  if(code!=='en'){
    const now=Date.now();if(now-lastMissingToastAt>2500){lastMissingToastAt=now;showToast?.(`${targetLanguageName(code)} voice is not available. Open Settings → Audio → Voice diagnostics.`);}
    return {ok:false,reason:'missing-language-voice'};
  }
  return baseSpeak?baseSpeak(content,code,rate,token,speaker):{ok:false,reason:'speech-unavailable'};
};

function browserName(){const ua=navigator.userAgent||'';if(/Edg\//.test(ua))return 'Microsoft Edge';if(/Chrome\//.test(ua)&&!/Chromium/.test(ua))return 'Google Chrome';if(/Safari\//.test(ua)&&!/Chrome\//.test(ua))return 'Safari';if(/Firefox\//.test(ua))return 'Firefox';return 'This browser';}
function platformName(){const ua=navigator.userAgent||'',p=navigator.userAgentData?.platform||navigator.platform||'';if(/Mac|Macintosh/i.test(`${p} ${ua}`))return 'macOS';if(/CrOS/i.test(ua))return 'ChromeOS';if(/Windows/i.test(`${p} ${ua}`))return 'Windows';if(/Android/i.test(ua))return 'Android';if(/iPhone|iPad|iPod/i.test(ua))return 'iPhone/iPad';return p||'this device';}
function diagnostic(lang,label){const voices=languageVoices(lang),preferred=preferredBrowserVoice(lang),cfg=cloudConfig(lang);return {lang:codeOf(lang),label,count:voices.length,preferred,cfg};}
function diagRow(d){const ok=Boolean(d.preferred),status=ok?'available':d.cfg?'online':'missing',icon=ok?'✓':d.cfg?'☁':'!';const detail=ok?`${d.preferred.name} (${d.preferred.lang})`:d.cfg?`No browser/device voice · ${d.cfg.label||'online fallback available'}`:'No matching browser/device voice';return `<div class="aps-voice-diag-row ${status}"><span class="aps-voice-diag-icon">${icon}</span><div><b>${esc(d.label)}</b><small>${esc(detail)}</small></div><em>${d.count} detected</em></div>`;}
function diagnosticsCard(){const en=diagnostic('en','English'),target=diagnostic(activeLanguageId(),targetLanguageName());return `<section id="apsVoiceDiagnosticsCard" class="voice-settings-section aps-voice-diagnostics"><small>AUDIO</small><h3>Voice diagnostics</h3><p>${esc(browserName())} on ${esc(platformName())}. Automatic voices prefer the best matching Google/device voice and use online fallback only when needed.</p>${diagRow(en)}${diagRow(target)}<div class="aps-voice-diag-actions"><button class="secondary" data-action="voice-check-again">↻ Check again</button>${!target.preferred?'<button class="secondary" data-action="voice-setup-target">Set up voice</button>':''}<button class="secondary" data-action="voice-open-diagnostics">Details</button></div></section>`;}
function detailedDiagnosticsModal(){const all=browserVoices(),en=diagnostic('en','English'),target=diagnostic(activeLanguageId(),targetLanguageName());const rows=all.map(v=>`<tr><td>${esc(v.name)}</td><td>${esc(v.lang||'')}</td><td>${v.localService?'Device':'Browser/online'}</td></tr>`).join('');return `<div class="modal-backdrop"><div class="modal settings-modal aps-voice-modal"><button class="modal-close" data-action="close-modal">×</button><small>VOICE DIAGNOSTICS</small><h2>${esc(browserName())} · ${esc(platformName())}</h2>${diagRow(en)}${diagRow(target)}<p><b>Automatic English:</b> ${esc(automaticLabel('en'))}<br><b>Automatic ${esc(targetLanguageName())}:</b> ${esc(automaticLabel(activeLanguageId()))}</p><div class="aps-voice-table-wrap"><table class="aps-voice-table"><thead><tr><th>Voice</th><th>Locale</th><th>Source</th></tr></thead><tbody>${rows||'<tr><td colspan="3">No browser voices were reported.</td></tr>'}</tbody></table></div><div class="actions"><button class="secondary" data-action="voice-check-again">↻ Check again</button>${!target.preferred?'<button class="secondary" data-action="voice-setup-target">Set up target voice</button>':''}<button class="primary" data-action="close-modal">Done</button></div></div></div>`;}
function setupHelp(){const target=targetLanguageName(),platform=platformName(),cfg=cloudConfig(activeLanguageId());let steps='',link='';
  if(platform==='macOS'){steps='<ol><li>Open System Settings.</li><li>Go to Accessibility → Read & Speak.</li><li>Open the system voice menu and choose Manage Voices.</li><li>Look for the target language and download a voice if Apple offers one.</li><li>Return to APS and click Check again.</li></ol>';link='https://support.apple.com/en-au/guide/mac-help/mh27448/mac';}
  else if(platform==='ChromeOS'){steps='<ol><li>Open Chromebook Settings.</li><li>Open Accessibility → Text-to-Speech.</li><li>Open Text-to-Speech voice settings and install a matching voice if offered.</li><li>Return to APS and click Check again.</li></ol>';link='https://support.google.com/chromebook/answer/11221616?hl=en';}
  else if(platform==='Windows'){steps='<ol><li>Open Windows Settings.</li><li>Go to Time & language → Speech.</li><li>Use Manage voices / Add voices and look for the target language.</li><li>Restart or refresh Chrome, then click Check again.</li></ol>';}
  else if(platform==='Android'){steps='<ol><li>Open Android Settings.</li><li>Search for Text-to-speech output.</li><li>Open the installed speech engine settings and download the target language if available.</li><li>Return to APS and click Check again.</li></ol>';}
  else if(platform==='iPhone/iPad'){steps='<ol><li>Open Settings → Accessibility → Spoken Content.</li><li>Open Voices and look for the target language.</li><li>Download an available voice, return to APS and click Check again.</li></ol>';}
  else steps='<ol><li>Open your device speech/accessibility settings.</li><li>Install a matching target-language voice if available.</li><li>Return to APS and click Check again.</li></ol>';
  const cloud=cfg?`<div class="aps-online-voice-box"><b>Online fallback is available</b><p>If your device does not provide ${esc(target)}, APS can use ${esc(cfg.label||'the configured online voice')} and cache the generated audio for reuse.</p><button class="primary" data-action="voice-use-online">Use online ${esc(target)} voice</button></div>`:'';
  return `<div class="modal-backdrop"><div class="modal settings-modal aps-voice-modal"><button class="modal-close" data-action="close-modal">×</button><small>SET UP VOICE</small><h2>Add a ${esc(target)} voice</h2><p>A website cannot install a system voice itself. APS can guide you to the correct device setting and then re-check what ${esc(browserName())} exposes.</p>${steps}${link?`<button class="secondary wide" data-action="voice-open-help-link" data-url="${esc(link)}">Open official setup help ↗</button>`:''}${cloud}<div class="actions"><button class="secondary" data-action="voice-check-again">↻ Check again</button><button class="primary" data-action="close-modal">Done</button></div></div></div>`;}

if(typeof renderModal==='function'){
  const baseRenderModal=renderModal;
  renderModal=function v21VoiceRenderModal(){
    if(state.modal?.type==='voice-diagnostics')return detailedDiagnosticsModal();
    if(state.modal?.type==='voice-setup')return setupHelp();
    let html=baseRenderModal();
    if(state.modal?.type==='app-settings'&&html){html=html.replace('<div class="voice-settings-help">',diagnosticsCard()+'<div class="voice-settings-help">');}
    return html;
  };
}

app.addEventListener('click',async event=>{
  const el=event.target.closest?.('[data-action]');if(!el)return;const a=el.dataset.action;
  if(a==='voice-open-diagnostics'){event.preventDefault();state.modal={type:'voice-diagnostics'};render();return;}
  if(a==='voice-setup-target'){event.preventDefault();state.modal={type:'voice-setup'};render();return;}
  if(a==='voice-check-again'){event.preventDefault();await refreshVoiceCatalog?.();render();showToast?.('Voice list checked again');return;}
  if(a==='voice-open-help-link'){event.preventDefault();const url=el.dataset.url;if(url)window.open(url,'_blank','noopener,noreferrer');return;}
  if(a==='voice-use-online'){
    event.preventDefault();const cfg=cloudConfig(activeLanguageId());if(!cfg)return showToast?.('No online voice is configured for this language yet.');
    state.vocabSettings.voiceHi=cloudValue(cfg);saveVocabSettings?.();state.modal={type:'app-settings'};render();showToast?.(`Online ${targetLanguageName()} voice selected`);return;
  }
});

// Re-render Settings once delayed Chrome voices become available.
try{window.speechSynthesis?.addEventListener?.('voiceschanged',()=>{if(['app-settings','vocab-settings','voice-diagnostics','voice-setup'].includes(state.modal?.type))render();});}catch{}
console.info(`${VM_VERSION} loaded · preferred Google/device voices · diagnostics/setup · secure cached online fallback.`);
})();
