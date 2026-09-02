(function(){
'use strict';

const VERSION='APS Online V20';
const CACHE_KEY='apsV20AssessmentCacheV1';
const ONLINE_CONFIG=Object.freeze({
  region:'australia-southeast1',
  assessEndpoint:'https://australia-southeast1-aps-naati-ccl-practice.cloudfunctions.net/assessAttempt',
  timeoutMs:18000,
  cacheLimit:120
});

state.v20=state.v20||{service:'ready',lastCheck:'',contentFresh:true};

function safeParse(raw,fallback){try{return JSON.parse(raw)||fallback}catch{return fallback}}
function arr(v){return Array.isArray(v)?v.filter(Boolean):[]}
function clampV(n,a,b){return Math.max(a,Math.min(b,Number(n)||0))}
function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function cacheAll(){return safeParse(localStorage.getItem(CACHE_KEY),{})||{}}
function cacheGet(key){return cacheAll()[key]||null}
function cachePut(key,value){const c=cacheAll();c[key]={...value,cachedAt:new Date().toISOString()};const keys=Object.keys(c).sort((a,b)=>new Date(c[b]?.cachedAt||0)-new Date(c[a]?.cachedAt||0));keys.slice(ONLINE_CONFIG.cacheLimit).forEach(k=>delete c[k]);try{localStorage.setItem(CACHE_KEY,JSON.stringify(c))}catch{} }

async function anyFirebaseToken(){
  try{
    const webUser=window.firebase?.auth?.()?.currentUser;
    if(webUser&&typeof webUser.getIdToken==='function')return await webUser.getIdToken();
  }catch{}
  try{return await originalGetFirebaseIdTokenV20()}catch{}
  return '';
}

const originalGetFirebaseIdTokenV20=getFirebaseIdToken;
getFirebaseIdToken=async function v20GetFirebaseIdToken(){
  const token=await anyFirebaseToken();
  if(!token)throw new Error('Sign in is required for cloud intelligence.');
  return token;
};

const originalNativeCloudAvailableV20=nativeCloudTranscriptionAvailable;
nativeCloudTranscriptionAvailable=function v20CloudTranscriptionAvailable(){
  if(!navigator.onLine)return false;
  if(originalNativeCloudAvailableV20())return true;
  try{return Boolean(window.firebase?.auth?.()?.currentUser)}catch{return false}
};

function sourceTranscript(response){return String(response?.cloudTranscript||response?.browserTranscript||response?.transcript||'').trim()}
function cacheKey(seg,transcript){return hashText(JSON.stringify([seg.id,seg.source,seg.model,seg.acceptedAlternatives||[],transcript]))}

function onlineToLegacy(a){
  const score=clampV(a.meaningTransfer,0,100);
  const status=a.status|| (score>=90?'excellent':score>=75?'good':score>=55?'review':'major');
  const preserved=arr(a.meaningPreserved);
  const missing=arr(a.missingOrUnclear);
  const critical=arr(a.criticalDetails).map(x=>({type:x.type||'detail',value:x.label||x.value||'',severity:x.severity||'major',matched:x.status==='preserved'||x.matched===true}));
  return {
    coverage:score/100,
    deduction:Math.min(3.5,Math.max(.05,(100-score)/30)),
    status,
    captured:preserved,
    review:missing,
    critical,
    units:arr(a.meaningPoints).map((x,i)=>({id:`online-${i+1}`,label:x.label||String(x),matched:(x.status||'preserved')==='preserved',required:true})),
    strengths:preserved.slice(0,5),
    advice:arr(a.nextSteps).slice(0,4),
    source:'online-semantic-v20'
  };
}

function normaliseOnline(payload){
  const score=clampV(payload?.meaningTransfer,0,100);
  const critical=arr(payload?.criticalDetails);
  const missing=arr(payload?.missingOrUnclear);
  const status=['excellent','good','review','major'].includes(payload?.status)?payload.status:(score>=90&&!missing.length?'excellent':score>=75?'good':score>=55?'review':'major');
  return {
    meaningTransfer:Math.round(score),status,
    confidence:clampV(payload?.confidence||.75,0,1),
    meaningPreserved:arr(payload?.meaningPreserved).slice(0,6),
    missingOrUnclear:missing.slice(0,6),
    languageImprovements:arr(payload?.languageImprovements).slice(0,5),
    criticalDetails:critical.slice(0,8),
    meaningPoints:arr(payload?.meaningPoints).slice(0,8),
    delivery:payload?.delivery&&typeof payload.delivery==='object'?payload.delivery:{rating:'Not assessed',notes:[]},
    shortNotes:String(payload?.shortNotes||'').trim(),
    noteTip:String(payload?.noteTip||'').trim(),
    improvedInterpretation:String(payload?.improvedInterpretation||'').trim(),
    nextSteps:arr(payload?.nextSteps).slice(0,4),
    provider:String(payload?.provider||'online'),model:String(payload?.model||''),
    assessedAt:payload?.assessedAt||new Date().toISOString()
  };
}

async function requestOnlineAssessment(seg,response,{force=false}={}){
  const transcript=sourceTranscript(response);
  if(!transcript||transcript.length<2)return null;
  if(!navigator.onLine){response.onlineAssessmentStatus='offline';return null;}
  if(Number(state.v20?.disabledUntil||0)>Date.now()&&!force){response.onlineAssessmentStatus='unavailable';return null;}
  const key=cacheKey(seg,transcript);
  if(!force){const cached=cacheGet(key);if(cached){response.onlineAssessment=normaliseOnline(cached);response.onlineAssessmentStatus='completed';response.assessment=onlineToLegacy(response.onlineAssessment);return response.onlineAssessment;}}

  response.onlineAssessmentStatus='processing';
  response.onlineAssessmentError='';
  render();
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ONLINE_CONFIG.timeoutMs);
  try{
    const token=await getFirebaseIdToken();
    const payload={
      schemaVersion:1,
      dialogueId:state.dialogue?.id||'',segmentId:seg.id,
      sourceLanguage:seg.sourceLanguage,targetLanguage:seg.sourceLanguage==='en'?'hi':'en',
      source:seg.source,studentTranscript:transcript,
      sampleAnswer:seg.sampleAnswer||seg.model||'',acceptedAlternatives:seg.acceptedAlternatives||[],
      meaningUnits:seg.meaningUnits||[],criticalDetails:seg.criticalDetails||[],semanticPolicy:seg.semanticPolicy||{},
      delivery:{startDelay:Number(response.startDelay||0),duration:Number(response.duration||0)}
    };
    const r=await fetch(ONLINE_CONFIG.assessEndpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload),signal:controller.signal});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body?.message||body?.error||`Online assessment failed (${r.status}).`);
    const a=normaliseOnline(body.assessment||body);
    response.onlineAssessment=a;response.onlineAssessmentStatus='completed';response.assessment=onlineToLegacy(a);response.practiceComparison=response.assessment;response.practiceComparisonSource='online-semantic-v20';
    cachePut(key,a);state.v20.service='online';state.v20.disabledUntil=0;state.v20.lastCheck=new Date().toISOString();
    return a;
  }catch(error){
    response.onlineAssessmentStatus=navigator.onLine?'failed':'offline';
    response.onlineAssessmentError=error?.name==='AbortError'?'Online assessment timed out; local feedback is shown.':(error?.message||'Online assessment unavailable; local feedback is shown.');
    state.v20.service='fallback';state.v20.disabledUntil=Date.now()+(10*60*1000);
    return null;
  }finally{clearTimeout(timer);render();}
}

const originalFinishRecordingV20=finishRecording;
finishRecording=async function v20FinishRecording(){
  const index=state.segmentIndex;
  await originalFinishRecordingV20();
  const response=state.responses[index];const seg=getActiveSegments()[index];
  if(response&&seg&&sourceTranscript(response)){
    response.__v20AssessmentPromise=requestOnlineAssessment(seg,response).finally(()=>{response.__v20AssessmentPromise=null;});
  }
};

const originalCloudTranscriptionV20=requestCloudTranscriptionForResponse;
requestCloudTranscriptionForResponse=async function v20CloudTranscription(blob,seg,response){
  await originalCloudTranscriptionV20(blob,seg,response);
  if(response.cloudTranscript){
    response.__v20AssessmentPromise=requestOnlineAssessment(seg,response,{force:true}).finally(()=>{response.__v20AssessmentPromise=null;});
  }
};

const originalAssessAndSaveV20=assessAndSaveDialogue;
assessAndSaveDialogue=async function v20AssessAndSave(){
  if(navigator.onLine){
    const pending=state.responses.filter(Boolean).map(r=>r.__v20AssessmentPromise).filter(Boolean);
    if(pending.length){showToast('Finalising online feedback…');await Promise.race([Promise.allSettled(pending),new Promise(r=>setTimeout(r,9000))]);}
  }
  return originalAssessAndSaveV20();
};

function localMeaningPoints(seg,transcript,r){
  const candidates=[];
  for(const unit of arr(seg?.meaningUnits)){
    const concepts=arr(unit.acceptedConcepts).map(String).map(x=>x.trim()).filter(Boolean);
    const short=concepts.filter(x=>x.split(/\s+/).length<=4&&x.length<=45&&(()=>{try{return APSScoring.tokens(x).length>0}catch{return true}})());
    for(const c of short){if(!candidates.some(x=>x.toLowerCase()===c.toLowerCase()))candidates.push(c);}
  }
  if(!candidates.length){
    for(const x of arr(seg?.comparisonPoints).slice(0,6))candidates.push(String(x));
  }
  if(!candidates.length){
    for(const x of arr(r?.units).slice(0,6))candidates.push(String(x.label||''));
  }
  return candidates.filter(Boolean).slice(0,8).map(label=>{
    let score=0;try{score=APSScoring.bestMeaningSimilarity(transcript,[label])}catch{}
    return {label,status:score>=.58?'preserved':score>=.34?'unclear':'missing'};
  });
}
function feedbackData(response,seg){
  const a=response?.onlineAssessment;
  if(a)return {online:true,...a};
  const r=response?.practiceComparison||response?.assessment||{};
  const transcript=sourceTranscript(response);
  let score=Math.round(clampV((Number(r.coverage)||0)*100,0,100));
  const matched=arr(r.units).filter(x=>x.matched).length,total=arr(r.units).length;
  if(total&&matched===total)score=Math.max(score,72);
  const points=localMeaningPoints(seg,transcript,r);
  const pointPreserved=points.filter(x=>x.status==='preserved').map(x=>x.label);
  const pointMissing=points.filter(x=>x.status!=='preserved').map(x=>x.status==='unclear'?`${x.label} — unclear`:x.label);
  const preserved=pointPreserved.length?pointPreserved:[...arr(r.captured),...arr(r.strengths).filter(x=>!/prompt/i.test(x))];
  const review=[...pointMissing,...arr(r.review),...arr(r.advice)];
  return {
    online:false,meaningTransfer:score,status:r.status||'unassessed',confidence:.45,
    meaningPreserved:[...new Set(preserved)].slice(0,6),
    missingOrUnclear:[...new Set(review)].slice(0,6),
    languageImprovements:[],criticalDetails:arr(r.critical).map(x=>({label:`${x.type}: ${x.value}`,status:x.matched?'preserved':'missing'})),
    meaningPoints:points.length?points:arr(r.units).map(x=>({label:x.label,status:x.matched?'preserved':'missing'})),
    delivery:{rating:Number(response?.startDelay||0)<=5?'Good':'Needs practice',notes:Number(response?.startDelay||0)<=5?['Began promptly']:['Try to begin within five seconds of the chime']},
    shortNotes:compactNotes(seg),noteTip:seg.noteTaking?.skillTip||'Capture who + action + key detail; avoid full sentences.',improvedInterpretation:seg.sampleAnswer||seg.model||'',nextSteps:arr(r.advice)
  };
}

function compactNotes(seg){
  const existing=String(seg?.noteTaking?.shortNotes||seg?.noteHint||'').trim();
  if(existing&&existing.length<=75)return existing;
  const sample=String(seg?.sampleAnswer||seg?.model||'').replace(/[.,!?;:]/g,' ').split(/\s+/).filter(Boolean);
  const stops=new Set('a an the i you he she we they it my your is are was were to of for and or but in on at with from do does did want would could should can have has had understand know please'.split(' '));
  const keep=[];for(const w of sample){if(w.length>2&&!stops.has(w.toLowerCase())&&!keep.some(x=>x.toLowerCase()===w.toLowerCase()))keep.push(w);if(keep.length>=7)break;}
  return keep.join(' • ')||'who • action • key detail';
}

function criticalSummary(data){const list=arr(data.criticalDetails);if(!list.length)return '—';const ok=list.filter(x=>x.status==='preserved'||x.matched===true).length;return `${ok}/${list.length}`}
function assessmentLabel(response,data){
  if(response.onlineAssessmentStatus==='processing')return '<span class="v20-source-pill processing">● Online assessment…</span>';
  if(data.online)return `<span class="v20-source-pill online">● Online semantic assessment</span>`;
  if(response.onlineAssessmentStatus==='failed')return '<span class="v20-source-pill fallback">Local fallback · online unavailable</span>';
  if(!navigator.onLine)return '<span class="v20-source-pill fallback">Offline local estimate</span>';
  return '<span class="v20-source-pill fallback">Local estimate</span>';
}
function listHtml(items,empty,kind='ok'){return `<ul>${(items.length?items:[empty]).map(x=>`<li class="${kind}">${kind==='ok'?'✓':kind==='warn'?'!':'•'} ${esc(typeof x==='string'?x:(x.label||x.reason||''))}</li>`).join('')}</ul>`}

comparisonPanel=function v20ComparisonPanel(seg,response){
  const data=feedbackData(response,seg);const transcript=sourceTranscript(response);const sample=seg.sampleAnswer||seg.model||'';
  const lang=arr(data.languageImprovements);const points=arr(data.meaningPoints).length?arr(data.meaningPoints):arr(seg.comparisonPoints).slice(0,6).map(x=>({label:x,status:'review'}));
  const statusText=resultStatusLabel(data.status);
  const missing=arr(data.missingOrUnclear);
  return `<section class="comparison-panel v20-feedback">
    <div class="v20-feedback-head"><div><small>ASSESSMENT & IMPROVEMENT</small><h3>${esc(statusText)}</h3>${assessmentLabel(response,data)}</div><div class="v20-score"><strong>${data.meaningTransfer||0}%</strong><span>estimated meaning transfer</span></div></div>
    ${response.onlineAssessmentStatus==='failed'?`<div class="v20-service-note">${esc(response.onlineAssessmentError||'Online assessment is unavailable.')} <button data-action="v20-retry-assessment">Retry online</button></div>`:''}
    <div class="v20-summary-grid"><div><b>${criticalSummary(data)}</b><span>critical details</span></div><div><b>${esc(data.delivery?.rating||'—')}</b><span>delivery</span></div><div><b>${data.online?Math.round((data.confidence||0)*100)+'%':'Local'}</b><span>${data.online?'assessment confidence':'fallback check'}</span></div></div>

    <article class="v20-transcript-card"><small>YOUR ${response.cloudTranscript?'CLOUD':'BROWSER'} TRANSCRIPT</small><p>${esc(transcript||'Transcript unavailable — replay your saved recording.')}</p>${response.recordingUrl?'<span>Always check the transcript against your recording.</span>':''}</article>

    <div class="v20-feedback-columns"><article><h4>✓ Meaning preserved</h4>${listHtml(arr(data.meaningPreserved),'Replay your answer and confirm the main message.','ok')}</article><article><h4>! Missing / unclear</h4>${listHtml(missing,'No important meaning loss identified.','warn')}</article></div>

    ${lang.length?`<article class="v20-language"><h4>Improve your language</h4>${lang.map(x=>`<div><p>${x.original?`<s>${esc(x.original)}</s> → `:''}<b>${esc(x.improved||x.suggestion||'')}</b></p>${x.reason?`<span>${esc(x.reason)}</span>`:''}</div>`).join('')}</article>`:''}

    <section class="v20-meaning-points"><div><small>MEANING POINTS</small><h4>What the interpretation needed to carry</h4></div><div>${points.map(x=>`<span class="${x.status==='preserved'?'ok':x.status==='missing'?'miss':'check'}">${x.status==='preserved'?'✓':x.status==='missing'?'!':'•'} ${esc(x.label||x)}</span>`).join('')}</div></section>

    <section class="v20-notes"><div><small>SHORT NOTES</small><strong>${esc(data.shortNotes||compactNotes(seg))}</strong></div><button data-action="v20-toggle-note-tip">💡 ${response.showV20NoteTip?'Hide tip':'Note-taking tip'}</button></section>
    ${response.showV20NoteTip?`<div class="v20-note-tip">${esc(data.noteTip||seg.noteTaking?.skillTip||'Capture who + action + key detail; avoid full sentences.')}</div>`:''}

    <div class="v20-sample-toggle"><button data-action="v20-toggle-sample">${response.showV20Sample?'Hide sample answer':'Show sample answer'}</button><button class="sample-play" data-action="play-sample-answer">🔊 Play sample</button></div>
    ${response.showV20Sample?`<article class="v20-sample"><small>SAMPLE INTERPRETATION · EXAMPLE, NOT AN EXACT KEY</small><p>${esc(data.improvedInterpretation||sample)}</p><em>Equivalent wording, synonyms, word order and accurate paraphrasing can also be correct.</em></article>`:''}
  </section>`;
};

// The old extra learning feedback repeated information already shown above.
learningFeedback=function v20LearningFeedback(){return ''};

segmentReportRow=function v20SegmentReportRow(seg,res,i){
  const data=feedbackData(res,seg),transcript=sourceTranscript(res),open=data.status==='major'?'open':'';
  return `<details class="segment-result ${esc(data.status||'unassessed')}" ${open}><summary><span class="result-dot ${esc(data.status||'unassessed')}"></span><div><b>Segment ${i+1} · ${seg.sourceLanguage==='en'?'English → Hindi':'Hindi → English'}</b><small>${data.meaningTransfer}% meaning transfer · ${data.online?'online':'local fallback'}</small></div><i>⌄</i></summary><div class="segment-detail v20-report-segment"><div><h4>Original</h4><p>${esc(seg.source)}</p><button data-action="speak-text" data-text="${encodeURIComponent(seg.source)}" data-lang="${seg.sourceLanguage}" data-speaker="${esc(seg.speaker||'general')}">🔊 Play source</button></div><div><h4>Your response</h4><p>${esc(transcript||'Transcript unavailable — replay your audio.')}</p>${res.recordingUrl?`<audio controls src="${esc(res.recordingUrl)}"></audio>`:''}</div><div><h4>Meaning review</h4>${listHtml(arr(data.meaningPreserved),'No preserved point identified.','ok')}${listHtml(arr(data.missingOrUnclear),'No important meaning loss identified.','warn')}</div><div><h4>Short notes</h4><p class="notes">${esc(data.shortNotes||compactNotes(seg))}</p><p class="notes"><b>Improve:</b> ${esc(arr(data.nextSteps)[0]||data.noteTip||'Repeat naturally and preserve every critical detail.')}</p></div></div></details>`;
};

// --- V20 navigation and organisation ---
nav=function v20Nav(){return `<nav class="bottom-nav" aria-label="Main navigation">${[
 ['home','⌂','Home'],['learn','A','Learn'],['practice','▶','Practice'],['review','✓','Review'],['progress','▥','Progress']
].map(([id,icon,label])=>`<button data-action="tab" data-id="${id}" class="${state.tab===id?'active':''}"><b>${icon}</b><span>${label}</span></button>`).join('')}</nav>`};

function dueReviewCount(){return getJSON(storageKeys.mistakes,[]).filter(x=>!x.mastered).length}
function myVocabCounts(){try{const s=getJSON(storageKeys.myVocabs,{items:{}});const rows=Object.values(s.items||{}).filter(x=>x&&!x.deleted);return {all:rows.length,review:rows.filter(x=>(x.recallStatus||x.status||'review')==='review').length}}catch{return {all:0,review:0}}}
function nextDialogue(){const records=dialogueStatsMap();return state.dialogues.find(d=>(records[d.id]?.practiceCount||0)===0)||state.dialogues[0]}

home=function v20Home(){
  const attempts=getJSON(storageKeys.attempts,[]).filter(x=>x.finished),last=attempts.at(-1),next=nextDialogue(),my=myVocabCounts(),mistakes=dueReviewCount();
  const online=navigator.onLine;
  return shell(`${header('APS NAATI CCL Practice',online?'Online-first learning · cached for speed':'Offline cache · online intelligence will resume automatically')}
  <section class="v20-home-hero"><div><small>YOUR NEXT STEP</small><h2>${next?esc(next.title):'Continue your preparation'}</h2><p>${next?esc(next.situation||'Continue dialogue practice and meaning-first review.'):'Your learning records are ready.'}</p><div class="actions">${next?button('Continue dialogue →','open-dialogue','primary',`data-id="${next.id}" data-mode="learning"`):''}${button('Open Practice','tab','secondary','data-id="practice"')}</div></div><div class="v20-online-card ${online?'online':'offline'}"><b>${online?'● Online':'○ Offline'}</b><span>${online?'Cloud sync and online assessment available':'Cached learning remains available'}</span></div></section>
  <section class="v20-today"><article><small>REVIEW</small><strong>${mistakes}</strong><span>weak segments to revisit</span><button data-action="tab" data-id="review">Review now</button></article><article><small>MY VOCABS</small><strong>${my.all}</strong><span>${my.review} need review</span><button data-action="open-my-vocabs">Open sheet</button></article><article><small>LATEST RESULT</small><strong>${last?.report?`${last.report.low}–${last.report.high}`:'—'}</strong><span>${last?.report?'estimated /45':'complete a dialogue'}</span><button data-action="tab" data-id="progress">View progress</button></article></section>
  <section class="v20-main-actions"><button data-action="tab" data-id="learn"><b>Learn</b><span>Vocabulary, phrases, My Vocabs and lessons</span></button><button data-action="tab" data-id="practice"><b>Practice</b><span>Verified Practice, Original Source and Mock Test</span></button><button data-action="tab" data-id="review"><b>Review</b><span>Mistakes, reports and weak segments</span></button><button data-action="tab" data-id="progress"><b>Progress</b><span>Completion, attempts and improvement</span></button></section>
  <div class="warning">Independent preparation app. All scores are estimated learning feedback, not official NAATI results.</div>`);
};

function reviewPage(){
  const mistakes=getJSON(storageKeys.mistakes,[]),active=mistakes.filter(x=>!x.mastered).slice(-30).reverse();
  const attempts=getJSON(storageKeys.attempts,[]).filter(x=>x.finished).slice(-12).reverse();
  return shell(`${header('Review','Your mistakes, previous reports and personal revision queue')}
  <section class="v20-review-summary"><div><strong>${active.length}</strong><span>weak segments</span></div><div><strong>${attempts.length}</strong><span>recent reports</span></div><div><strong>${myVocabCounts().review}</strong><span>My Vocabs to review</span></div></section>
  <section class="dashboard-grid"><article class="card"><small>MISTAKE NOTEBOOK</small><h3>Fix the meaning that was missed</h3>${active.length?`<div class="mistake-list">${active.map(m=>`<div><span class="result-dot ${esc(m.status||'review')}"></span><p><b>${esc(m.dialogueTitle)} · Segment ${m.segmentNumber}</b><small>${esc(arr(m.review).slice(0,2).join(' · ')||'Review this segment')}</small></p><button data-action="open-dialogue" data-id="${esc(m.dialogueId)}" data-mode="learning">Practise</button></div>`).join('')}</div>`:'<p class="muted">No weak segments are waiting for review.</p>'}</article>
  <article class="card"><small>RECENT REPORTS</small><h3>Compare your attempts</h3>${attempts.length?`<div class="attempts">${attempts.map(a=>`<button data-action="open-saved-report" data-id="${esc(a.id)}"><strong>${esc(a.title)}</strong><span>${a.report?.low??'—'}–${a.report?.high??'—'} /45</span><small>${new Date(a.finishedAt).toLocaleString()}</small></button>`).join('')}</div>`:'<p class="muted">Complete a dialogue to create a report.</p>'}</article></section>
  <section class="card v20-review-actions"><small>QUICK REVIEW</small><h3>Choose what to revise</h3><div class="actions"><button class="primary" data-action="open-my-vocabs">My Vocabs</button><button class="secondary" data-action="tab" data-id="learn">Vocabulary & Phrases</button><button class="secondary" data-action="tab" data-id="practice">Dialogue Practice</button></div></section>`);
}

const basePracticeV20=practice;
practice=function v20Practice(){
  let html=basePracticeV20();
  const tools=`<section class="v20-practice-modes"><div><small>PRACTICE MODES</small><h3>Choose how you want to practise</h3></div><button class="active"><b>Dialogue Practice</b><span>Learning + recorded practice</span></button><button data-action="v20-open-mock"><b>Mock Test</b><span>Two dialogues · feedback at the end</span></button></section>`;
  return html.replace('<div class="info">',tools+'<div class="info">');
};

const baseRenderV20=render;
render=function v20Render(){
  if(state.ready&&state.auth.initialized&&state.selectedLanguage&&localStorage.getItem(storageKeys.onboard)==='1'&&!state.overlay&&state.tab==='review'){
    app.innerHTML=reviewPage();return;
  }
  return baseRenderV20();
};

// Background freshness check: UI never waits for it.
async function checkFreshness(){
  if(!navigator.onLine)return;
  try{const r=await fetch('./version.json',{cache:'no-store'});if(!r.ok)return;const v=await r.json();state.v20.contentFresh=String(v.version||'')==='20.0';state.v20.lastCheck=new Date().toISOString();}catch{}
}
setTimeout(checkFreshness,1000);setInterval(checkFreshness,5*60*1000);

// V20 actions are handled in capture phase so the older handler can safely ignore them.
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
  if(a==='v20-open-mock'){event.preventDefault();state.tab='mock';render();}
  else if(a==='v20-toggle-sample'){event.preventDefault();const r=state.responses[state.segmentIndex];if(r){r.showV20Sample=!r.showV20Sample;render();}}
  else if(a==='v20-toggle-note-tip'){event.preventDefault();const r=state.responses[state.segmentIndex];if(r){r.showV20NoteTip=!r.showV20NoteTip;render();}}
  else if(a==='v20-retry-assessment'){event.preventDefault();const r=state.responses[state.segmentIndex],seg=getActiveSegments()[state.segmentIndex];if(r&&seg){r.__v20AssessmentPromise=requestOnlineAssessment(seg,r,{force:true}).finally(()=>{r.__v20AssessmentPromise=null;});}}
},true);

window.APSOnlineV20={version:VERSION,requestOnlineAssessment,feedbackData,config:ONLINE_CONFIG};
console.info(`${VERSION} loaded · online-first semantic feedback with cache-first fallback · simplified Home/Review/Practice organisation.`);
})();
