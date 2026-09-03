(function(){
'use strict';

const VERSION='APS Online V20';
const CACHE_KEY='apsV20AssessmentCacheV2';
const ASSESSMENT_ENABLED_KEY='apsV20OnlineAssessmentEnabled';
const ONLINE_CONFIG=Object.freeze({
  region:'australia-southeast1',
  assessEndpoint:'https://australia-southeast1-aps-naati-ccl-practice.cloudfunctions.net/assessAttempt',
  timeoutMs:18000,
  cacheLimit:120
});

state.v20=state.v20||{service:'ready',lastCheck:'',contentFresh:true};
function onlineAssessmentEnabled(){return localStorage.getItem(ASSESSMENT_ENABLED_KEY)!=='0';}
function setOnlineAssessmentEnabled(enabled){localStorage.setItem(ASSESSMENT_ENABLED_KEY,enabled?'1':'0');state.v20.onlineAssessmentEnabled=Boolean(enabled);}
state.v20.onlineAssessmentEnabled=onlineAssessmentEnabled();

const originalRenderModalOnlineV20=renderModal;
renderModal=function v20RenderModal(){
  let html=originalRenderModalOnlineV20.apply(this,arguments);
  if(state.modal?.type!=='app-settings'||typeof html!=='string')return html;
  const enabled=onlineAssessmentEnabled();
  const card=`<section id="apsOnlineAssessmentSettingsCard" class="voice-settings-section assessment-settings-section"><small>STUDY</small><h3>Online assessment</h3><label class="toggle"><input id="v20OnlineAssessmentEnabled" type="checkbox" ${enabled?'checked':''}><span>Use online semantic assessment</span></label><p class="settings-link-note">${enabled?'Online meaning-transfer assessment starts only when you tap Review for a recorded response.':'Online semantic assessment is off. Review still shows available local feedback and no online assessment request is sent.'}</p></section>`;
  return html.replace('<div class="settings-actions">',card+'<div class="settings-actions">');
};

function safeParse(raw,fallback){try{return JSON.parse(raw)||fallback}catch{return fallback}}
function arr(v){return Array.isArray(v)?v.filter(Boolean):[]}
function clampV(n,a,b){return Math.max(a,Math.min(b,Number(n)||0))}
function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}

const LANGUAGE_META=Object.freeze({
  en:{name:'English',locale:'en-AU',script:'latin'},
  hi:{name:'Hindi',locale:'hi-IN',script:'devanagari'},
  pa:{name:'Punjabi',locale:'pa-IN',script:'gurmukhi'},
  ur:{name:'Urdu',locale:'ur-PK',script:'arabic'},
  gu:{name:'Gujarati',locale:'gu-IN',script:'gujarati'},
  ne:{name:'Nepali',locale:'ne-NP',script:'devanagari'},
  bn:{name:'Bengali',locale:'bn-BD',script:'bengali'},
  ta:{name:'Tamil',locale:'ta-IN',script:'tamil'},
  te:{name:'Telugu',locale:'te-IN',script:'telugu'},
  zh:{name:'Mandarin',locale:'zh-CN',script:'han'},
  ar:{name:'Arabic',locale:'ar-SA',script:'arabic'},
  ml:{name:'Malayalam',locale:'ml-IN',script:'malayalam'},
  kn:{name:'Kannada',locale:'kn-IN',script:'kannada'},
  si:{name:'Sinhala',locale:'si-LK',script:'sinhala'}
});
function baseLanguageCode(code=''){return String(code||'').trim().toLowerCase().split(/[-_]/)[0]||''}
function languageName(code){
  const id=baseLanguageCode(code);
  return state.languageCatalog?.find?.(x=>baseLanguageCode(x.id)===id)?.name||LANGUAGE_META[id]?.name||id.toUpperCase()||'target language';
}
function activeTargetLanguage(){
  return baseLanguageCode(state.selectedLanguage||state.languagePack?.id||'hi')||'hi';
}
function targetLanguageForSegment(seg){
  const explicit=baseLanguageCode(seg?.targetLanguage||seg?.targetLang||'');
  if(explicit)return explicit;
  const source=baseLanguageCode(seg?.sourceLanguage);
  return source==='en'?activeTargetLanguage():'en';
}
function directionLabel(seg){
  const source=baseLanguageCode(seg?.sourceLanguage);
  const target=targetLanguageForSegment(seg);
  return `${languageName(source)} → ${languageName(target)}`;
}
function scriptForLanguage(code){return LANGUAGE_META[baseLanguageCode(code)]?.script||''}
function scriptOfChar(ch){
  const cp=ch.codePointAt(0);
  if((cp>=0x0041&&cp<=0x005A)||(cp>=0x0061&&cp<=0x007A)||(cp>=0x00C0&&cp<=0x024F)||(cp>=0x1E00&&cp<=0x1EFF))return 'latin';
  if(cp>=0x0900&&cp<=0x097F)return 'devanagari';
  if(cp>=0x0A00&&cp<=0x0A7F)return 'gurmukhi';
  if(cp>=0x0A80&&cp<=0x0AFF)return 'gujarati';
  if(cp>=0x0980&&cp<=0x09FF)return 'bengali';
  if(cp>=0x0B80&&cp<=0x0BFF)return 'tamil';
  if(cp>=0x0C00&&cp<=0x0C7F)return 'telugu';
  if(cp>=0x0C80&&cp<=0x0CFF)return 'kannada';
  if(cp>=0x0D00&&cp<=0x0D7F)return 'malayalam';
  if(cp>=0x0D80&&cp<=0x0DFF)return 'sinhala';
  if((cp>=0x3400&&cp<=0x4DBF)||(cp>=0x4E00&&cp<=0x9FFF))return 'han';
  if((cp>=0x0600&&cp<=0x06FF)||(cp>=0x0750&&cp<=0x077F)||(cp>=0x08A0&&cp<=0x08FF))return 'arabic';
  return '';
}
function analyseLanguageUse(transcript,sourceLanguage,targetLanguage){
  const source=baseLanguageCode(sourceLanguage),target=baseLanguageCode(targetLanguage);
  const sourceScript=scriptForLanguage(source),targetScript=scriptForLanguage(target);
  const counts={latin:0,devanagari:0,gurmukhi:0,gujarati:0,bengali:0,tamil:0,telugu:0,kannada:0,malayalam:0,sinhala:0,han:0,arabic:0,other:0};
  let letters=0;
  for(const ch of String(transcript||'')){
    if(!/\p{L}/u.test(ch))continue;
    letters++;
    const script=scriptOfChar(ch);
    if(script)counts[script]++;else counts.other++;
  }
  const recognised=Object.entries(counts).filter(([k])=>k!=='other').reduce((sum,[,v])=>sum+v,0);
  const targetCount=targetScript?counts[targetScript]||0:0;
  const sourceCount=sourceScript?counts[sourceScript]||0:0;
  const targetShare=recognised?targetCount/recognised:0;
  const sourceShare=recognised?sourceCount/recognised:0;
  const distinctScripts=Boolean(sourceScript&&targetScript&&sourceScript!==targetScript);
  let classification='uncertain',deterministicWrong=false;
  if(distinctScripts&&recognised>=8){
    if(targetShare>=.72)classification='target';
    else if(targetShare>=.48)classification='mostly_target_mixed';
    else if(sourceShare>=.72&&targetShare<=.15){classification='mostly_wrong';deterministicWrong=true;}
    else classification='mixed';
  }
  return {
    sourceLanguage:source,targetLanguage:target,
    sourceLanguageName:languageName(source),targetLanguageName:languageName(target),
    sourceScript,targetScript,letters,recognisedLetters:recognised,
    scriptCounts:counts,targetScriptShare:Number(targetShare.toFixed(3)),
    sourceScriptShare:Number(sourceShare.toFixed(3)),
    classification,deterministicWrong,
    note:'Script evidence is a conservative sanity check only. Proper nouns, numbers, common borrowed terms and limited code-switching must not be treated as automatic failure.'
  };
}
function languageUseFromEvidence(evidence){
  if(!evidence)return {classification:'uncertain',compliance:null,expectedTargetLanguage:'',detectedPrimaryLanguage:'',targetLanguageShare:null,sourceLanguageShare:null,untranslatedSourcePhrases:[],notes:[]};
  const compliance=evidence.classification==='target'?100:evidence.classification==='mostly_target_mixed'?Math.round(evidence.targetScriptShare*100):evidence.classification==='mixed'?Math.round(evidence.targetScriptShare*100):evidence.classification==='mostly_wrong'?Math.round(evidence.targetScriptShare*100):null;
  return {
    classification:evidence.classification,
    compliance,
    expectedTargetLanguage:evidence.targetLanguage,
    detectedPrimaryLanguage:evidence.deterministicWrong?evidence.sourceLanguage:'',
    targetLanguageShare:evidence.targetScriptShare,
    sourceLanguageShare:evidence.sourceScriptShare,
    untranslatedSourcePhrases:[],
    notes:[]
  };
}
function applyLanguageGuard(assessment,evidence){
  const a={...assessment};
  const serverUse=a.targetLanguageUse&&typeof a.targetLanguageUse==='object'?{...a.targetLanguageUse}:languageUseFromEvidence(evidence);
  if(!serverUse.expectedTargetLanguage)serverUse.expectedTargetLanguage=evidence?.targetLanguage||'';
  if(serverUse.compliance!==null&&serverUse.compliance!==undefined)serverUse.compliance=Math.round(clampV(serverUse.compliance,0,100));
  const serverWrong=Boolean(a.wrongTargetLanguage)||serverUse.classification==='mostly_wrong'||serverUse.classification==='wrong';
  const deterministicWrong=Boolean(evidence?.deterministicWrong);
  a.wrongTargetLanguage=serverWrong||deterministicWrong;
  if(deterministicWrong){
    serverUse.classification='mostly_wrong';
    serverUse.expectedTargetLanguage=evidence.targetLanguage;
    serverUse.detectedPrimaryLanguage=serverUse.detectedPrimaryLanguage||evidence.sourceLanguage;
    serverUse.targetLanguageShare=evidence.targetScriptShare;
    serverUse.sourceLanguageShare=evidence.sourceScriptShare;
    serverUse.compliance=Math.min(Number.isFinite(Number(serverUse.compliance))?Number(serverUse.compliance):100,Math.round(evidence.targetScriptShare*100));
    const msg=`Response is predominantly ${evidence.sourceLanguageName}; ${evidence.targetLanguageName} was required.`;
    const missing=arr(a.missingOrUnclear);
    if(!missing.some(x=>String(x).toLowerCase().includes('target language')))missing.unshift(msg);
    a.missingOrUnclear=missing.slice(0,6);
    const steps=arr(a.nextSteps);
    if(!steps.some(x=>String(x).toLowerCase().includes(evidence.targetLanguageName.toLowerCase())))steps.unshift(`Interpret the full message into ${evidence.targetLanguageName}; limited natural borrowing is fine, but do not repeat the source language.`);
    a.nextSteps=steps.slice(0,4);
  }
  if(a.wrongTargetLanguage)a.status='major';
  a.targetLanguageUse=serverUse;
  return a;
}
function applyLocalLanguageGuard(seg,response){
  if(!seg||!response)return null;
  const transcript=sourceTranscript(response);
  if(!transcript)return null;
  const evidence=analyseLanguageUse(transcript,seg.sourceLanguage,targetLanguageForSegment(seg));
  response.targetLanguageEvidence=evidence;
  const r=response.practiceComparison||response.assessment;
  if(!r||typeof r!=='object')return evidence;
  if(evidence.deterministicWrong){
    r.wrongTargetLanguage=true;
    r.targetLanguageUse=languageUseFromEvidence(evidence);
    r.status='major';
    r.coverage=Math.min(Number(r.coverage)||0,.15);
    r.deduction=Math.max(Number(r.deduction)||0,3.5);
    r.strengths=[];
    const msg=`Wrong target language: ${evidence.targetLanguageName} was required; the response was predominantly ${evidence.sourceLanguageName}.`;
    r.review=arr(r.review);
    if(!r.review.some(x=>String(x).toLowerCase().includes('wrong target language')))r.review.unshift(msg);
    r.advice=arr(r.advice);
    if(!r.advice.some(x=>String(x).toLowerCase().includes(evidence.targetLanguageName.toLowerCase())))r.advice.unshift(`Interpret the message into ${evidence.targetLanguageName} rather than repeating the source language.`);
  }else if(!r.targetLanguageUse){
    r.targetLanguageUse=languageUseFromEvidence(evidence);
  }
  return evidence;
}

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
function reviewCloudTranscriptionAvailable(){
  if(!navigator.onLine)return false;
  if(originalNativeCloudAvailableV20())return true;
  try{return Boolean(window.firebase?.auth?.()?.currentUser)}catch{return false}
}
// V20.3.2.1: do not start an online transcription/assessment pipeline
// automatically when recording finishes. Review starts it on demand instead.
nativeCloudTranscriptionAvailable=function v20321DeferredCloudTranscription(){return false;};

function sourceTranscript(response){return String(response?.cloudTranscript||response?.browserTranscript||response?.transcript||'').trim()}
function cacheKey(seg,transcript){const target=targetLanguageForSegment(seg);return hashText(JSON.stringify(['lang-guard-v2',seg.id,baseLanguageCode(seg.sourceLanguage),target,seg.source,seg.model,seg.acceptedAlternatives||[],transcript]))}

function onlineToLegacy(a){
  const score=clampV(a.meaningTransfer,0,100);
  const wrongLanguage=Boolean(a.wrongTargetLanguage);
  const status=wrongLanguage?'major':(a.status|| (score>=90?'excellent':score>=75?'good':score>=55?'review':'major'));
  const preserved=arr(a.meaningPreserved);
  const missing=arr(a.missingOrUnclear);
  const critical=arr(a.criticalDetails).map(x=>({type:x.type||'detail',value:x.label||x.value||'',severity:x.severity||'major',matched:x.status==='preserved'||x.matched===true}));
  const compliance=a.targetLanguageUse?.compliance===null||a.targetLanguageUse?.compliance===undefined?100:clampV(a.targetLanguageUse.compliance,0,100);
  const languagePenalty=wrongLanguage?0:Math.max(0,(100-compliance)/500);
  return {
    coverage:wrongLanguage?Math.min(.15,score/100):Math.max(0,(score/100)-languagePenalty),
    deduction:wrongLanguage?3.5:Math.min(3.5,Math.max(.05,(100-score)/30)+(languagePenalty*2)),
    status,
    captured:preserved,
    review:missing,
    critical,
    units:arr(a.meaningPoints).map((x,i)=>({id:`online-${i+1}`,label:x.label||String(x),matched:!wrongLanguage&&(x.status||'preserved')==='preserved',required:true})),
    strengths:wrongLanguage?[]:preserved.slice(0,5),
    advice:arr(a.nextSteps).slice(0,4),
    wrongTargetLanguage:wrongLanguage,
    targetLanguageUse:a.targetLanguageUse||null,
    source:'online-semantic-v20'
  };
}

function normaliseOnline(payload){
  const score=clampV(payload?.meaningTransfer,0,100);
  const critical=arr(payload?.criticalDetails);
  const missing=arr(payload?.missingOrUnclear);
  const languageUse=payload?.targetLanguageUse&&typeof payload.targetLanguageUse==='object'?{
    classification:String(payload.targetLanguageUse.classification||'uncertain'),
    compliance:payload.targetLanguageUse.compliance===null||payload.targetLanguageUse.compliance===undefined?null:Math.round(clampV(payload.targetLanguageUse.compliance,0,100)),
    expectedTargetLanguage:baseLanguageCode(payload.targetLanguageUse.expectedTargetLanguage||''),
    detectedPrimaryLanguage:baseLanguageCode(payload.targetLanguageUse.detectedPrimaryLanguage||''),
    targetLanguageShare:payload.targetLanguageUse.targetLanguageShare===null||payload.targetLanguageUse.targetLanguageShare===undefined?null:clampV(payload.targetLanguageUse.targetLanguageShare,0,1),
    sourceLanguageShare:payload.targetLanguageUse.sourceLanguageShare===null||payload.targetLanguageUse.sourceLanguageShare===undefined?null:clampV(payload.targetLanguageUse.sourceLanguageShare,0,1),
    untranslatedSourcePhrases:arr(payload.targetLanguageUse.untranslatedSourcePhrases).slice(0,5),
    notes:arr(payload.targetLanguageUse.notes).slice(0,4)
  }:null;
  const wrongTargetLanguage=Boolean(payload?.wrongTargetLanguage)||languageUse?.classification==='mostly_wrong'||languageUse?.classification==='wrong';
  let status=wrongTargetLanguage?'major':(['excellent','good','review','major'].includes(payload?.status)?payload.status:(score>=90&&!missing.length?'excellent':score>=75?'good':score>=55?'review':'major'));
  const compliance=languageUse?.compliance;
  if(!wrongTargetLanguage&&compliance!==null&&compliance!==undefined){
    if(compliance<70&&['excellent','good'].includes(status))status='review';
    else if(compliance<90&&status==='excellent')status='good';
  }
  return {
    meaningTransfer:Math.round(score),status,wrongTargetLanguage,targetLanguageUse:languageUse,
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
  if(!onlineAssessmentEnabled()){response.onlineAssessmentStatus='disabled';response.onlineAssessmentError='';return null;}
  if(!navigator.onLine){response.onlineAssessmentStatus='offline';return null;}
  if(Number(state.v20?.disabledUntil||0)>Date.now()&&!force){response.onlineAssessmentStatus='unavailable';return null;}
  const key=cacheKey(seg,transcript);
  if(!force){const cached=cacheGet(key);if(cached){response.onlineAssessment=normaliseOnline(cached);response.onlineAssessmentStatus='completed';response.assessment=onlineToLegacy(response.onlineAssessment);response.practiceComparison=response.assessment;response.practiceComparisonSource='online-semantic-v20-cache';render();return response.onlineAssessment;}}

  response.onlineAssessmentStatus='processing';
  response.onlineAssessmentError='';
  render();
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ONLINE_CONFIG.timeoutMs);
  try{
    const token=await getFirebaseIdToken();
    const sourceLanguage=baseLanguageCode(seg.sourceLanguage);
    const targetLanguage=targetLanguageForSegment(seg);
    const languageEvidence=analyseLanguageUse(transcript,sourceLanguage,targetLanguage);
    const payload={
      schemaVersion:2,
      dialogueId:state.dialogue?.id||'',segmentId:seg.id,
      sourceLanguage,targetLanguage,
      source:seg.source,studentTranscript:transcript,
      sampleAnswer:seg.sampleAnswer||seg.model||'',acceptedAlternatives:seg.acceptedAlternatives||[],
      meaningUnits:seg.meaningUnits||[],criticalDetails:seg.criticalDetails||[],semanticPolicy:seg.semanticPolicy||{},
      languageEvidence,
      delivery:{startDelay:Number(response.startDelay||0),duration:Number(response.duration||0)}
    };
    const r=await fetch(ONLINE_CONFIG.assessEndpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload),signal:controller.signal});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body?.message||body?.error||`Online assessment failed (${r.status}).`);
    const a=applyLanguageGuard(normaliseOnline(body.assessment||body),languageEvidence);
    if(!onlineAssessmentEnabled()){response.onlineAssessmentStatus='disabled';response.onlineAssessmentError='';return null;}
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
finishRecording=async function v20321FinishRecordingWithoutAutoAssessment(){
  const index=state.segmentIndex;
  await originalFinishRecordingV20();
  const response=state.responses[index],seg=getActiveSegments()[index];
  if(!response)return;
  if(seg)applyLocalLanguageGuard(seg,response);
  if(response.onlineAssessment){
    response.onlineAssessmentStatus='completed';
  }else{
    response.onlineAssessmentStatus=onlineAssessmentEnabled()?'ready':'disabled';
    response.onlineAssessmentError='';
  }
  render();
  // Mock Test has no per-segment Review control during the timed test, so keep
  // its existing assessment behaviour when Online assessment is enabled.
  if(state.dialogueMode==='mock'&&seg&&onlineAssessmentEnabled()&&!response.onlineAssessment){
    void requestAssessmentForReview(seg,response);
  }
};

const originalCloudTranscriptionV20=requestCloudTranscriptionForResponse;
requestCloudTranscriptionForResponse=function v20321ReviewCloudTranscription(blob,seg,response){
  const task=(async()=>{
    await originalCloudTranscriptionV20(blob,seg,response);
    applyLocalLanguageGuard(seg,response);
    if(response.cloudTranscript){
      response.onlineAssessmentStatus=response.onlineAssessment?'completed':(onlineAssessmentEnabled()?'ready':'disabled');
      response.onlineAssessmentError='';
    }
    return response.cloudTranscript||'';
  })();
  response.__v20CloudTranscriptionPromise=task;
  return task.finally(()=>{
    if(response.__v20CloudTranscriptionPromise===task)response.__v20CloudTranscriptionPromise=null;
    if(state.responses?.includes?.(response))render();
  });
};

async function requestAssessmentForReview(seg,response,{force=false}={}){
  if(!seg||!response)return null;
  if(response.onlineAssessment&&!force){
    response.onlineAssessmentStatus='completed';
    render();
    return response.onlineAssessment;
  }
  if(!onlineAssessmentEnabled()){
    response.onlineAssessmentStatus='disabled';
    response.onlineAssessmentError='';
    render();
    return null;
  }
  if(response.__v20AssessmentPromise)return response.__v20AssessmentPromise;

  const task=(async()=>{
    response.onlineAssessmentStatus='preparing';
    response.onlineAssessmentError='';
    render();

    // Prefer the cloud transcript for assessment when online transcription is
    // available, but start that work only because the learner tapped Review.
    if(!response.cloudTranscript&&reviewCloudTranscriptionAvailable()&&response.recordingId){
      try{
        let cloudTask=response.__v20CloudTranscriptionPromise;
        if(!cloudTask){
          const blob=await loadBlob(response.recordingId);
          if(blob)cloudTask=requestCloudTranscriptionForResponse(blob,seg,response);
        }
        if(cloudTask)await cloudTask;
      }catch{}
    }

    if(!onlineAssessmentEnabled()){
      response.onlineAssessmentStatus='disabled';
      response.onlineAssessmentError='';
      render();
      return null;
    }

    if(!sourceTranscript(response)){
      response.onlineAssessmentStatus='unavailable';
      response.onlineAssessmentError='A transcript is unavailable for online assessment. Replay your saved recording and use the local comparison.';
      render();
      return null;
    }

    return requestOnlineAssessment(seg,response,{force});
  })();

  response.__v20AssessmentPromise=task;
  try{return await task;}finally{
    if(response.__v20AssessmentPromise===task)response.__v20AssessmentPromise=null;
    render();
  }
}

const originalAssessAndSaveV20=assessAndSaveDialogue;
assessAndSaveDialogue=async function v20AssessAndSave(){
  if(navigator.onLine&&onlineAssessmentEnabled()){
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
  const evidence=applyLocalLanguageGuard(seg,response)||response?.targetLanguageEvidence;
  const wrongTargetLanguage=Boolean(r.wrongTargetLanguage)||Boolean(evidence?.deterministicWrong);
  return {
    online:false,meaningTransfer:score,status:wrongTargetLanguage?'major':(r.status||'unassessed'),wrongTargetLanguage,targetLanguageUse:r.targetLanguageUse||languageUseFromEvidence(evidence),confidence:.45,
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
  if(response.onlineAssessmentStatus==='preparing')return '<span class="v20-source-pill processing"><i class="v20-mini-spinner" aria-hidden="true"></i> Preparing assessment…</span>';
  if(response.onlineAssessmentStatus==='processing')return '<span class="v20-source-pill processing"><i class="v20-mini-spinner" aria-hidden="true"></i> Online assessment…</span>';
  if(response.onlineAssessmentStatus==='disabled')return '<span class="v20-source-pill fallback">Online assessment off · local feedback</span>';
  if(data.online)return `<span class="v20-source-pill online">● Online semantic assessment</span>`;
  if(response.onlineAssessmentStatus==='failed'||response.onlineAssessmentStatus==='unavailable')return '<span class="v20-source-pill fallback">Local fallback · online unavailable</span>';
  if(!navigator.onLine)return '<span class="v20-source-pill fallback">Offline local estimate</span>';
  return '<span class="v20-source-pill fallback">Local estimate</span>';
}
function listHtml(items,empty,kind='ok'){return `<ul>${(items.length?items:[empty]).map(x=>`<li class="${kind}">${kind==='ok'?'✓':kind==='warn'?'!':'•'} ${esc(typeof x==='string'?x:(x.label||x.reason||''))}</li>`).join('')}</ul>`}

comparisonPanel=function v20ComparisonPanel(seg,response){
  const data=feedbackData(response,seg);const transcript=sourceTranscript(response);const sample=seg.sampleAnswer||seg.model||'';
  const lang=arr(data.languageImprovements);const points=arr(data.meaningPoints).length?arr(data.meaningPoints):arr(seg.comparisonPoints).slice(0,6).map(x=>({label:x,status:'review'}));
  const target=targetLanguageForSegment(seg),targetName=languageName(target),sourceName=languageName(seg.sourceLanguage);
  const statusText=data.wrongTargetLanguage?`Wrong target language — ${targetName} required`:resultStatusLabel(data.status);
  const missing=arr(data.missingOrUnclear);
  const languageUse=data.targetLanguageUse||{};
  const compliance=languageUse.compliance===null||languageUse.compliance===undefined?'—':`${Math.round(Number(languageUse.compliance)||0)}%`;
  const assessmentBusy=response.onlineAssessmentStatus==='preparing'||response.onlineAssessmentStatus==='processing';
  const assessmentBusyTitle=response.onlineAssessmentStatus==='preparing'?'Preparing online assessment…':'Assessing your interpretation…';
  const assessmentBusyDetail=response.onlineAssessmentStatus==='preparing'?'Preparing the transcript and secure assessment request.':'Checking meaning transfer and critical details.';
  return `<section class="comparison-panel v20-feedback">
    ${assessmentBusy?`<div class="v20-assessment-processing" role="status" aria-live="polite"><i class="v20-assessment-spinner" aria-hidden="true"></i><div><b>${assessmentBusyTitle}</b><span>${assessmentBusyDetail}</span></div></div>`:''}
    <div class="v20-feedback-head"><div><small>ASSESSMENT & IMPROVEMENT</small><h3>${esc(statusText)}</h3>${assessmentLabel(response,data)}</div><div class="v20-score ${data.wrongTargetLanguage?'wrong-language':''}">${data.wrongTargetLanguage?`<strong>Wrong language</strong><span>interpretation required in ${esc(targetName)}</span>`:`<strong>${data.meaningTransfer||0}%</strong><span>estimated meaning transfer</span>`}</div></div>
    ${data.wrongTargetLanguage?`<div class="v20-language-alert" role="alert"><b>${esc(targetName)} interpretation required</b><span>The response was predominantly ${esc(languageName(languageUse.detectedPrimaryLanguage||seg.sourceLanguage)||sourceName)}. The meaning may be understood, but it was not transferred into the required target language.${Number.isFinite(Number(data.meaningTransfer))?` Semantic meaning recognised: ${Math.round(Number(data.meaningTransfer))}%.`:''}</span></div>`:''}
    ${response.onlineAssessmentStatus==='failed'&&onlineAssessmentEnabled()?`<div class="v20-service-note">${esc(response.onlineAssessmentError||'Online assessment is unavailable.')} <button data-action="v20-retry-assessment">Retry online</button></div>`:''}
    <div class="v20-summary-grid"><div><b>${criticalSummary(data)}</b><span>critical details</span></div><div><b>${esc(compliance)}</b><span>target-language use</span></div><div><b>${esc(data.delivery?.rating||'—')}</b><span>delivery</span></div><div><b>${data.online?Math.round((data.confidence||0)*100)+'%':'Local'}</b><span>${data.online?'assessment confidence':'fallback check'}</span></div></div>

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
  return `<details class="segment-result ${esc(data.status||'unassessed')}" ${open}><summary><span class="result-dot ${esc(data.status||'unassessed')}"></span><div><b>Segment ${i+1} · ${directionLabel(seg)}</b><small>${data.meaningTransfer}% meaning transfer · ${data.online?'online':'local fallback'}</small></div><i>⌄</i></summary><div class="segment-detail v20-report-segment"><div><h4>Original</h4><p>${esc(seg.source)}</p><button data-action="speak-text" data-text="${encodeURIComponent(seg.source)}" data-lang="${seg.sourceLanguage}" data-speaker="${esc(seg.speaker||'general')}">🔊 Play source</button></div><div><h4>Your response</h4><p>${esc(transcript||'Transcript unavailable — replay your audio.')}</p>${res.recordingUrl?`<audio controls src="${esc(res.recordingUrl)}"></audio>`:''}</div><div><h4>Meaning review</h4>${listHtml(arr(data.meaningPreserved),'No preserved point identified.','ok')}${listHtml(arr(data.missingOrUnclear),'No important meaning loss identified.','warn')}</div><div><h4>Short notes</h4><p class="notes">${esc(data.shortNotes||compactNotes(seg))}</p><p class="notes"><b>Improve:</b> ${esc(arr(data.nextSteps)[0]||data.noteTip||'Repeat naturally and preserve every critical detail.')}</p></div></div></details>`;
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
  return shell(`${header('APS NAATI CCL Practice','English ↔ Hindi preparation')}
  <section class="v20-home-hero"><div><small>YOUR NEXT STEP</small><h2>${next?esc(next.title):'Continue your preparation'}</h2><p>${next?esc(next.situation||'Continue dialogue practice and meaning-first review.'):'Your learning records are ready.'}</p><div class="actions">${next?button('Continue dialogue →','open-dialogue','primary',`data-id="${next.id}" data-mode="learning"`):''}${button('Open Practice','tab','secondary','data-id="practice"')}</div></div><div class="v20-online-card ${online?'online':'offline'}"><b>${online?'● Online':'○ Offline'}</b><span>${online?'Cloud sync and online assessment available':'Cached learning remains available'}</span></div></section>
  <section class="v20-today"><article><small>REVIEW</small><strong>${mistakes}</strong><span>weak segments to revisit</span><button data-action="tab" data-id="review">Review now</button></article><article><small>MY VOCABS</small><strong>${my.all}</strong><span>${my.review} need review</span><button data-action="open-my-vocabs">Open sheet</button></article><article><small>LATEST RESULT</small><strong>${last?.report?`${last.report.low}–${last.report.high}`:'—'}</strong><span>${last?.report?'estimated /45':'complete a dialogue'}</span><button data-action="tab" data-id="progress">View progress</button></article></section>
  <section class="v20-main-actions"><button data-action="tab" data-id="learn"><b>Learn</b><span>Vocabulary, phrases, My Vocabs and lessons</span></button><button data-action="tab" data-id="practice"><b>Practice</b><span>Verified Practice, Original Source and Mock Test</span></button><button data-action="tab" data-id="review"><b>Review</b><span>Mistakes, reports and weak segments</span></button><button data-action="tab" data-id="progress"><b>Progress</b><span>Completion, attempts and improvement</span></button></section>
  <div class="warning">Independent preparation app. All scores are estimated learning feedback, not official NAATI results.</div>`);
};

function reviewPage(){
  const mistakes=getJSON(storageKeys.mistakes,[]),active=mistakes.filter(x=>!x.mastered).slice(-30).reverse();
  const attempts=getJSON(storageKeys.attempts,[]).filter(x=>x.finished).slice(-12).reverse();
  return shell(`${header('Review','')}
  <section class="v20-review-summary"><div><strong>${active.length}</strong><span>weak segments</span></div><div><strong>${attempts.length}</strong><span>recent reports</span></div><div><strong>${myVocabCounts().review}</strong><span>My Vocabs to review</span></div></section>
  <section class="dashboard-grid"><article class="card"><small>MISTAKE NOTEBOOK</small><h3>Fix the meaning that was missed</h3>${active.length?`<div class="mistake-list">${active.map(m=>`<div><span class="result-dot ${esc(m.status||'review')}"></span><p><b>${esc(m.dialogueTitle)} · Segment ${m.segmentNumber}</b><small>${esc(arr(m.review).slice(0,2).join(' · ')||'Review this segment')}</small></p><button data-action="open-dialogue" data-id="${esc(m.dialogueId)}" data-mode="learning">Practise</button></div>`).join('')}</div>`:'<p class="muted">No weak segments are waiting for review.</p>'}</article>
  <article class="card"><small>RECENT REPORTS</small><h3>Compare your attempts</h3>${attempts.length?`<div class="attempts">${attempts.map(a=>`<button data-action="open-saved-report" data-id="${esc(a.id)}"><strong>${esc(a.title)}</strong><span>${a.report?.low??'—'}–${a.report?.high??'—'} /45</span><small>${new Date(a.finishedAt).toLocaleString()}</small></button>`).join('')}</div>`:'<p class="muted">Complete a dialogue to create a report.</p>'}</article></section>
  <section class="card v20-review-actions"><small>QUICK REVIEW</small><h3>Choose what to revise</h3><div class="actions"><button class="primary" data-action="open-my-vocabs">My Vocabs</button><button class="secondary" data-action="tab" data-id="learn">Vocabulary & Phrases</button><button class="secondary" data-action="tab" data-id="practice">Dialogue Practice</button></div></section>`);
}

const basePracticeV20=practice;
practice=function v20Practice(){
  let html=basePracticeV20();
  const tools=`<section class="v20-practice-modes v20-2-practice-modes"><button class="active" aria-current="page"><b>▶ Dialogue</b><span>Learn or practise</span></button><button data-action="v20-open-mock"><b>⏱ Mock Test</b><span>Two dialogues</span></button></section>`;
  if(html.includes('class="v18-library-tabs"')) return html.replace(/(<section class="v18-library-tabs"[\s\S]*?<\/section>)/,'$1'+tools);
  return html.replace('</header>','</header>'+tools);
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
  try{const r=await fetch('./version.json',{cache:'no-store'});if(!r.ok)return;const v=await r.json();state.v20.contentFresh=String(v.version||'').startsWith('20.');state.v20.lastCheck=new Date().toISOString();}catch{}
}
setTimeout(checkFreshness,1000);setInterval(checkFreshness,5*60*1000);

// V20 actions are handled in capture phase so the older handler can safely ignore them.
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
  if(a==='v20-open-mock'){event.preventDefault();state.tab='mock';render();}
  else if(a==='toggle-response-transcript'){
    event.preventDefault();
    event.stopPropagation();
    const r=state.responses[state.segmentIndex],seg=getActiveSegments()[state.segmentIndex];
    if(!r)return showToast('Record an answer before reviewing.');
    if(r.showTranscript){r.showTranscript=false;render();return;}
    r.showTranscript=true;
    if(r.onlineAssessment){r.onlineAssessmentStatus='completed';render();return;}
    if(!onlineAssessmentEnabled()){r.onlineAssessmentStatus='disabled';render();return;}
    void requestAssessmentForReview(seg,r);
  }
  else if(a==='v20-toggle-sample'){event.preventDefault();const r=state.responses[state.segmentIndex];if(r){r.showV20Sample=!r.showV20Sample;render();}}
  else if(a==='v20-toggle-note-tip'){event.preventDefault();const r=state.responses[state.segmentIndex];if(r){r.showV20NoteTip=!r.showV20NoteTip;render();}}
  else if(a==='v20-retry-assessment'){event.preventDefault();if(!onlineAssessmentEnabled())return showToast('Turn on Online assessment in Settings → Study first.');const r=state.responses[state.segmentIndex],seg=getActiveSegments()[state.segmentIndex];if(r&&seg){r.__v20AssessmentPromise=requestOnlineAssessment(seg,r,{force:true}).finally(()=>{r.__v20AssessmentPromise=null;});}}
},true);

document.addEventListener('change',event=>{
  if(event.target?.id!=='v20OnlineAssessmentEnabled')return;
  const enabled=Boolean(event.target.checked);setOnlineAssessmentEnabled(enabled);
  if(!enabled){
    for(const response of state.responses||[]){
      if(response&&!response.onlineAssessment)response.onlineAssessmentStatus='disabled';
    }
    showToast('Online assessment turned off');render();return;
  }
  for(const response of state.responses||[]){
    if(response&&!response.onlineAssessment&&response.onlineAssessmentStatus==='disabled')response.onlineAssessmentStatus='ready';
  }
  showToast('Online assessment turned on · tap Review when you want assessment');
  render();
},true);

window.APSOnlineV20={version:VERSION,requestOnlineAssessment,requestAssessmentForReview,feedbackData,config:ONLINE_CONFIG,onlineAssessmentEnabled,setOnlineAssessmentEnabled};
console.info(`${VERSION} loaded · Review-triggered online semantic feedback · cache-first fallback · simplified Home/Review/Practice organisation.`);
})();
