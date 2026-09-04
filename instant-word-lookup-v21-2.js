'use strict';
/* APS V21.2 — Instant Word Lookup + My Vocabs capture
   Additive UI layer. No dialogue/scoring/Firebase schema changes. */
(function(){
const VERSION='APS V21.2 Instant Word Lookup';
if(typeof state==='undefined'||typeof render!=='function')return;

let requestToken=0;
let popup=null;
let candidateCache=new Map();
let lookupInterruptedListening=false;

// If a learner opens lookup while source TTS is still playing, cancel the
// listening phase without allowing the old async playback flow to chime and
// start microphone recording behind the lookup popup.
if(typeof chime==='function'&&typeof ensureMicrophone==='function'){
  const baseChimeV212=chime,baseEnsureMicrophoneV212=ensureMicrophone;
  chime=function v212LookupAwareChime(){if(lookupInterruptedListening)return Promise.resolve();return baseChimeV212.apply(this,arguments);};
  ensureMicrophone=async function v212LookupAwareMicrophone(){if(lookupInterruptedListening){lookupInterruptedListening=false;return false;}return baseEnsureMicrophoneV212.apply(this,arguments);};
}

const norm=value=>typeof normaliseSearchText==='function'?normaliseSearchText(value):String(value||'').toLowerCase().trim();
const activeLang=()=>typeof activeLanguageId==='function'?activeLanguageId():(state.selectedLanguage||'hi');
const activeName=()=>typeof targetLanguageName==='function'?targetLanguageName():(state.languagePack?.name||activeLang().toUpperCase());
const html=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const wordRegex=/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*|\p{N}+(?:[.,:]\p{N}+)*|[^\p{L}\p{M}\p{N}]+/gu;
const wordOnly=/[\p{L}\p{M}]/u;

function wordUnits(text){
  return (String(text||'').match(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*|\p{N}+(?:[.,:]\p{N}+)*/gu)||[]).map(x=>norm(x)).filter(Boolean);
}
function meaningVariants(value){
  const raw=String(value||'').trim();if(!raw)return [];
  const values=[raw,...raw.split(/[\/|;·]+/g),...raw.split(/\s*,\s*/g)];
  const seen=new Set(),out=[];
  for(const value of values){const t=String(value||'').trim(),k=norm(t);if(t&&k&&!seen.has(k)){seen.add(k);out.push(t);}}
  return out;
}
function closePopup(){
  requestToken++;
  if(popup){popup.remove();popup=null;}
  document.querySelectorAll('.aps-lookup-word.is-active').forEach(x=>x.classList.remove('is-active'));
}
function currentSegment(){
  try{const segments=typeof getActiveSegments==='function'?getActiveSegments():(state.dialogue?.segments||[]);return segments?.[state.segmentIndex]||null;}catch{return null;}
}
function pauseListeningForLookup(){
  if(state.overlay!=='dialogue'||state.playerStatus!=='playing')return;
  lookupInterruptedListening=true;state.playerStatus='ready';
  try{window.speechSynthesis?.cancel?.();}catch{}
  const play=document.querySelector('[data-action="play-dialogue-segment"]');if(play){play.disabled=false;play.innerHTML='▶ <span>Play</span>';play.title='Play source';}
  const repeat=document.querySelector('[data-action="repeat-dialogue-segment"]');if(repeat)repeat.disabled=false;
  const icon=document.querySelector('.dialogue-screen .source-icon');if(icon)icon.textContent='▶';
}

function currentSourceMeta(){
  const seg=currentSegment(),d=state.dialogue;
  return {type:'dialogue',dialogueId:d?.id||'',title:d?.title||d?.id||'',library:String(d?.id||'').startsWith('original-')?'original':'verified',segmentId:seg?.id||'',addedAt:new Date().toISOString()};
}
function trustedEntries(dialogueId=''){
  try{return window.APSMyVocabsAPI?.trustedEntries?.(dialogueId)||[];}catch{return [];}
}
function phraseCandidates(sourceLanguage,dialogueId=''){
  const code=String(sourceLanguage||'en').toLowerCase().split(/[-_]/)[0];
  const key=`${activeLang()}|${dialogueId}|${code}`;
  if(candidateCache.has(key))return candidateCache.get(key);
  const list=[];let priority=0;
  for(const entry of trustedEntries(dialogueId)){
    const lookupSource=entry.lookupSource||'';
    const terms=code==='en'?[entry.english]:[entry.hindi,...(Array.isArray(entry.acceptedHindi)?entry.acceptedHindi:[])].flatMap(meaningVariants);
    for(const term of terms){
      const tokens=wordUnits(term);
      // Multi-word phrase resolution only. Individual words go through the normal lookup path.
      if(tokens.length<2||tokens.length>5)continue;
      list.push({term:String(term||'').trim(),tokens,entry,lookupSource,priority:priority++});
    }
  }
  list.sort((a,b)=>b.tokens.length-a.tokens.length||a.priority-b.priority);
  candidateCache.set(key,list);
  return list;
}
function resolvePhraseFromWords(words,ordinal,sourceLanguage,dialogueId='',fallback=''){
  for(const candidate of phraseCandidates(sourceLanguage,dialogueId)){
    const n=candidate.tokens.length;
    for(let start=0;start<=words.length-n;start++){
      if(ordinal<start||ordinal>=start+n)continue;
      let same=true;for(let j=0;j<n;j++){if(words[start+j]!==candidate.tokens[j]){same=false;break;}}
      if(same)return candidate.term;
    }
  }
  return fallback;
}
function resolvedTermFor(span){
  const host=span.closest('[data-aps-lookup-text]');if(!host)return span.textContent.trim();
  const info=host.__apsLookupInfo;if(!info)return span.textContent.trim();
  const ordinal=Number(span.dataset.lookupOrdinal);if(!Number.isInteger(ordinal))return span.textContent.trim();
  return resolvePhraseFromWords(info.words,ordinal,info.sourceLanguage,info.dialogueId,span.textContent.trim());
}
function wordify(el,sourceLanguage,{dialogueId='',kind='text'}={}){
  if(!el||el.dataset.apsLookupText==='1')return;
  const text=String(el.textContent||'');if(!text.trim())return;
  const parts=text.match(wordRegex)||[text];
  const words=[];let ordinal=0;
  const frag=document.createDocumentFragment();
  for(const part of parts){
    if(wordOnly.test(part)){
      const span=document.createElement('span');span.className='aps-lookup-word';span.textContent=part;span.tabIndex=0;span.setAttribute('role','button');span.setAttribute('aria-label',`${part}. Check meaning`);span.title='Click to check meaning';span.dataset.lookupOrdinal=String(ordinal++);frag.appendChild(span);words.push(norm(part));
    }else frag.appendChild(document.createTextNode(part));
  }
  el.textContent='';el.appendChild(frag);el.dataset.apsLookupText='1';el.classList.add('aps-lookup-text');
  el.__apsLookupInfo={text,sourceLanguage,dialogueId,kind,words};
}
function enhanceDialogue(){
  const screen=document.querySelector('.dialogue-screen');if(!screen||state.dialogueMode==='mock')return;
  const seg=currentSegment();if(!seg)return;const dialogueId=state.dialogue?.id||'';
  if(state.dialogueSettings?.showSourceTranscript){wordify(screen.querySelector('.source-card > p'),seg.sourceLanguage,{dialogueId,kind:'source'});}
  const targetCode=seg.sourceLanguage==='en'?activeLang():'en';
  screen.querySelectorAll('.v201-sample-card > p').forEach(p=>wordify(p,targetCode,{dialogueId,kind:'sample'}));
  screen.querySelectorAll('.v20-sample > p').forEach(p=>wordify(p,targetCode,{dialogueId,kind:'sample'}));
  // Compatibility with the older comparison layout if it is ever rendered.
  screen.querySelectorAll('.sample-answer-box').forEach(card=>{if(/SAMPLE INTERPRETATION/i.test(card.querySelector('small')?.textContent||''))wordify(card.querySelector('p'),targetCode,{dialogueId,kind:'sample'});});
}
function enhanceReport(){
  const report=document.querySelector('.report-screen');if(!report||state.report?.type==='mock')return;
  const d=state.dialogues?.find?.(x=>x.id===state.report?.attempt?.dialogueId)||state.dialogue;if(!d)return;
  report.querySelectorAll('.segment-report details.segment-result').forEach((detail,i)=>{
    const seg=d.segments?.[i];if(!seg)return;const cols=detail.querySelectorAll('.segment-detail > div');
    if(cols[0])wordify(cols[0].querySelector('p'),seg.sourceLanguage,{dialogueId:d.id,kind:'source'});
    // Some legacy report layouts include the sample interpretation in column 3.
    if(cols[2]&&/sample interpretation/i.test(cols[2].querySelector('h4')?.textContent||''))wordify(cols[2].querySelector('p'),seg.sourceLanguage==='en'?activeLang():'en',{dialogueId:d.id,kind:'sample'});
  });
}
function enhance(){enhanceDialogue();enhanceReport();}

function popupPosition(anchor,box){
  const r=anchor.getBoundingClientRect();
  if(window.matchMedia('(max-width: 640px)').matches){box.style.left='12px';box.style.right='12px';box.style.bottom='12px';box.style.top='auto';return;}
  const width=Math.min(380,window.innerWidth-24),left=Math.max(12,Math.min(r.left,window.innerWidth-width-12));
  box.style.width=`${width}px`;box.style.left=`${left}px`;box.style.right='auto';box.style.bottom='auto';
  const wanted=r.bottom+8;box.style.top=`${Math.min(wanted,window.innerHeight-280)}px`;
}
function lookupShell(anchor,term,sourceLanguage){
  closePopup();anchor.classList.add('is-active');
  const box=document.createElement('aside');box.className='aps-word-lookup-popup is-loading';box.setAttribute('role','dialog');box.setAttribute('aria-live','polite');
  box.innerHTML=`<button type="button" class="aps-lookup-close" data-lookup-action="close" aria-label="Close">×</button><small>INSTANT WORD LOOKUP</small><h3>${html(term)}</h3><div class="aps-lookup-loading"><i></i><span>Checking reviewed APS vocabulary…</span></div>`;
  document.body.appendChild(box);popup=box;popupPosition(anchor,box);return box;
}
function renderLookupResult(box,result,sourceLanguage,term){
  if(!box?.isConnected)return;const sourceCode=String(sourceLanguage||'en').toLowerCase().split(/[-_]/)[0];
  const meaningLabel=sourceCode==='en'?`${activeName()} meaning`:'English meaning';
  const exact=window.APSMyVocabsAPI?.findExact?.(result.english,result.hindi);
  box.classList.remove('is-loading');
  box.dataset.lookupEnglish=result.english||'';box.dataset.lookupHindi=result.hindi||'';box.dataset.lookupTerm=term;box.dataset.lookupSourceLanguage=sourceLanguage;box.dataset.lookupSavedId=exact?.id||'';
  box.innerHTML=`<button type="button" class="aps-lookup-close" data-lookup-action="close" aria-label="Close">×</button>
    <div class="aps-lookup-head"><div><small>INSTANT WORD LOOKUP</small><h3>${html(term)}</h3></div><button type="button" class="aps-lookup-speak" data-lookup-action="speak" aria-label="Play word" title="Play word">🔊</button></div>
    <div class="aps-lookup-meaning"><span>${html(meaningLabel)}</span><strong>${result.found?html(result.meaning):'Meaning unavailable right now'}</strong></div>
    <div class="aps-lookup-meta"><span>${html(result.lookupSource||'APS')}</span>${result.online?'<em>Online</em>':'<em>Local</em>'}</div>
    ${result.exampleEnglish&&sourceCode==='en'?`<p class="aps-lookup-example">${html(result.exampleEnglish)}</p>`:''}
    <div class="aps-lookup-actions">
      ${result.found?`<button type="button" class="primary" data-lookup-action="add" ${exact?'disabled':''}>${exact?'✓ In My Vocabs':'+ Add to My Vocabs'}</button>`:''}
      ${exact?`<button type="button" class="secondary" data-lookup-action="open-existing">Open</button>`:''}
    </div>`;
  popupPosition(document.querySelector('.aps-lookup-word.is-active')||box,box);
}
async function openLookup(anchor){
  if(state.dialogueMode==='mock')return;
  if(state.recording){if(typeof showToast==='function')showToast('Finish or skip the recording before checking a word');return;}
  const host=anchor.closest('[data-aps-lookup-text]'),info=host?.__apsLookupInfo;if(!info)return;
  const term=resolvedTermFor(anchor);if(!term)return;
  pauseListeningForLookup();
  try{window.speechSynthesis?.cancel?.();}catch{}
  const box=lookupShell(anchor,term,info.sourceLanguage),token=++requestToken;
  const api=window.APSMyVocabsAPI;if(!api){box.querySelector('.aps-lookup-loading span').textContent='My Vocabs is still loading. Try again in a moment.';return;}
  try{
    const result=await api.lookup(term,{sourceLanguage:info.sourceLanguage,dialogueId:info.dialogueId});
    if(token!==requestToken||box!==popup)return;box.__apsLookupResult=result;box.__apsLookupInfo=info;renderLookupResult(box,result,info.sourceLanguage,term);
  }catch(error){if(token!==requestToken||box!==popup)return;box.classList.remove('is-loading');box.querySelector('.aps-lookup-loading')?.replaceWith(Object.assign(document.createElement('p'),{textContent:'Meaning could not be loaded. Check your connection and try again.'}));}
}
async function lookupAction(button){
  const action=button.dataset.lookupAction,box=button.closest('.aps-word-lookup-popup');
  if(action==='close'){closePopup();return;}
  if(!box)return;const result=box.__apsLookupResult,info=box.__apsLookupInfo;
  if(action==='speak'){
    const sourceCode=String(info?.sourceLanguage||'en').toLowerCase().split(/[-_]/)[0];
    try{window.speechSynthesis?.cancel?.();if(typeof speak==='function')await speak(box.dataset.lookupTerm||result?.term||'',sourceCode==='en'?'en':activeLang(),.85,null,'general');}catch{}return;
  }
  if(action==='open-existing'){
    const id=box.dataset.lookupSavedId;if(id){closePopup();window.APSMyVocabsAPI?.openExisting?.(id);}return;
  }
  if(action==='add'&&result?.found){
    button.disabled=true;button.textContent='Adding…';
    const outcome=await window.APSMyVocabsAPI.add({...result,source:currentSourceMeta(),lookupSource:`Instant Word Lookup · ${result.lookupSource||'APS'}`});
    if(outcome?.openExisting&&outcome.record?.id){closePopup();window.APSMyVocabsAPI.openExisting(outcome.record.id);return;}
    if(outcome?.status==='cancelled'){button.disabled=false;button.textContent='+ Add to My Vocabs';return;}
    if(outcome?.record?.id){box.dataset.lookupSavedId=outcome.record.id;button.textContent='✓ In My Vocabs';button.disabled=true;const actions=box.querySelector('.aps-lookup-actions');if(actions&&!actions.querySelector('[data-lookup-action="open-existing"]'))actions.insertAdjacentHTML('beforeend','<button type="button" class="secondary" data-lookup-action="open-existing">Open</button>');if(typeof showToast==='function')showToast(outcome.status==='added-separate'?'Added as a separate meaning':'Added to My Vocabs');}
  }
}

document.addEventListener('click',event=>{
  const action=event.target.closest('[data-lookup-action]');if(action){event.preventDefault();event.stopPropagation();void lookupAction(action);return;}
  const word=event.target.closest('.aps-lookup-word');if(word){event.preventDefault();event.stopPropagation();void openLookup(word);return;}
  if(popup&&!event.target.closest('.aps-word-lookup-popup'))closePopup();
},true);
document.addEventListener('keydown',event=>{
  const word=event.target.closest?.('.aps-lookup-word');if(word&&(event.key==='Enter'||event.key===' ')){event.preventDefault();void openLookup(word);return;}
  if(event.key==='Escape'&&popup)closePopup();
},true);
window.addEventListener('resize',()=>{if(popup){const active=document.querySelector('.aps-lookup-word.is-active');if(active)popupPosition(active,popup);}});
window.addEventListener('aps-language-changed',()=>{candidateCache.clear();closePopup();});

const baseRenderV212=render;
render=function v212InstantLookupRender(){closePopup();const result=baseRenderV212.apply(this,arguments);requestAnimationFrame(enhance);return result;};
requestAnimationFrame(enhance);
window.APSInstantWordLookup={version:'21.2',enhance,close:closePopup,resolvePhraseFromWords,wordUnits,pauseListeningForLookup};
console.info(`${VERSION} loaded · reviewed local lookup first · online fallback · My Vocabs capture · Mock Test disabled.`);
})();
