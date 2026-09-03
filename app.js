'use strict';

const app=document.querySelector('#app');
const topicLabels={all:'All topics',health:'Health',housing:'Housing & tenancy',education:'Education & childcare',employment:'Employment',immigration:'Immigration & settlement',legal:'Legal & police',banking:'Banking, tax & finance',insurance:'Insurance',social:'Centrelink & social support',consumer:'Consumer affairs',transport:'Transport & licensing',business:'Business',travel:'Travel & customs',family:'Family & registration',utilities:'Utilities',community:'Community services'};
const statusLabels={new:'New / Unknown',learning:'Learning',again:'Listen Again',known:'Known'};
const statusIcons={new:'✦',learning:'↗',again:'↻',known:'✓'};
const modeLabels={learning:'Learning Mode',practice:'Practice Mode',mock:'Mock Test'};
const storageKeys={onboard:'apsFinalOnboarded',vocabStatus:'apsFinalVocabStatus',vocabSettings:'apsFinalVocabSettings',vocabResume:'apsFinalVocabResume',attempts:'apsFinalAttempts',lesson:'apsFinalLesson',mistakes:'apsFinalMistakes',phraseStats:'apsFinalPhraseStats',dialogueVocabProgress:'apsDialogueVocabProgressV1:hi',authChoice:'apsAuthChoiceMade',authProfile:'apsAuthProfile',selectedLanguage:'apsSelectedLanguage',downloadedLanguages:'apsDownloadedLanguages',myVocabs:'apsMyVocabsV1:hi'};

const state={
  ready:false,dialogues:[],vocab:[],phrases:[],exam:null,lessonData:null,languageCatalog:[],selectedLanguage:null,languagePack:null,languageQuery:'',
  tab:'home',overlay:null,modal:null,toast:'',
  lesson:{chapter:0,slide:0,playing:false,lang:'bilingual',rate:1,captions:true,quiz:false,quizIndex:0,quizAnswers:[]},
  learn:{type:'words',topic:'all',status:'all',completion:'all',query:'',page:1,pageSize:120,revealed:new Set()},
  practice:{topic:'all',difficulty:'all',query:'',review:'all',completion:'all'},
  mockPair:null,
  vocabPlayer:{queue:[],index:0,playing:false,token:0,gapRemaining:0,title:'All vocabulary',revealCurrent:false},
  vocabSettings:{rate:.9,rateEn:.9,rateHi:.9,translationDelay:1.5,gap:2,repeat:1,order:'sequential',reading:'en-hi',examples:true,speakMySynonyms:true,hideEnglish:false,hideHindi:false,voiceEn:'',voiceHi:'',dialogueVoiceEnS1:'',dialogueVoiceEnS2:'',dialogueVoiceHiS1:'',dialogueVoiceHiS2:''},
  dialogue:null,dialogueMode:'learning',segmentIndex:0,responses:[],completed:new Set(),repeats:0,
  dialogueSettings:{rate:.9,gap:20,showSourceTranscript:false},
  playerStatus:'ready',countdown:0,timer:null,feedback:null,retryIds:null,
  recorder:null,stream:null,chunks:[],recording:false,recordingUrl:'',recordingBlob:null,recordingId:'',recordingError:'',recordingDuration:0,recordingMime:'',
  micStatus:'unknown',micError:'',speechRecognition:null,transcript:'',transcriptInterim:'',transcriptStatus:'idle',speechStartedAt:0,recordingStartedAt:0,
  mock:null,report:null,
  auth:{initialized:false,user:null,busy:false,error:'',emailMode:'signin',phoneStage:'number',verificationId:'',phone:''}
};

const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const getJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
const setJSON=(key,v)=>localStorage.setItem(key,JSON.stringify(v));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const normaliseSearchText=(value='')=>String(value)
  .normalize('NFKC')
  .toLocaleLowerCase('en-AU')
  .replace(/[^\p{L}\p{N}]+/gu,' ')
  .replace(/\s+/g,' ')
  .trim();
const searchMatches=(haystack,query)=>{
  const h=normaliseSearchText(haystack),q=normaliseSearchText(query);
  if(!q)return true;
  if(h.includes(q))return true;
  return q.split(' ').filter(Boolean).every(token=>h.includes(token));
};


function firebaseAuthPlugin(){return window.Capacitor?.Plugins?.FirebaseAuthentication||null;}

function nativeCloudTranscriptionAvailable(){
  const plugin=firebaseAuthPlugin();
  const isNative=Boolean(window.Capacitor?.isNativePlatform?.());
  return Boolean(plugin&&isNative);
}

const LOCAL_FIREBASE_TEST={
  mode:'production',
  host:'10.0.0.37',
  authPort:9099,
  functionsPort:5001,
  projectId:'aps-naati-ccl-practice',
  region:'australia-southeast1',
  functionName:'transcribeAttempt',
  productionEndpoint:'https://australia-southeast1-aps-naati-ccl-practice.cloudfunctions.net/transcribeAttempt'
};

function isLocalFirebaseMode(){
  return LOCAL_FIREBASE_TEST.mode==='local';
}

let firebaseAuthEmulatorConfigured=false;

async function configureFirebaseAuthEmulator(){
  const plugin=firebaseAuthPlugin();
  if(!isLocalFirebaseMode()||!plugin||firebaseAuthEmulatorConfigured)return;

  await plugin.useEmulator({
    host:LOCAL_FIREBASE_TEST.host,
    port:LOCAL_FIREBASE_TEST.authPort
  });

  firebaseAuthEmulatorConfigured=true;
}
function describeFirebaseAuthError(error,stage){
  const parts=[`stage=${stage}`];

  if(error?.code)parts.push(`code=${error.code}`);
  if(error?.message)parts.push(`message=${error.message}`);
  if(error?.errorMessage)parts.push(`errorMessage=${error.errorMessage}`);
  if(error?.localizedDescription)parts.push(
    `localizedDescription=${error.localizedDescription}`
  );

  try{
    const details=JSON.stringify(
      error,
      Object.getOwnPropertyNames(error)
    );
    if(details&&details!=='{}'){
      parts.push(`details=${details.slice(0,1000)}`);
    }
  }catch{}

  return parts.join(' | ');
}

async function getFirebaseIdToken(){
  const plugin=firebaseAuthPlugin();

  if(!plugin){
    throw new Error(
      'stage=plugin | Firebase Authentication plugin is unavailable.'
    );
  }

  let current;

  try{
    current=await plugin.getCurrentUser();
  }catch(error){
    throw new Error(
      describeFirebaseAuthError(error,'getCurrentUser')
    );
  }

  if(!current?.user){
    throw new Error(
      'stage=getCurrentUser | No native Firebase user is signed in.'
    );
  }

  try{
    const result=await plugin.getIdToken();

    if(!result?.token){
      throw new Error('Firebase returned no ID token.');
    }

    return result.token;
  }catch(error){
    const code=String(error?.code||'');

    if(current.user.isAnonymous && code==='auth/internal-error'){
      try{
        await plugin.signOut();

        const freshSignIn=await plugin.signInAnonymously();

        if(!freshSignIn?.user){
          throw new Error(
            'Firebase did not return a fresh anonymous user.'
          );
        }

        const freshToken=await plugin.getIdToken();

        if(!freshToken?.token){
          throw new Error(
            'Firebase did not return a token for the fresh guest.'
          );
        }

        state.auth.user=normaliseAuthUser(freshSignIn.user);
        saveAuthProfile();

        return freshToken.token;
      }catch(repairError){
        throw new Error(
          'stage=anonymousSessionRepair | original='+
          describeFirebaseAuthError(error,'getIdToken')+
          ' | repair='+
          describeFirebaseAuthError(
            repairError,
            'signOut-signInAnonymously-getIdToken'
          )
        );
      }
    }

    throw new Error(
      describeFirebaseAuthError(error,'getIdToken')
    );
  }
}

function transcriptionEndpoint(){
  const c=LOCAL_FIREBASE_TEST;

  if(isLocalFirebaseMode()){
    return `http://${c.host}:${c.functionsPort}/${c.projectId}/${c.region}/${c.functionName}`;
  }

  if(!c.productionEndpoint){
    throw new Error(
      'Production transcription is not configured yet. No request was sent.'
    );
  }

  if(!c.productionEndpoint.startsWith('https://')){
    throw new Error(
      'Production transcription endpoint must use HTTPS. No request was sent.'
    );
  }

  return c.productionEndpoint;
}

async function transcribeRecordingWithBackend(blob,meta={}){
  if(!['local','production'].includes(LOCAL_FIREBASE_TEST.mode)){
    throw new Error('Invalid transcription runtime mode. No request was sent.');
  }
  if(!(blob instanceof Blob)||blob.size===0){
    throw new Error('A saved audio recording is required.');
  }

  const token=await getFirebaseIdToken();
  const form=new FormData();

  form.append('attemptId',meta.attemptId||`ios-local-${Date.now()}`);
  form.append('language',meta.language||'en-AU');

  if(meta.sourceLanguage)form.append('sourceLanguage',meta.sourceLanguage);
  if(meta.dialogueId)form.append('dialogueId',meta.dialogueId);
  if(meta.segmentId)form.append('segmentId',meta.segmentId);

  const extension=blob.type.includes('webm')?'webm':
    blob.type.includes('wav')?'wav':'m4a';

  form.append('audio',blob,`recording.${extension}`);

  const response=await fetch(transcriptionEndpoint(),{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`},
    body:form
  });

  const payload=await response.json().catch(()=>({}));

  if(!response.ok){
    throw new Error(
      payload?.message||
      payload?.error||
      `Transcription request failed (${response.status}).`
    );
  }

  return payload;
}

async function requestCloudTranscriptionForResponse(blob,seg,response){
  response.cloudTranscriptionStatus='processing';

  try{
    const language=targetLanguage(seg)==='hi'?'hi-IN':'en-AU';

    const result=await transcribeRecordingWithBackend(blob,{
      attemptId:response.recordingId,
      language,
      sourceLanguage:seg.sourceLanguage==='hi'?'hi-IN':'en-AU',
      dialogueId:state.dialogue?.id||'',
      segmentId:seg.id
    });

    const transcript=String(result.transcript||'').trim();

    response.cloudTranscript=transcript;
    response.cloudTranscriptionStatus='completed';
    response.cloudTranscriptionProvider=result.provider||'';
    response.cloudTranscriptionWarnings=result.warnings||[];

    if(transcript){
      response.deviceTranscript=
        response.deviceTranscript||response.transcript||'';

      // Reports can display the verified cloud transcript.
      response.transcript=transcript;
      response.transcriptSource='cloud';

      // Local comparison only. This does not make another AI request and
      // remains separate from the final scoring assessment.
      try{
        response.practiceComparison=APSScoring.assessSegment(
          seg,
          transcript,
          {startDelay:Number(response.startDelay||0)}
        );
        response.practiceComparisonSource='cloud-transcript-local-v1';
      }catch(error){
        response.practiceComparison=null;
        response.practiceComparisonError=
          error?.message||'Practice comparison could not be generated.';
      }
    }
  }catch(error){
    response.cloudTranscriptionStatus='failed';
    response.cloudTranscriptionError=
      error?.message||'Cloud transcription failed.';
  }
}

function normaliseAuthUser(user){
  if(!user)return null;
  return {uid:user.uid||'',displayName:user.displayName||'',email:user.email||'',phoneNumber:user.phoneNumber||'',photoUrl:user.photoUrl||user.photoURL||'',isAnonymous:Boolean(user.isAnonymous),providerId:user.providerId||''};
}
function authDisplayName(){const u=state.auth.user;if(!u)return 'Not signed in';if(u.isAnonymous)return 'Guest account';return u.displayName||u.email||u.phoneNumber||'APS learner';}
function authProviderLabel(){const u=state.auth.user;if(!u)return 'Local only';if(u.isAnonymous)return 'Guest';if(u.providerId?.includes('google'))return 'Google';if(u.providerId?.includes('apple'))return 'Apple';if(u.phoneNumber)return 'Phone';if(u.email)return 'Email';return 'Signed in';}
function saveAuthProfile(){setJSON(storageKeys.authProfile,state.auth.user||{});}
async function initAuth(){
  const plugin=firebaseAuthPlugin();
  try{
    await configureFirebaseAuthEmulator();
    if(plugin){const result=await plugin.getCurrentUser();state.auth.user=normaliseAuthUser(result?.user);}
    else state.auth.user=normaliseAuthUser(getJSON(storageKeys.authProfile,null));
  }catch(e){state.auth.error=e?.message||'Authentication could not be checked.';state.auth.user=normaliseAuthUser(getJSON(storageKeys.authProfile,null));}
  state.auth.initialized=true;saveAuthProfile();
}
async function runAuth(action,payload={}){
  const plugin=firebaseAuthPlugin();
  await configureFirebaseAuthEmulator();
  if(!plugin&&action!=='guest')throw new Error('Native sign-in is available in the installed iPhone app.');
  if(action==='guest')return plugin?plugin.signInAnonymously():{user:{uid:'local-guest',isAnonymous:true}};
  if(action==='apple')return plugin.signInWithApple();
  if(action==='google')return plugin.signInWithGoogle();
  if(action==='email-signin')return plugin.signInWithEmailAndPassword(payload);
  if(action==='email-create')return plugin.createUserWithEmailAndPassword(payload);
  if(action==='phone-start')return plugin.signInWithPhoneNumber(payload);
  if(action==='phone-confirm')return plugin.confirmVerificationCode(payload);
  if(action==='signout')return plugin?plugin.signOut():null;
  if(action==='delete')return plugin?plugin.deleteUser():null;
  throw new Error('Unsupported sign-in action.');
}
async function completeAuth(action,payload={}){
  state.auth.busy=true;state.auth.error='';render();
  try{
    const result=await runAuth(action,payload);
    if(action==='phone-start'){
      state.auth.verificationId=result?.verificationId||'';state.auth.phoneStage='code';state.auth.busy=false;render();return;
    }
    state.auth.user=normaliseAuthUser(result?.user)||state.auth.user;
    if(!state.auth.user&&firebaseAuthPlugin()){const current=await firebaseAuthPlugin().getCurrentUser();state.auth.user=normaliseAuthUser(current?.user);}
    localStorage.setItem(storageKeys.authChoice,'1');saveAuthProfile();state.auth.busy=false;state.modal=null;
    showToast(state.auth.user?.isAnonymous?'Continuing as guest':'Signed in successfully');
  }catch(e){state.auth.busy=false;state.auth.error=e?.message||'Sign-in did not complete.';render();}
}
function authWelcome(){
  return `<div class="auth-screen"><div class="auth-card"><div class="brand big">APS</div><small>MULTILINGUAL CCL PREPARATION</small><h1>APS NAATI CCL Practice</h1><p>Sign in to identify your account across devices, or continue as a guest. Your existing progress on this device will be kept.</p>${state.auth.error?`<div class="auth-error">${esc(state.auth.error)}</div>`:''}<div class="auth-actions"><button class="auth-apple" data-action="auth-apple"> Continue with Apple</button><button class="auth-google" data-action="auth-google">G Continue with Google</button><button data-action="auth-email">Continue with Email</button><button data-action="auth-phone">Continue with Phone</button><button class="auth-guest" data-action="auth-guest">Continue as Guest</button></div><div class="auth-note">Recordings remain on this device unless a future cloud-backup option is enabled. By continuing, you agree to the Terms and Privacy Policy.</div>${state.auth.busy?'<div class="auth-busy">Please wait…</div>':''}</div>${renderModal()}</div>`;
}

function languageSelectionScreen(){
  const q=state.languageQuery.trim().toLowerCase();
  const list=state.languageCatalog.filter(x=>!q||`${x.name} ${x.nativeName} ${x.pairLabel}`.toLowerCase().includes(q));
  return `<div class="language-screen"><div class="language-card"><div class="brand big">APS</div><small>CHOOSE YOUR CCL LANGUAGE</small><h1>Which language are you preparing for?</h1><p>Your selected language pack controls the dialogues, segments, vocabulary, phrases, sample answers, voices and progress shown in the app.</p><label class="language-search">Search languages<input id="languageSearch" type="search" placeholder="Search Hindi, Punjabi, Urdu…" value="${esc(state.languageQuery)}"></label><div class="language-list">${list.map(x=>`<button class="language-option ${x.status==='available'?'available':'coming'}" data-action="select-language" data-language="${esc(x.id)}" ${x.status==='available'?'':'disabled'}><span class="language-native">${esc(x.nativeName)}</span><span><b>${esc(x.name)}</b><small>${esc(x.pairLabel||'')}</small></span><em>${x.status==='available'?'Available':'Coming soon'}</em></button>`).join('')||'<p class="empty">No languages match your search.</p>'}</div><div class="language-note">Only professionally reviewed language packs will be released. You can add or change languages later without losing progress.</div></div></div>`;
}
async function chooseLanguage(languageId){
  try{app.innerHTML='<div class="loading">Preparing your language pack…</div>';await loadLanguagePack(languageId);render();showToast(`${state.languagePack.name} preparation pack is ready`);}catch(e){state.auth.error=e?.message||'Language pack could not be loaded.';render();}
}

function normaliseVocabSettings(raw={}){
  const v=state.vocabSettings,legacyRate=Number(raw.rate ?? v.rate)||.9;
  if(raw.rateEn===undefined&&raw.rate!==undefined)v.rateEn=legacyRate;
  if(raw.rateHi===undefined&&raw.rate!==undefined)v.rateHi=legacyRate;
  if(!Number.isFinite(Number(v.rateEn)))v.rateEn=legacyRate;
  if(!Number.isFinite(Number(v.rateHi)))v.rateHi=legacyRate;
  v.rateEn=clamp(Number(v.rateEn)||.9,.5,1.5);v.rateHi=clamp(Number(v.rateHi)||.9,.5,1.5);
  v.translationDelay=clamp(Number(v.translationDelay ?? 1.5),0,10);
  v.gap=clamp(Number(v.gap ?? 2),0,30);v.repeat=clamp(Number(v.repeat)||1,1,5);
  if(v.reading==='both')v.reading='en-hi';
  if(!['en-hi','hi-en','english','hindi'].includes(v.reading))v.reading='en-hi';
  if(!['sequential','random'].includes(v.order))v.order='sequential';
  v.examples=v.examples!==false;
  v.speakMySynonyms=v.speakMySynonyms!==false;
  v.hideEnglish=v.hideEnglish===true;
  v.hideHindi=v.hideHindi===true;
}

async function loadLanguagePack(languageId){
  const language=state.languageCatalog.find(x=>x.id===languageId&&x.status==='available');
  if(!language||!language.files)throw new Error('This language pack is not available yet.');
  const [dialogues,vocab,phrases]=await Promise.all([
    fetch(language.files.dialogues,{cache:'default'}).then(r=>{if(!r.ok)throw new Error('Dialogue pack could not be loaded.');return r.json();}),
    fetch(language.files.vocabulary,{cache:'default'}).then(r=>{if(!r.ok)throw new Error('Vocabulary pack could not be loaded.');return r.json();}),
    fetch(language.files.phrases,{cache:'default'}).then(r=>{if(!r.ok)throw new Error('Phrase pack could not be loaded.');return r.json();})
  ]);
  Object.assign(state,{dialogues,vocab:vocab.items||[],phrases:phrases.items||[],selectedLanguage:languageId,languagePack:language});
  localStorage.setItem(storageKeys.selectedLanguage,languageId);
  const downloaded=new Set(getJSON(storageKeys.downloadedLanguages,[]));downloaded.add(languageId);setJSON(storageKeys.downloadedLanguages,[...downloaded]);
}
async function loadData(){
  try{
    const [catalog,exam,lessonData]=await Promise.all([
      fetch('./content/languages.json').then(r=>r.json()),fetch('./content/exam_info.json').then(r=>r.json()),fetch('./content/lesson0.json').then(r=>r.json())
    ]);
    Object.assign(state,{languageCatalog:catalog.languages||[],exam,lessonData});
    let selected=localStorage.getItem(storageKeys.selectedLanguage);
    if(!selected&&localStorage.getItem(storageKeys.onboard)==='1')selected='hi';
    if(selected)await loadLanguagePack(selected);
    state.ready=true;
    const storedVocabSettings=getJSON(storageKeys.vocabSettings,{});Object.assign(state.vocabSettings,storedVocabSettings);normaliseVocabSettings(storedVocabSettings);
    await initAuth();applyQAState();render();
  }catch(e){app.innerHTML=`<div class="fatal"><h1>App could not load</h1><p>${esc(e.message)}</p><p>Keep the Terminal server open and refresh this page.</p></div>`;}
}

function applyQAState(){
  const qa=window.__APS_QA||new URLSearchParams(location.search).get('qa');
  if(!qa)return;
  localStorage.setItem(storageKeys.onboard,'1');
  if(qa==='learn')state.tab='learn';
  if(qa==='lesson'){state.overlay='lesson';state.lesson.chapter=2;state.lesson.slide=1;}
  if(qa==='vocab-player'){state.learn.status='new';startVocabularyPlaylist(false);}
  if(qa==='dialogue'){openDialogue(state.dialogues[0].id,'learning',false);}
  if(qa==='answer-review'){
    const d=state.dialogues.find(x=>x.title==='Milk Plant Business')||state.dialogues[0];openDialogue(d.id,'practice',false);
    const seg=d.segments[0];state.responses[0]={segmentId:seg.id,transcript:'धन्यवाद, अपने व्यस्त कार्यक्रम में से समय निकालकर आज यहाँ आने के लिए। कृपया बैठिए। क्या आप कुछ पीना चाहेंगी?',recordingId:'',recordingUrl:'',showTranscript:true,startDelay:2.4,duration:13,assessment:{status:'excellent',coverage:1,deduction:0,captured:[],review:[],critical:[],units:[],strengths:['Main meaning preserved','Offer and invitation included'],advice:[]}};state.completed.add(seg.id);state.playerStatus='complete';
  }
  if(qa==='report')loadQADialogueReport();
}

function nav(){
  return `<nav class="bottom-nav" aria-label="Main navigation">${[
    ['home','⌂','Home'],['learn','A','Learn'],['practice','▶','Practice'],['mock','✓','Mock Test'],['progress','▥','Progress']
  ].map(([id,icon,label])=>`<button data-action="tab" data-id="${id}" class="${state.tab===id?'active':''}"><b>${icon}</b><span>${label}</span></button>`).join('')}</nav>`;
}
function header(title,subtitle=''){return `<header class="app-header"><div class="brand">APS</div><div class="header-copy"><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="header-tools">${navigator.onLine?'':'<span class="offline">Offline</span>'}<button class="header-search" data-action="global-search" type="button" aria-label="Search all Hindi material" aria-expanded="false"><span aria-hidden="true">⌕</span><b>Search</b></button><button class="header-settings" data-action="app-settings" aria-label="Open settings"><span aria-hidden="true">⚙</span><b>Settings</b></button></div></header>`;}
function shell(content){return `<main class="page">${content}</main>${nav()}${state.toast?`<div class="toast">${esc(state.toast)}</div>`:''}${renderModal()}`;}
function button(label,action,cls='primary',extra=''){return `<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;}
function topicOptions(selected){return Object.entries(topicLabels).map(([id,l])=>`<option value="${id}" ${id===selected?'selected':''}>${l}</option>`).join('');}
function statusOptions(selected){return `<option value="all" ${selected==='all'?'selected':''}>All statuses</option>${Object.entries(statusLabels).map(([id,l])=>`<option value="${id}" ${id===selected?'selected':''}>${l}</option>`).join('')}`;}
function currentItems(){return state.learn.type==='words'?state.vocab:state.phrases;}
function allVocabItems(){return [...state.vocab.map(x=>({...x,itemType:'word'})),...state.phrases.map(x=>({...x,itemType:'phrase'}))];}
function statusMap(){return getJSON(storageKeys.vocabStatus,{});}
function itemStatus(id){return statusMap()[id]||'new';}
function setItemStatus(id,status){const m=statusMap();m[id]=status;setJSON(storageKeys.vocabStatus,m);render();}
function phraseStatsMap(){return getJSON(storageKeys.phraseStats,{});}
function phrasePracticeInfo(id){const x=phraseStatsMap()[id]||{};return {practiceCount:Number(x.practiceCount)||0,completed:Boolean(x.completed),lastPractisedAt:x.lastPractisedAt||''};}
function recordPhrasePractice(id){
  if(!id||!state.phrases.some(x=>x.id===id))return;
  const m=phraseStatsMap(),now=new Date().toISOString(),x=m[id]||{};
  m[id]={practiceCount:(Number(x.practiceCount)||0)+1,completed:true,firstCompletedAt:x.firstCompletedAt||now,lastPractisedAt:now};
  setJSON(storageKeys.phraseStats,m);
}
function phraseTotals(){
  const m=phraseStatsMap();let completed=0,totalPractices=0;
  state.phrases.forEach(x=>{const r=m[x.id];if(r?.completed)completed++;totalPractices+=Number(r?.practiceCount)||0;});
  return {completed,remaining:Math.max(0,state.phrases.length-completed),totalPractices};
}
function dialogueStatsMap(){
  const m={};
  getJSON(storageKeys.attempts,[]).filter(a=>a.finished&&a.dialogueId).forEach(a=>{
    const x=m[a.dialogueId]||{practiceCount:0,lastPractisedAt:'',bestLow:null,bestHigh:null,modes:{}};
    x.practiceCount++;x.lastPractisedAt=a.finishedAt||a.startedAt||x.lastPractisedAt;x.modes[a.mode||'practice']=(x.modes[a.mode||'practice']||0)+1;
    if(a.report){x.bestLow=x.bestLow===null?Number(a.report.low):Math.max(x.bestLow,Number(a.report.low));x.bestHigh=x.bestHigh===null?Number(a.report.high):Math.max(x.bestHigh,Number(a.report.high));}
    m[a.dialogueId]=x;
  });
  return m;
}
function dialogueTotals(){const m=dialogueStatsMap(),completed=state.dialogues.filter(d=>(m[d.id]?.practiceCount||0)>0).length,totalPractices=Object.values(m).reduce((n,x)=>n+(x.practiceCount||0),0);return {completed,remaining:Math.max(0,state.dialogues.length-completed),totalPractices};}
function filteredLearnItems(noLimit=false){
  const items=currentItems(),q=state.learn.query.trim().toLowerCase();
  const out=items.filter(x=>{
    const completionOk=state.learn.type!=='phrases'||state.learn.completion==='all'||(state.learn.completion==='completed'?phrasePracticeInfo(x.id).completed:!phrasePracticeInfo(x.id).completed);
    return (state.learn.topic==='all'||x.topic===state.learn.topic)&&(state.learn.status==='all'||itemStatus(x.id)===state.learn.status)&&completionOk&&(!q||`${x.english} ${x.hindi}`.toLowerCase().includes(q));
  });
  if(noLimit)return out;
  const pageSize=Number(state.learn.pageSize)||120,totalPages=Math.max(1,Math.ceil(out.length/pageSize));
  state.learn.page=clamp(Number(state.learn.page)||1,1,totalPages);
  const start=(state.learn.page-1)*pageSize;
  return out.slice(start,start+pageSize);
}
function learnPagination(total){
  const pageSize=Number(state.learn.pageSize)||120,totalPages=Math.max(1,Math.ceil(total/pageSize)),page=clamp(Number(state.learn.page)||1,1,totalPages);
  if(totalPages<=1)return '';
  const options=Array.from({length:totalPages},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===page?'selected':''}>${n}</option>`).join('');
  return `<nav class="learn-pagination" aria-label="${state.learn.type==='words'?'Vocabulary':'Phrase'} pages"><button data-action="learn-page-prev" ${page<=1?'disabled':''}>← Previous</button><div><span>Page</span><select id="learnPageSelect" aria-label="Select page">${options}</select><span>of ${totalPages}</span></div><button data-action="learn-page-next" ${page>=totalPages?'disabled':''}>Next →</button></nav>`;
}
function changeLearnPage(deltaOrPage,isAbsolute=false){
  const total=filteredLearnItems(true).length,pageSize=Number(state.learn.pageSize)||120,totalPages=Math.max(1,Math.ceil(total/pageSize));
  state.learn.page=clamp(isAbsolute?Number(deltaOrPage):(Number(state.learn.page)||1)+Number(deltaOrPage),1,totalPages);
  render();
  requestAnimationFrame(()=>document.querySelector('.filter-panel')?.scrollIntoView({behavior:'smooth',block:'start'}));
}

function home(){
  const attempts=getJSON(storageKeys.attempts,[]),lessonProgress=getJSON(storageKeys.lesson,{chapter:0,completed:false});
  const last=attempts.at(-1);
  return shell(`${header('APS NAATI CCL Practice','English ↔ Hindi preparation')}
  <section class="hero"><div><span>MEANING-FIRST CCL TRAINING</span><h2>Learn correctly. Practise naturally. Improve every mark.</h2><p>Vocabulary playlists, narrated exam training, recorded dialogue practice and detailed improvement reports.</p><div class="hero-actions">${button(lessonProgress.completed?'Review Lesson 0':'Start Lesson 0 →','open-lesson')}${button('Start a dialogue','quick-dialogue','secondary')}</div></div><div class="hero-score"><strong>${last?.report?`${last.report.low}–${last.report.high}`:'—'}</strong><span>${last?.report?'latest dialogue estimate':'complete a dialogue'}</span></div></section>
  <section class="stats">${[[state.vocab.length.toLocaleString(),'vocabulary cards'],[state.phrases.length.toLocaleString(),'phrases'],[state.dialogues.length,'dialogues'],[state.dialogues.reduce((n,d)=>n+d.segments.length,0).toLocaleString(),'practice segments']].map(([v,l])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</section>
  <section class="dashboard-grid">
   <article class="card"><small>TODAY’S LEARNING PATH</small><h3>Word → Phrase → Segment → Dialogue</h3><div class="path"><button data-action="tab" data-id="learn"><b>1</b><span><strong>Vocabulary player</strong><em>Filter, listen and change word status.</em></span>›</button><button data-action="quick-dialogue"><b>2</b><span><strong>Guided dialogue</strong><em>Record, review and retry mistakes.</em></span>›</button><button data-action="start-mock"><b>3</b><span><strong>Full mock</strong><em>Two dialogues with pass logic.</em></span>›</button></div></article>
   <article class="card"><small>HOW RESULTS TEACH YOU</small><h3>Every mark explains the next step</h3><ul class="check-list"><li>See what meaning you preserved</li><li>Open every possible deduction</li><li>Replay your recording and source</li><li>Retry only weak segments</li><li>Compare improvement over attempts</li></ul></article>
  </section>
  <div class="warning">Independent preparation app. Estimated feedback is not an official NAATI result.</div>`);
}

function learn(){
  const allItems=filteredLearnItems(true),pageSize=Number(state.learn.pageSize)||120,totalPages=Math.max(1,Math.ceil(allItems.length/pageSize));
  state.learn.page=clamp(Number(state.learn.page)||1,1,totalPages);
  const start=(state.learn.page-1)*pageSize,items=allItems.slice(start,start+pageSize),shownFrom=allItems.length?start+1:0,shownTo=Math.min(start+items.length,allItems.length);
  const counts={};Object.keys(statusLabels).forEach(s=>counts[s]=currentItems().filter(x=>itemStatus(x.id)===s).length);
  const pt=phraseTotals();
  const completionFilter=state.learn.type==='phrases'?`<select id="learnCompletion"><option value="all" ${state.learn.completion==='all'?'selected':''}>All phrases</option><option value="remaining" ${state.learn.completion==='remaining'?'selected':''}>Remaining</option><option value="completed" ${state.learn.completion==='completed'?'selected':''}>Completed</option></select>`:'';
  const phraseSummary=state.learn.type==='phrases'?`<section class="completion-summary"><div><strong>${pt.completed}</strong><span>completed phrases</span></div><div><strong>${pt.remaining}</strong><span>remaining phrases</span></div><div><strong>${pt.totalPractices}</strong><span>total phrase practices</span></div></section>`:'';
  return shell(`${header('Learn','Core CCL vocabulary and phrases')}
  <div class="segments"><button data-action="learn-type" data-id="words" class="${state.learn.type==='words'?'active':''}">Vocabulary <span>${state.vocab.length}</span></button><button data-action="learn-type" data-id="phrases" class="${state.learn.type==='phrases'?'active':''}">Phrases <span>${state.phrases.length}</span></button></div>
  ${state.learn.type==='words'?'<div class="info"><b>Vocabulary only:</b> this section now contains verified words and short multi-word terms. Complete dialogue sentences remain in the separate Phrases and Dialogue sections.</div>':phraseSummary}
  <section class="status-cards">${Object.entries(statusLabels).map(([id,label])=>`<button data-action="status-playlist" data-id="${id}" class="status-card ${id}"><b>${statusIcons[id]}</b><span><strong>${label}</strong><em>${counts[id]} ${state.learn.type==='words'?'words':'phrases'}</em></span><i>Play ›</i></button>`).join('')}</section>
  <section class="filter-panel"><div class="filter-row"><label class="search"><span>⌕</span><input id="learnQuery" placeholder="Search English or Hindi" value="${esc(state.learn.query)}"></label><select id="learnTopic">${topicOptions(state.learn.topic)}</select><select id="learnStatus">${statusOptions(state.learn.status)}</select>${completionFilter}</div><div class="filter-summary"><span>Showing ${shownFrom.toLocaleString()}–${shownTo.toLocaleString()} of ${allItems.length.toLocaleString()} · Page ${state.learn.page} of ${totalPages}</span>${button('▶ Play all current filters','play-current-filter','primary compact')}</div></section>
  ${learnPagination(allItems.length)}
  <div class="learn-grid">${items.map(item=>learnCard(item)).join('')||`<div class="empty wide-card"><h3>No matching items</h3><p>Change the topic, status, completion filter or search words.</p></div>`}</div>
  ${learnPagination(allItems.length)}
  <p class="status-note">Learning records are stored locally on this device and included in progress backups.</p>`);
}
function learnCard(item){
  const open=state.learn.revealed.has(item.id),st=itemStatus(item.id),isPhrase=state.learn.type==='phrases',pi=isPhrase?phrasePracticeInfo(item.id):null;
  const practiceBadge=isPhrase?`<span class="practice-badge ${pi.completed?'done':'remaining'}">${pi.completed?'✓ Completed':'○ Remaining'} · practised ${pi.practiceCount} ${pi.practiceCount===1?'time':'times'}</span>`:'';
  return `<article class="learn-card ${open?'open':''}"><div class="learn-top"><small>${topicLabels[item.topic]||'Community'} ${isPhrase?'· PHRASE':''}</small><span class="mini-status ${st}">${statusIcons[st]} ${statusLabels[st]}</span></div>${practiceBadge}<button class="card-main" data-action="reveal" data-id="${item.id}"><h3>${esc(item.english)}</h3><p>${open?esc(item.hindi):'Tap to reveal Hindi'}</p>${open&&item.exampleEnglish?`<div class="example"><b>Example</b>${esc(item.exampleEnglish)}<br><span>${esc(item.exampleHindi)}</span></div>`:''}</button><div class="card-actions"><button data-action="speak-item" data-id="${item.id}" data-type="${state.learn.type}">🔊 Play</button><button data-action="single-item-player" data-id="${item.id}" data-type="${state.learn.type}">Open player ›</button></div></article>`;
}

function dialogueSearchText(dialogue){
  const segmentText=(dialogue.segments||[]).flatMap(segment=>[
    segment.source,
    segment.model,
    segment.sampleAnswer,
    segment.noteHint,
    segment.contentStatus,
    ...(segment.acceptedAlternatives||[]),
    ...(segment.comparisonPoints||[]),
    ...((segment.meaningUnits||[]).flatMap(unit=>[
      unit.label,
      ...(unit.acceptedConcepts||[])
    ]))
  ]).filter(Boolean).join(' ');
  return [
    dialogue.id,
    dialogue.title,
    dialogue.situation,
    dialogue.topic,
    topicLabels[dialogue.topic]||'',
    dialogue.difficulty,
    dialogue.reviewStatus,
    segmentText
  ].filter(Boolean).join(' ');
}
function filteredDialogues(){
  const q=state.practice.query,records=dialogueStatsMap();
  return state.dialogues.filter(d=>{
    const done=(records[d.id]?.practiceCount||0)>0;
    const completionOk=state.practice.completion==='all'||(state.practice.completion==='completed'?done:!done);
    return (state.practice.topic==='all'||d.topic===state.practice.topic)&&
      (state.practice.difficulty==='all'||d.difficulty===state.practice.difficulty)&&
      (state.practice.review==='all'||(state.practice.review==='reviewed'?/human-edited/i.test(d.reviewStatus):!/human-edited/i.test(d.reviewStatus)))&&
      completionOk&&searchMatches(dialogueSearchText(d),q);
  });
}
function practice(){
  const list=filteredDialogues(),records=dialogueStatsMap(),totals=dialogueTotals();
  return shell(`${header('Dialogue Practice','All supplied dialogues with learning, practice and review modes')}
  <div class="info">The source transcript is <b>off by default</b>. Your completed-dialogue history and practice counts are saved automatically on this device.</div>
  <section class="completion-summary"><div><strong>${totals.completed}</strong><span>completed dialogues</span></div><div><strong>${totals.remaining}</strong><span>remaining dialogues</span></div><div><strong>${totals.totalPractices}</strong><span>total dialogue practices</span></div></section>
  <section class="dialogue-filter-panel"><div class="practice-search-row"><label class="search"><span aria-hidden="true">⌕</span><input id="practiceQuery" type="search" inputmode="search" autocomplete="off" aria-label="Search dialogue title, topic, English or Hindi" placeholder="Search title, topic, English or Hindi" value="${esc(state.practice.query)}"></label>${state.practice.query?button('Clear','clear-practice-search','secondary compact practice-clear'):''}</div><div class="practice-filter-row"><label><span>Topic</span><select id="practiceTopic">${topicOptions(state.practice.topic)}</select></label><label><span>Level</span><select id="practiceDifficulty"><option value="all">All levels</option>${['Foundation','Developing','Exam level'].map(x=>`<option value="${x}" ${state.practice.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>Content</span><select id="practiceReview"><option value="all">All content</option><option value="reviewed" ${state.practice.review==='reviewed'?'selected':''}>Human-edited set</option><option value="imported" ${state.practice.review==='imported'?'selected':''}>Imported library</option></select></label><label><span>Progress</span><select id="practiceCompletion"><option value="all" ${state.practice.completion==='all'?'selected':''}>All dialogues</option><option value="remaining" ${state.practice.completion==='remaining'?'selected':''}>Remaining</option><option value="completed" ${state.practice.completion==='completed'?'selected':''}>Completed</option></select></label></div></section>
  <div class="dialogue-count"><b>${list.length}</b> dialogues match the filters</div>
  <div class="dialogues">${list.map(d=>{const r=records[d.id]||{practiceCount:0};const done=r.practiceCount>0;return `<article class="dialogue-card"><div class="tags"><span>${topicLabels[d.topic]||'Community'}</span><em>${d.difficulty}</em></div><div class="dialogue-progress ${done?'done':'remaining'}"><b>${done?'✓ Completed':'○ Remaining'}</b><span>${done?`Practised ${r.practiceCount} ${r.practiceCount===1?'time':'times'}${r.bestLow!==null?` · best ${r.bestLow}–${r.bestHigh}/45`:''}`:'Not practised yet'}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.situation)}</p><div class="content-quality ${/human-edited/i.test(d.reviewStatus)?'reviewed':'imported'}">${/human-edited/i.test(d.reviewStatus)?'✓ Human-edited pilot content':'◇ Imported from your library · bilingual review recommended'}</div><div class="meta">${d.estimatedMinutes} min · ${d.segments.length} segments · Audio + recording${r.lastPractisedAt?` · last ${new Date(r.lastPractisedAt).toLocaleDateString()}`:''}</div><div class="actions">${button('Learning Mode','open-dialogue','secondary',`data-id="${d.id}" data-mode="learning"`)}${button(done?'Practise again →':'Practice →','open-dialogue','primary',`data-id="${d.id}" data-mode="practice"`)}</div></article>`;}).join('')||'<div class="empty wide-card"><h3>No dialogues match</h3><p>Change the topic, level, completion status or search.</p></div>'}</div>`);
}

function currentMockPair(){
  if(!state.mockPair||state.mockPair.length!==2){
    const shuffled=[...state.dialogues].sort(()=>Math.random()-.5),first=shuffled[0],second=shuffled.find(d=>d.id!==first.id&&d.topic!==first.topic)||shuffled[1];
    state.mockPair=[first.id,second.id];
  }
  return state.mockPair.map(id=>state.dialogues.find(d=>d.id===id)).filter(Boolean);
}
function mock(){
  const pair=currentMockPair();
  return shell(`${header('Mock Test','Two-dialogue realistic practice')}
  <section class="mock"><div class="lock">🔒</div><small>LOCKED TEST-STYLE SETTINGS</small><h2>Complete two dialogues before feedback</h2><p>Normal speed, hidden source transcripts, one penalty-free repeat per dialogue and separate estimates out of 45.</p><div class="mock-pair">${pair.map((d,i)=>`<div><b>Dialogue ${i+1}</b><span>${esc(d?.title||'')}</span><small>${topicLabels[d?.topic]||''}</small></div>`).join('')}</div><ul><li>Estimated result applies 63/90 overall</li><li>Each dialogue must also reach 29/45</li><li>No feedback appears until both dialogues finish</li></ul><div class="actions centered">${button('Choose another pair','shuffle-mock','secondary')}${button('Start full mock →','start-mock','primary')}</div></section>
  <div class="warning">Scores are NAATI-aligned practice estimates, not official examiner marks.</div>`);
}

function progress(){
  const attempts=getJSON(storageKeys.attempts,[]),mistakes=getJSON(storageKeys.mistakes,[]),finished=attempts.filter(x=>x.finished),last=finished.at(-1),dialogueRecords=dialogueStatsMap(),dt=dialogueTotals(),pt=phraseTotals();
  const completedDialogues=state.dialogues.filter(d=>(dialogueRecords[d.id]?.practiceCount||0)>0).sort((a,b)=>new Date(dialogueRecords[b.id].lastPractisedAt)-new Date(dialogueRecords[a.id].lastPractisedAt));
  const recentPhrases=state.phrases.map(x=>({...x,...phrasePracticeInfo(x.id)})).filter(x=>x.completed).sort((a,b)=>new Date(b.lastPractisedAt)-new Date(a.lastPractisedAt)).slice(0,12);
  return shell(`${header('Progress','Your completed, remaining and repeated practice records')}
  <section class="stats progress-stats">${[[dt.completed,'dialogues completed'],[dt.remaining,'dialogues remaining'],[dt.totalPractices,'dialogue practices'],[pt.completed,'phrases completed'],[pt.remaining,'phrases remaining'],[pt.totalPractices,'phrase practices']].map(([v,l])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</section>
  <section class="card"><small>DIALOGUE COMPLETION RECORDS</small><h3>Which dialogues you have done and how many times</h3>${completedDialogues.length?`<div class="completion-records">${completedDialogues.map(d=>{const r=dialogueRecords[d.id];return `<div><div><strong>${esc(d.title)}</strong><small>${topicLabels[d.topic]||'Community'} · last practised ${new Date(r.lastPractisedAt).toLocaleString()}</small></div><span class="record-count">${r.practiceCount}× practised</span>${r.bestLow!==null?`<em>Best ${r.bestLow}–${r.bestHigh}/45</em>`:''}<button data-action="open-dialogue" data-id="${d.id}" data-mode="practice">Practise again</button></div>`;}).join('')}</div>`:'<div class="empty">No dialogue has been completed yet. Remaining dialogues are visible under Practice → Remaining.</div>'}</section>
  <section class="dashboard-grid"><article class="card"><small>RECENT DIALOGUE RESULTS</small><h3>Scores and improvement</h3>${finished.length?`<div class="attempts">${finished.slice(-8).reverse().map(a=>`<button data-action="open-saved-report" data-id="${a.id}"><strong>${esc(a.title)}</strong><span>${a.report?.low??'—'}–${a.report?.high??'—'} / 45</span><small>${new Date(a.finishedAt).toLocaleString()}</small></button>`).join('')}</div>`:'<div class="empty">Complete a practice dialogue to create your first report.</div>'}</article>
  <article class="card"><small>PHRASE COMPLETION RECORDS</small><h3>${pt.completed} completed · ${pt.remaining} remaining</h3>${recentPhrases.length?`<div class="phrase-records">${recentPhrases.map(x=>`<div><p><b>${esc(x.english)}</b><small>${esc(x.hindi)}</small></p><span>${x.practiceCount}×</span></div>`).join('')}</div><button class="secondary full-record-link" data-action="tab" data-id="learn">Open all phrases and filters →</button>`:'<p class="muted">Play a phrase to mark it completed and start its practice count.</p>'}</article></section>
  <section class="dashboard-grid"><article class="card"><small>MISTAKE NOTEBOOK</small><h3>${mistakes.filter(x=>!x.mastered).length} items need revision</h3>${mistakes.length?`<div class="mistake-list">${mistakes.slice(-6).reverse().map(m=>`<div><span class="result-dot ${m.status}"></span><p><b>${esc(m.dialogueTitle)} · Segment ${m.segmentNumber}</b><small>${esc(m.review?.slice(0,2).join(', ')||'Review meaning')}</small></p><button data-action="toggle-mastered" data-id="${m.id}">${m.mastered?'Restore':'Mastered'}</button></div>`).join('')}</div>`:'<p class="muted">Weak segments will be saved here automatically.</p>'}</article><article class="card"><small>LATEST ESTIMATE</small><h3>${last?.report?`${last.report.low}–${last.report.high}/45`:'No completed dialogue yet'}</h3><p class="muted">Your result history remains available after closing and reopening the app.</p></article></section>
  <section class="card"><small>PROGRESS BACKUP</small><h3>Backup all learning records</h3><p class="muted">The backup contains vocabulary statuses, My Vocabs, dialogue-vocabulary progress, phrase completion counts, recall records, settings, dialogue attempts, mistakes and Lesson 0 progress.</p><div class="actions">${button('Backup progress','backup-progress','secondary')}${button('Restore progress','restore-progress','secondary')}</div><input id="restoreFile" type="file" accept="application/json" hidden></section>`);
}

function lessonOverlay(){
  const chapter=state.lessonData.chapters[state.lesson.chapter],slide=chapter.slides[state.lesson.slide],totalSlides=state.lessonData.chapters.reduce((s,c)=>s+c.slides.length,0),done=state.lessonData.chapters.slice(0,state.lesson.chapter).reduce((s,c)=>s+c.slides.length,0)+state.lesson.slide+1;
  if(state.lesson.quiz)return lessonQuiz();
  return `<div class="fullscreen lesson-screen"><header class="top"><button data-action="close-overlay">← Exit lesson</button><div><strong>Lesson 0</strong><span>Chapter ${state.lesson.chapter+1} of ${state.lessonData.chapters.length}</span></div><div class="top-actions"><button class="top-search-button" data-action="global-search" type="button" aria-label="Search all Hindi material" aria-expanded="false">⌕ <b>Search</b></button><button data-action="lesson-quiz">Quiz</button><button class="player-settings-button" data-action="app-settings" aria-label="Open settings" title="Settings">⚙ <b>Settings</b></button></div></header><div class="progress"><i style="width:${done/totalSlides*100}%"></i></div>
  <main class="lesson-layout"><aside class="chapter-list">${state.lessonData.chapters.map((c,i)=>`<button data-action="lesson-chapter" data-id="${i}" class="${i===state.lesson.chapter?'active':''}"><b>${i+1}</b><span>${esc(c.title)}<small>${c.duration}</small></span></button>`).join('')}</aside>
  <section class="presentation"><div class="presentation-stage"><div class="presenter-avatar"><div>APS</div><span>CCL Coach</span></div><div class="slide-content"><small>${esc(chapter.title)}</small><h1>${esc(slide.title)}</h1><p>${esc(slide.body)}</p><div class="slide-badge">Official information reviewed ${esc(state.lessonData.lastVerified)}</div></div><div class="visual-bars"><i></i><i></i><i></i><i></i><i></i></div></div>
  ${state.lesson.captions?`<div class="captions">${esc(lessonNarration(slide))}</div>`:''}
  <div class="presentation-controls"><button data-action="lesson-prev" ${state.lesson.chapter===0&&state.lesson.slide===0?'disabled':''}>‹</button><button class="play-circle" data-action="lesson-toggle">${state.lesson.playing?'Ⅱ':'▶'}</button><button data-action="lesson-next">›</button><label>Language<select id="lessonLang"><option value="bilingual" ${state.lesson.lang==='bilingual'?'selected':''}>Bilingual</option><option value="en" ${state.lesson.lang==='en'?'selected':''}>English</option><option value="hi" ${state.lesson.lang==='hi'?'selected':''}>Hindi</option></select></label><label>Speed<select id="lessonRate"><option value="0.8">0.8×</option><option value="1" ${state.lesson.rate===1?'selected':''}>1.0×</option><option value="1.2" ${state.lesson.rate===1.2?'selected':''}>1.2×</option><option value="1.4" ${state.lesson.rate===1.4?'selected':''}>1.4×</option></select></label><button data-action="lesson-captions">CC ${state.lesson.captions?'On':'Off'}</button></div>
  <div class="presentation-nav"><span>${state.lesson.slide+1}/${chapter.slides.length} slides</span>${state.lesson.chapter===state.lessonData.chapters.length-1&&state.lesson.slide===chapter.slides.length-1?button('Take knowledge quiz →','lesson-quiz','primary'):button('Next slide →','lesson-next','primary')}</div></section></main>${renderModal()}</div>`;
}
function lessonNarration(slide){return state.lesson.lang==='en'?slide.narrationEn:state.lesson.lang==='hi'?slide.narrationHi:`${slide.narrationEn} ${slide.narrationHi}`;}
function lessonQuiz(){
  const q=state.lessonData.quiz[state.lesson.quizIndex],answered=state.lesson.quizAnswers[state.lesson.quizIndex];
  if(state.lesson.quizIndex>=state.lessonData.quiz.length){
    const score=state.lesson.quizAnswers.filter((x,i)=>x===state.lessonData.quiz[i].answer).length;
    return `<div class="fullscreen quiz-screen"><header class="top"><button data-action="close-overlay">← Exit lesson</button><strong>Lesson 0 complete</strong><span></span></header><main class="quiz-result"><div class="result-ring">${score}/10</div><h1>${score>=8?'You understand the test foundation':'Review the highlighted chapters'}</h1><p>${score>=8?'You are ready to begin the diagnostic and dialogue training.':'A score of 8/10 is recommended before starting full mock practice.'}</p><div class="actions">${button('Review presentation','lesson-review','secondary')}${button('Start dialogue practice →','lesson-finish','primary')}</div></main></div>`;
  }
  return `<div class="fullscreen quiz-screen"><header class="top"><button data-action="lesson-review">← Presentation</button><strong>Knowledge Quiz</strong><span>${state.lesson.quizIndex+1}/10</span></header><div class="progress"><i style="width:${(state.lesson.quizIndex+1)*10}%"></i></div><main class="quiz-card"><small>QUESTION ${state.lesson.quizIndex+1}</small><h1>${esc(q.q)}</h1><div class="quiz-options">${q.options.map((o,i)=>`<button data-action="quiz-answer" data-id="${i}" class="${answered===i?(i===q.answer?'correct':'wrong'):''} ${answered!==undefined&&i===q.answer?'correct':''}" ${answered!==undefined?'disabled':''}><b>${String.fromCharCode(65+i)}</b>${esc(o)}</button>`).join('')}</div>${answered!==undefined?`<div class="explanation"><b>${answered===q.answer?'Correct':'Review this point'}</b><p>${esc(q.explanation)}</p>${button(state.lesson.quizIndex===9?'See result →':'Next question →','quiz-next','primary')}</div>`:''}</main></div>`;
}

function vocabPlayerOverlay(){
  const vp=state.vocabPlayer,item=allVocabItems().find(x=>x.id===vp.queue[vp.index]);
  if(!item)return `<div class="fullscreen"><div class="empty"><h2>No items in this playlist</h2>${button('Close','close-overlay')}</div></div>`;
  const st=itemStatus(item.id),progress=(vp.index+1)/vp.queue.length*100;
  const hideEnglish=state.vocabSettings.hideEnglish===true;
  const hideHindi=state.vocabSettings.hideHindi===true;
  const recallActive=hideEnglish||hideHindi;
  const revealed=recallActive&&vp.revealCurrent===true;
  const englishHidden=hideEnglish&&!revealed;
  const hindiHidden=hideHindi&&!revealed;
  const showExamples=Boolean(item.exampleEnglish&&state.vocabSettings.examples&&(!recallActive||revealed));
  const mySynonyms=Array.isArray(item.mySynonyms)?item.mySynonyms.filter(Boolean):[];
  const showMySynonyms=Boolean(item.itemType==='my-vocab'&&mySynonyms.length&&(!recallActive||revealed));
  const stageAction=recallActive?' data-action="toggle-recall-reveal" tabindex="0" role="button" aria-label="Reveal or hide the meaning for this card"':'';
  return `<div class="fullscreen vocab-player-screen"><header class="top"><button data-action="close-vocab-player">← Exit</button><div><strong>${esc(vp.title)}</strong><span>${vp.index+1}/${vp.queue.length}</span></div><div class="top-actions"><button class="top-search-button" data-action="global-search" type="button" aria-label="Search all Hindi material" aria-expanded="false">⌕ <b>Search</b></button><button class="compact-settings-button" data-action="vocab-settings" aria-label="Open vocabulary settings"><span aria-hidden="true">⚙</span><b>Settings</b></button></div></header><div class="progress"><i style="width:${progress}%"></i></div>
  <main class="vocab-player"><div class="vocab-topic">${topicLabels[item.topic]||'Community'} · ${item.itemType==='phrase'?'Phrase':'NAATI vocabulary'}</div>
  <section class="recall-display-controls" aria-label="Recall display options"><span>Recall</span><button type="button" data-action="toggle-hide-english" class="recall-display-toggle ${hideEnglish?'active':''}" aria-pressed="${hideEnglish?'true':'false'}">Hide English</button><button type="button" data-action="toggle-hide-hindi" class="recall-display-toggle ${hideHindi?'active':''}" aria-pressed="${hideHindi?'true':'false'}">Hide Hindi</button></section>
  <section class="word-stage ${recallActive?'recall-active':''} ${revealed?'recall-revealed':''}"${stageAction}><button class="speaker-button" data-action="speak-current" aria-label="Play pronunciation">🔊</button><h1 class="recall-language english ${englishHidden?'is-hidden':''}">${englishHidden?'<span class="recall-hidden-label">English hidden</span>':esc(item.english)}</h1><h2 class="recall-language hindi ${hindiHidden?'is-hidden':''}">${hindiHidden?'<span class="recall-hidden-label">Hindi hidden</span>':esc(item.hindi)}</h2>${showMySynonyms?`<div class="player-my-synonyms"><b>My Synonyms</b><span>${esc(mySynonyms.join(' · '))}</span></div>`:''}${showExamples?`<div class="player-example"><b>Example</b><p>${esc(item.exampleEnglish)}</p><span>${esc(item.exampleHindi)}</span></div>`:''}${recallActive?`<div class="recall-reveal-hint">${revealed?'Tap card again to hide':'Tap anywhere on this card to reveal'}</div>`:''}</section>
  <div class="player-timeline"><span>${vp.playing?vp.gapRemaining>0?`Next item in ${vp.gapRemaining}s`:'Speaking…':'Paused'}</span><div><i style="width:${progress}%"></i></div></div>
  <div class="transport"><button data-action="vocab-prev">‹<span>Previous</span></button><button class="main-play" data-action="vocab-toggle">${vp.playing?'Ⅱ':'▶'}</button><button data-action="vocab-next"><span>Next</span>›</button></div>
  <section class="status-control"><h3>Change word status</h3><div>${Object.entries(statusLabels).map(([id,label])=>`<button data-action="vocab-status" data-id="${id}" class="${st===id?'active':''} ${id}"><b>${statusIcons[id]}</b><span>${label}</span></button>`).join('')}</div></section>
  <section class="quick-settings six"><label>English speed<select id="vocabRateEn">${[.6,.75,.9,1,1.15,1.3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.rateEn)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Hindi speed<select id="vocabRateHi">${[.6,.75,.9,1,1.15,1.3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.rateHi)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Meaning delay<select id="vocabTranslationDelay">${[0,.5,1,1.5,2,3,5].map(x=>`<option value="${x}" ${Number(state.vocabSettings.translationDelay)===x?'selected':''}>${x}s</option>`).join('')}</select></label><label>Next-item gap<select id="vocabGap">${[0,1,2,3,5,8].map(x=>`<option value="${x}" ${Number(state.vocabSettings.gap)===x?'selected':''}>${x}s</option>`).join('')}</select></label><label>Repeat pair<select id="vocabRepeat">${[1,2,3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.repeat)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Order<select id="vocabOrder"><option value="sequential" ${state.vocabSettings.order==='sequential'?'selected':''}>In order</option><option value="random" ${state.vocabSettings.order==='random'?'selected':''}>Random</option></select></label></section></main>${renderModal()}</div>`;
}

function dialoguePlayerOverlay(){
  const d=state.dialogue,segments=getActiveSegments(),seg=segments[state.segmentIndex],response=state.responses[state.segmentIndex],target=seg.sourceLanguage==='en'?'Hindi':'English';
  const isLearning=state.dialogueMode==='learning',isMock=state.dialogueMode==='mock';
  return `<div class="fullscreen dialogue-screen"><header class="top"><button data-action="exit-dialogue">← Exit</button><div><strong>${esc(d.title)}</strong><span>${modeLabels[state.dialogueMode]}</span></div><div class="top-actions"><span>${state.segmentIndex+1}/${segments.length}</span><button class="top-search-button" data-action="global-search" type="button" aria-label="Search all Hindi material" aria-expanded="false">⌕ <b>Search</b></button><button class="player-settings-button" data-action="app-settings" aria-label="Open settings" title="Settings">⚙ <b>Settings</b></button></div></header><div class="direction-progress"><i class="en"></i><i style="width:${(state.segmentIndex+1)/segments.length*100}%"></i><i class="hi"></i></div>
  <main class="dialogue-player"><section class="segment-head"><div><span class="language-pill ${seg.sourceLanguage}">${seg.sourceLanguage==='en'?'ENGLISH':'हिन्दी'}</span><h2>Listen, then interpret into ${target}</h2></div>${!isMock?`<div class="dialogue-controls"><label>Speed<select id="dialogueRate" ${state.playerStatus==='playing'||state.recording?'disabled':''}>${[.6,.75,.9,1,1.15].map(x=>`<option value="${x}" ${Number(state.dialogueSettings.rate)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Response gap<select id="dialogueGap" ${state.playerStatus==='playing'||state.recording?'disabled':''}><option value="manual" ${state.dialogueSettings.gap==='manual'?'selected':''}>Manual</option>${[5,10,15,20,30,45,60].map(x=>`<option value="${x}" ${Number(state.dialogueSettings.gap)===x?'selected':''}>${x}s</option>`).join('')}</select></label>${!isMock?`<button class="transcript-toggle ${state.dialogueSettings.showSourceTranscript?'on':''}" data-action="toggle-source-transcript">Transcript ${state.dialogueSettings.showSourceTranscript?'On':'Off'}</button>`:''}</div>`:''}</section>
  <section class="source-card ${state.playerStatus==='ready'?'waiting':''}">${!isMock?`<button class="aps-inline-skip aps-inline-skip-listening" data-action="skip-listening" type="button" aria-label="Skip listening and start recording" title="Skip listening and start recording" ${state.recording?'disabled':''}>Skip</button>`:''}<div class="source-icon">${state.playerStatus==='playing'?'◖))':state.recording?'●':'▶'}</div><p>${!isMock&&state.dialogueSettings.showSourceTranscript?esc(seg.source):`<span class="transcript-hidden-message">${isMock?'Source transcript is hidden in Mock Test Mode.':'Source transcript is hidden. Use the Transcript On/Off button when you want to read it.'}</span>`}</p><div class="source-actions">${button(state.playerStatus==='playing'?'Playing…':response?'Play source again':'Play segment','play-dialogue-segment','primary',state.playerStatus==='playing'||state.recording?'disabled':'')}${button(`Repeat (${state.repeats}${state.dialogueMode==='learning'?'':'/1 free'})`,'repeat-dialogue-segment','secondary',state.playerStatus==='playing'||state.recording?'disabled':'')}</div></section>
  ${recordingPanel(response,seg)}
  ${isLearning&&response&&response.showTranscript?learningFeedback(response,seg):''}
  <footer class="segment-footer">${button('‹ Previous','dialogue-prev','secondary',state.segmentIndex===0?'disabled':'')}<span>${state.completed.size}/${segments.length} completed</span>${state.segmentIndex===segments.length-1?button('Finish dialogue →','finish-dialogue','primary',!response?'disabled':''):button('Next segment →','dialogue-next','primary',!response?'disabled':'')}</footer></main>${renderModal()}</div>`;
}
function recordingPanel(response,seg){
  const skipRecordingControl=state.dialogueMode==='mock'
    ?''
    :`<button class="aps-inline-skip aps-inline-skip-recording" data-action="skip-recording" type="button" aria-label="Skip recording and continue" title="Skip recording and continue">Skip</button>`;
  if(state.micError){
    return `<section class="recording-panel error">${skipRecordingControl}
      <h3>Microphone needs attention</h3>
      <p>${esc(state.micError)}</p>
      ${button('Try microphone again','retry-mic','secondary')}
    </section>`;
  }

  if(state.recording){
    return `<section class="recording-panel active">${skipRecordingControl}
      <div class="record-dot"></div>
      <div>
        <h3>Recording your ${seg.sourceLanguage==='en'?'Hindi':'English'} interpretation</h3>
        <p>${state.dialogueSettings.gap==='manual'
          ?'Speak naturally, then press Finish.'
          :`${state.countdown} seconds remaining`}</p>
        <div class="live-transcript hidden-live">
          Your answer is being recorded and saved in this browser.
          Browser speech recognition is optional; playback always remains available.
        </div>
      </div>
      ${button('Finish','finish-recording','danger')}
    </section>`;
  }

  if(state.recordingError){
    return `<section class="recording-panel error">${skipRecordingControl}
      <div>
        <h3>Recording was not saved</h3>
        <p>${esc(state.recordingError)}</p>
      </div>
      ${button('Record again','record-again','secondary')}
    </section>`;
  }

  if(!response){
    return `<section class="recording-panel">${skipRecordingControl}
      <div class="mic-circle">🎙</div>
      <div>
        <h3>Recording starts automatically after the chime</h3>
        <p>Your complete audio will be verified for playback before the segment is accepted.</p>
      </div>
    </section>`;
  }

  const isMock=state.dialogueMode==='mock';
  const duration=Number(response.duration||0);
  const durationText=duration
    ?`${Math.floor(duration/60)}:${String(Math.round(duration%60)).padStart(2,'0')}`
    :'—';

  const browserTranscript=String(
    response.cloudTranscript||response.transcript||''
  ).trim();
  const compareReady=Boolean(
    response.recordingUrl||response.recordingId||browserTranscript
  );

  const transcriptStatus=browserTranscript
    ?`<div class="automatic-transcript draft-transcript">
        <small>${response.cloudTranscript?'CLOUD TRANSCRIPT':'BROWSER TRANSCRIPT'} · PRACTICE COMPARISON ONLY</small>
        <p>${esc(browserTranscript)}</p>
        <em>${response.cloudTranscript
          ?`Provider: ${esc(response.cloudTranscriptionProvider||'cloud')}`
          :'Created in this browser. Check it against your saved recording.'}</em>
      </div>`
    :`<p class="recording-verified local-only-note">
        Recording saved locally. Automatic browser transcript was unavailable,
        but playback and manual comparison still work without Firebase.
      </p>`;

  const compareControl=!isMock
    ?button(
        response.showTranscript?'Hide comparison':'Compare answer',
        'toggle-response-transcript',
        'secondary',
        compareReady?'':'disabled'
      )
    :'';

  return `<section class="recording-panel complete">${skipRecordingControl}
    <div class="recording-playback">
      <h3>Response recorded</h3>
      <div class="recording-verified">
        ✓ Saved and playback-verified · ${durationText}
      </div>

      ${transcriptStatus}

      ${response.recordingUrl
        ?`<audio controls preload="metadata"
            src="${esc(response.recordingUrl)}"
            data-recording-id="${esc(response.recordingId||'')}"></audio>`
        :'<p class="recording-failure">Recording unavailable. Please record again.</p>'}
    </div>

    <div class="record-actions">
      ${compareControl}
      ${button('Record again','record-again','secondary')}
    </div>

    ${isMock
      ?`<p class="mock-review-lock">
          Transcript, sample answer and notes will be available after both
          mock-test dialogues are completed.
        </p>`
      :response.showTranscript
        ?`<div class="answer-review">${comparisonPanel(seg,response)}</div>`
        :''}
  </section>`;
}

function comparisonPanel(seg,response){
  const points=(seg.comparisonPoints||[]).slice(0,5);
  const notes=seg.noteTaking||{};
  const sample=seg.sampleAnswer||seg.model||'';
  const transcript=String(
    response.cloudTranscript||response.transcript||''
  ).trim();
  const transcriptLabel=response.cloudTranscript
    ?'YOUR CLOUD TRANSCRIPT'
    :transcript
      ?'YOUR BROWSER TRANSCRIPT'
      :'YOUR SAVED RECORDING';

  const r=response.practiceComparison||null;

  const cleanItems=items=>{
    const seen=new Set();

    return (items||[])
      .filter(x=>typeof x==='string'&&x.trim())
      .map(x=>x.trim())
      .filter(x=>{
        const key=x.toLowerCase();
        if(seen.has(key))return false;
        seen.add(key);
        return true;
      })
      .slice(0,5);
  };

  const strengths=cleanItems([
    ...(r?.strengths||[]),
    ...(r?.captured||[])
  ]);

  const differences=cleanItems([
    ...(r?.review||[]),
    ...(r?.critical||[]),
    ...(r?.advice||[])
  ]);

  const coverage=
    r&&Number.isFinite(Number(r.coverage))
      ?`${Math.round(Number(r.coverage)*100)}% approximate meaning coverage`
      :'Manual meaning review recommended';

  const status=r
    ?resultStatusLabel(r.status)
    :'Automated comparison unavailable';

  return `<section class="comparison-panel">
    <div class="comparison-title">
      <div>
        <small>COMPARE AND IMPROVE</small>
        <h3>Your response compared with the sample</h3>
      </div>
      <button class="sample-play" data-action="play-sample-answer">
        🔊 Play sample
      </button>
    </div>

    <div class="comparison-grid">
      <article class="sample-answer-box">
        <small>${transcriptLabel}</small>
        <p>${esc(transcript||'No automatic browser transcript was available. Play your saved recording above and compare it manually with the sample interpretation.')}</p>
        <em>${transcript
          ?'Check this browser transcript against your recording before relying on the comparison.'
          :'Your recording is saved locally and remains available without Firebase.'}</em>
      </article>

      <article class="sample-answer-box">
        <small>SAMPLE INTERPRETATION</small>
        <p>${esc(sample)}</p>
        <em>Equivalent wording, natural synonyms and accurate paraphrasing may also be correct.</em>
      </article>
    </div>

    <section class="learning-review">
      <div class="review-heading">
        <span class="result-dot ${esc(r?.status||'unassessed')}"></span>
        <div>
          <small>AUTOMATED PRACTICE CHECK · NOT AN OFFICIAL SCORE</small>
          <h3>${esc(status)}</h3>
          <p>${esc(coverage)}</p>
        </div>
      </div>

      <div class="review-columns">
        <div>
          <h4>Meaning likely preserved</h4>
          <ul>
            ${(strengths.length
              ?strengths
              :['Replay your recording and confirm the main message manually.'])
              .map(x=>`<li>✓ ${esc(x)}</li>`)
              .join('')}
          </ul>
        </div>

        <div>
          <h4>Possible differences to review</h4>
          <ul>
            ${(differences.length
              ?differences
              :['No clear meaning difference was detected by the local practice check.'])
              .map(x=>`<li>${differences.length?'!':'✓'} ${esc(x)}</li>`)
              .join('')}
          </ul>
        </div>
      </div>

      <p class="feedback-followup">
        This comparison uses ${response.cloudTranscript
          ?'the verified cloud transcript'
          :transcript
            ?'your browser transcript'
            :'your saved recording and manual review'} with local matching rules.
        It does not make another AI request and is not an official NAATI mark.
      </p>
    </section>

    <div class="meaning-checklist">
      <small>KEY MEANING TO INCLUDE</small>
      <ul>
        ${points.map(x=>`<li>✓ ${esc(x)}</li>`).join('')||
          '<li>✓ Main message and critical detail</li>'}
      </ul>
    </div>

    <div class="note-training">
      <div>
        <small>SHORT NOTES FOR THIS SEGMENT</small>
        <p class="short-notes">
          ${esc(notes.shortNotes||seg.noteHint||'who + action + key detail')}
        </p>
      </div>

      <div>
        <small>NOTE-TAKING SKILL</small>
        <p>
          ${esc(notes.skillTip||
            'Capture who + action + key detail; avoid full sentences.')}
        </p>
      </div>
    </div>

    <p class="note-method">
      <b>Method:</b>
      ${esc(notes.method||
        'Use abbreviations, arrows and symbols instead of writing the full sentence.')}
    </p>
  </section>`;
}

function learningFeedback(response,seg){
  const r=response.practiceComparison;
  if(!r)return '';

  return `<section class="learning-review">
    <div class="review-heading">
      <span class="result-dot ${esc(r.status||'unassessed')}"></span>
      <div>
        <small>PRACTICE COMPARISON · NOT AN OFFICIAL SCORE</small>
        <h3>${esc(resultStatusLabel(r.status))}</h3>
      </div>
    </div>

    <p class="feedback-followup">
      Review your ${response.cloudTranscript?'cloud transcript':'browser transcript'},
      the sample interpretation and the key meaning checklist.
      Choose <b>Record again</b> to practise the corrected response.
    </p>
  </section>`;
}

function resultStatusLabel(s){return {excellent:'Excellent — no meaningful issue detected',good:'Good — meaning preserved with a minor issue',review:'Needs review — some meaning may be missing',major:'Major correction needed',unassessed:'Not assessed'}[s]||s;}

function reportOverlay(){
  const rep=state.report;if(rep?.type==='mock')return mockReportOverlay(rep);
  const attempt=rep.attempt,d=state.dialogues.find(x=>x.id===attempt.dialogueId)||state.dialogue,results=attempt.responses.map(x=>x.assessment),summary=attempt.report;
  return `<div class="fullscreen report-screen"><header class="top"><button data-action="close-report">← Close report</button><div><strong>Dialogue Performance Report</strong><span>${esc(attempt.title)}</span></div><button data-action="print-report">Print</button></header><main class="report"><section class="report-hero"><div class="score-range"><strong>${summary.low}–${summary.high}</strong><span>/45 estimated</span></div><div><small>NAATI-ALIGNED PRACTICE ESTIMATE</small><h1>${summary.low>=29?'Above the dialogue minimum':'More improvement recommended'}</h1><p>${summary.improvement?`Previous attempt ${summary.improvement.previousLow}–${summary.improvement.previousHigh}. ${summary.improvement.changeLow>0?'Your estimated range improved.':'Review the weak segments before retrying.'}`:'This is your first completed attempt for this dialogue.'}</p></div></section>
  <section class="result-grid"><article><small>WHAT YOU DID WELL</small><h3>Strengths to repeat</h3><ul>${(summary.strengths.length?summary.strengths:['You completed the full dialogue']).map(x=>`<li>✓ ${esc(x)}</li>`).join('')}</ul></article><article><small>PRIORITY IMPROVEMENTS</small><h3>What to practise next</h3><ul>${(summary.priorities.length?summary.priorities:['Continue practising under normal speed']).map(x=>`<li>→ ${esc(x)}</li>`).join('')}</ul></article></section>
  <section class="category-results"><div><b>${summary.counts.excellent}</b><span>Excellent</span></div><div><b>${summary.counts.good}</b><span>Good</span></div><div><b>${summary.counts.review}</b><span>Needs review</span></div><div><b>${summary.counts.major}</b><span>Major correction</span></div></section>
  <section class="improvement-plan"><small>PERSONALISED NEXT STEP</small><h3>${buildPlan(summary)}</h3><div class="actions">${button('Retry weak segments','retry-weak','primary',summary.counts.review+summary.counts.major===0?'disabled':'')}${button('Repeat full dialogue','repeat-full-dialogue','secondary')}</div></section>
  <section class="segment-report"><div class="section-heading"><small>SEGMENT-BY-SEGMENT REVIEW</small><h2>See exactly where meaning was preserved or lost</h2></div>${attempt.responses.map((res,i)=>segmentReportRow(d.segments[i],res,i)).join('')}</section>
  <div class="warning">The range reflects communication impact and transcript confidence. It is not an official NAATI examiner score.</div></main></div>`;
}
function buildPlan(s){if(s.counts.major)return 'Review the major-error segments, practise their key terms and record them again before repeating the dialogue.';if(s.counts.review)return 'Retry the “Needs review” segments, then complete the full dialogue again at normal speed.';return 'Your meaning transfer was strong. Repeat the dialogue later without transcripts to confirm consistency.';}
function segmentReportRow(seg,res,i){
  const r=res.assessment||{status:'unassessed',strengths:[],review:['Automatic transcript unavailable']},notes=seg.noteTaking||{},points=(seg.comparisonPoints||[]).slice(0,5);
  return `<details class="segment-result ${r.status}" ${r.status==='major'?'open':''}><summary><span class="result-dot ${r.status}"></span><div><b>Segment ${i+1} · ${seg.sourceLanguage==='en'?'English → Hindi':'Hindi → English'}</b><small>${resultStatusLabel(r.status)}</small></div><i>⌄</i></summary><div class="segment-detail"><div><h4>Original segment</h4><p>${esc(seg.source)}</p><button data-action="speak-text" data-text="${encodeURIComponent(seg.source)}" data-lang="${seg.sourceLanguage}" data-speaker="${esc(seg.speaker||'general')}">🔊 Play source</button></div><div><h4>Your transcript</h4><p>${esc(res.transcript||'Transcript unavailable — replay your audio.')}</p>${res.recordingUrl?`<audio controls src="${esc(res.recordingUrl)}"></audio>`:''}</div><div><h4>Sample interpretation</h4><p>${esc(seg.sampleAnswer||seg.model)}</p><button data-action="speak-text" data-text="${encodeURIComponent(seg.sampleAnswer||seg.model)}" data-lang="${seg.sourceLanguage==='en'?'hi':'en'}" data-speaker="${esc(seg.speaker||'general')}">🔊 Play sample</button><em>Accurate synonyms and paraphrases are accepted.</em></div><div><h4>Review and notes</h4><ul>${(r.review.length?r.review:['No important meaning loss detected']).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="notes"><b>Short notes:</b> ${esc(notes.shortNotes||seg.noteHint)}</p><p class="notes"><b>Skill:</b> ${esc(notes.skillTip||'Capture who + action + key detail.')}</p>${points.length?`<p class="notes"><b>Meaning checklist:</b> ${points.map(esc).join(' · ')}</p>`:''}</div></div></details>`;
}
function mockReportOverlay(rep){
  const p=rep.pass;
  return `<div class="fullscreen report-screen"><header class="top"><button data-action="close-report">← Close report</button><div><strong>Full Mock Test Report</strong><span>Two dialogues completed</span></div><button data-action="print-report">Print</button></header><main class="report"><section class="mock-result-hero"><div class="result-ring ${p.passCertain?'pass':p.passPossible?'possible':'fail'}">${p.totalLow}–${p.totalHigh}<small>/90</small></div><div><small>ESTIMATED RESULT</small><h1>${p.passCertain?'Pass range achieved':p.passPossible?'Borderline — review before test day':'Not yet at passing level'}</h1><p>Both dialogue minimums and the overall minimum are checked separately.</p></div></section><section class="mock-dialogue-results">${rep.dialogues.map((x,i)=>`<article><small>DIALOGUE ${i+1}</small><h3>${esc(x.title)}</h3><strong>${x.report.low}–${x.report.high} /45</strong><span>${x.report.low>=29?'Dialogue minimum achieved':'Below the 29 minimum in part of the range'}</span></article>`).join('')}</section><section class="card"><small>PASS CONDITIONS</small><h3>63/90 overall and at least 29/45 in each dialogue</h3><div class="condition-grid"><div class="${p.totalLow>=63?'ok':''}">Overall: ${p.totalLow}–${p.totalHigh}</div>${rep.dialogues.map((x,i)=>`<div class="${x.report.low>=29?'ok':''}">Dialogue ${i+1}: ${x.report.low}–${x.report.high}</div>`).join('')}</div></section><div class="actions centered">${button('Review Dialogue 1','review-mock-dialogue','secondary','data-id="0"')}${button('Review Dialogue 2','review-mock-dialogue','secondary','data-id="1"')}${button('Return to Mock Test','close-report','primary')}</div></main></div>`;
}

function onboarding(){return `<div class="onboard"><div><div class="brand big">APS</div><span>${esc(state.languagePack?.pairLabel||'MULTILINGUAL CCL')}</span><h1>APS NAATI CCL Practice</h1><p>A complete working preview for vocabulary listening, exam training, dialogue recording and improvement reports.</p>${button('Enter app →','complete-onboarding','primary wide')}<small>Independent preparation app. Not affiliated with NAATI.</small></div></div>`;}
function renderModal(){
  if(!state.modal)return '';
  if(state.modal.type==='playlist')return `<div class="modal-backdrop"><div class="modal"><button class="modal-close" data-action="close-modal">×</button><div class="modal-icon">▶</div><h2>Start ${esc(state.modal.title)} playlist?</h2><p>${state.modal.count} matching ${state.learn.type==='words'?'words':'phrases'} will replace the current player queue. Your speed, gap, repeat, order and voice settings will be preserved.</p><div class="actions">${button('Cancel','close-modal','secondary')}${button('Start playlist','confirm-playlist','primary')}</div></div></div>`;
  if(state.modal.type==='vocab-settings')return `<div class="modal-backdrop"><div class="modal settings-modal"><button class="modal-close" data-action="close-modal">×</button><h2>Vocabulary and phrase player settings</h2><div class="playback-settings-grid"><label>Reading order<select id="vocabReading"><option value="en-hi" ${state.vocabSettings.reading==='en-hi'?'selected':''}>English → Hindi</option><option value="hi-en" ${state.vocabSettings.reading==='hi-en'?'selected':''}>Hindi → English</option><option value="english" ${state.vocabSettings.reading==='english'?'selected':''}>English only</option><option value="hindi" ${state.vocabSettings.reading==='hindi'?'selected':''}>Hindi only</option></select></label><label>English speed<select id="vocabRateEn">${[.6,.75,.9,1,1.15,1.3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.rateEn)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Hindi speed<select id="vocabRateHi">${[.6,.75,.9,1,1.15,1.3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.rateHi)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Translation delay<select id="vocabTranslationDelay">${[0,.5,1,1.5,2,3,5].map(x=>`<option value="${x}" ${Number(state.vocabSettings.translationDelay)===x?'selected':''}>${x} seconds</option>`).join('')}</select></label><label>Next-item gap<select id="vocabGap">${[0,1,2,3,5,8].map(x=>`<option value="${x}" ${Number(state.vocabSettings.gap)===x?'selected':''}>${x} seconds</option>`).join('')}</select></label><label>Repeat each pair<select id="vocabRepeat">${[1,2,3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.repeat)===x?'selected':''}>${x} time${x>1?'s':''}</option>`).join('')}</select></label></div><p class="timing-example"><b>Example:</b> English word → translation delay → Hindi meaning → next-item gap → next word.</p><label class="toggle"><input id="vocabExamples" type="checkbox" ${state.vocabSettings.examples?'checked':''}><span>Speak examples when available</span></label><label class="toggle"><input id="vocabMySynonyms" type="checkbox" ${state.vocabSettings.speakMySynonyms!==false?'checked':''}><span>Speak My Synonyms for personal vocabulary</span></label><label>English voice<select id="voiceEn"><option value="">Automatic English voice</option>${voiceOptions('en',state.vocabSettings.voiceEn)}</select></label><label>Hindi voice<select id="voiceHi"><option value="">Automatic Hindi voice</option>${voiceOptions('hi',state.vocabSettings.voiceHi)}</select></label><p class="settings-link-note">These settings are saved on this device and apply to both vocabulary and phrases.</p>${button('Open full Voice & Audio settings','app-settings','secondary wide')}${button('Done','close-modal','primary wide')}</div></div>`;
  if(state.modal.type==='email-auth')return `<div class="modal-backdrop"><div class="modal auth-modal"><button class="modal-close" data-action="close-modal">×</button><small>ACCOUNT</small><h2>${state.auth.emailMode==='create'?'Create an account':'Sign in with email'}</h2><p>Your existing local learning progress will remain on this device.</p>${state.auth.error?`<div class="auth-error">${esc(state.auth.error)}</div>`:''}<label>Email address<input id="authEmail" type="email" autocomplete="email" placeholder="name@example.com"></label><label>Password<input id="authPassword" type="password" autocomplete="current-password" placeholder="At least 6 characters"></label><button class="primary wide" data-action="auth-email-submit">${state.auth.busy?'Please wait…':state.auth.emailMode==='create'?'Create account':'Sign in'}</button><button class="text-button" data-action="auth-email-switch">${state.auth.emailMode==='create'?'Already have an account? Sign in':'New student? Create an account'}</button></div></div>`;
  if(state.modal.type==='phone-auth')return `<div class="modal-backdrop"><div class="modal auth-modal"><button class="modal-close" data-action="close-modal">×</button><small>PHONE SIGN-IN</small><h2>${state.auth.phoneStage==='number'?'Enter your phone number':'Enter the SMS code'}</h2><p>${state.auth.phoneStage==='number'?'Use the full international number, for example +61…':'Enter the verification code sent to '+esc(state.auth.phone)}</p>${state.auth.error?`<div class="auth-error">${esc(state.auth.error)}</div>`:''}${state.auth.phoneStage==='number'?`<label>Phone number<input id="authPhone" type="tel" autocomplete="tel" placeholder="+61 4xx xxx xxx"></label><button class="primary wide" data-action="auth-phone-send">${state.auth.busy?'Sending…':'Send verification code'}</button>`:`<label>Verification code<input id="authPhoneCode" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"></label><button class="primary wide" data-action="auth-phone-confirm">${state.auth.busy?'Checking…':'Confirm and sign in'}</button><button class="text-button" data-action="auth-phone-back">Use a different number</button>`}</div></div>`;
  if(state.modal.type==='manage-languages')return `<div class="modal-backdrop"><div class="modal settings-modal"><button class="modal-close" data-action="close-modal">×</button><small>MY LANGUAGES</small><h2>Manage preparation languages</h2><p>Hindi is currently available. Future packs will use the same app and keep separate learning records.</p><div class="language-list compact">${state.languageCatalog.map(x=>`<button class="language-option ${x.id===state.selectedLanguage?'selected':''} ${x.status==='available'?'available':'coming'}" data-action="switch-language" data-language="${esc(x.id)}" ${x.status==='available'?'':'disabled'}><span class="language-native">${esc(x.nativeName)}</span><span><b>${esc(x.name)}</b><small>${esc(x.pairLabel||'')}</small></span><em>${x.id===state.selectedLanguage?'Active':x.status==='available'?'Available':'Coming soon'}</em></button>`).join('')}</div>${button('Done','close-modal','primary wide')}</div></div>`;
  if(state.modal.type==='app-settings'){
    const counts=voiceCounts();
    return `<div class="modal-backdrop"><div class="modal settings-modal app-settings-modal"><button class="modal-close" data-action="close-modal">×</button><div class="settings-heading"><div><small>SETTINGS</small><h2>Settings</h2></div><span>${counts.en} EN · ${counts.hi} HI</span></div>
    <div class="account-settings-card"><div class="account-avatar">${state.auth.user?.photoUrl?`<img src="${esc(state.auth.user.photoUrl)}" alt="">`:esc((authDisplayName()[0]||'A').toUpperCase())}</div><div><small>ACCOUNT</small><h3>${esc(authDisplayName())}</h3><p>${esc(authProviderLabel())} · Progress on this device is preserved</p></div><div class="account-actions">${state.auth.user&&!state.auth.user.isAnonymous?button('Sign out','auth-signout','secondary'):button('Sign in or upgrade','auth-open','secondary')}${state.auth.user&&!state.auth.user.isAnonymous?button('Delete account','auth-delete','danger'):''}</div></div>
    <div class="voice-settings-section language-settings-section"><h3>Language</h3><div class="current-language-row"><span class="language-native">${esc(state.languagePack?.nativeName||'')}</span><div><b>${esc(state.languagePack?.name||'No language selected')}</b><small>${esc(state.languagePack?.pairLabel||'')}</small></div>${button('Manage languages','manage-languages','secondary')}</div></div>
    <div class="voice-settings-section"><h3>Learning voices</h3>${voiceSettingRow('English learning voice','voiceEn','en',state.vocabSettings.voiceEn,'general')}${voiceSettingRow('Hindi learning voice','voiceHi','hi',state.vocabSettings.voiceHi,'general')}</div>
    <div class="voice-settings-section"><h3>Vocabulary & phrase playback</h3><div class="playback-settings-grid"><label>Reading order<select id="vocabReading"><option value="en-hi" ${state.vocabSettings.reading==='en-hi'?'selected':''}>English → Hindi</option><option value="hi-en" ${state.vocabSettings.reading==='hi-en'?'selected':''}>Hindi → English</option><option value="english" ${state.vocabSettings.reading==='english'?'selected':''}>English only</option><option value="hindi" ${state.vocabSettings.reading==='hindi'?'selected':''}>Hindi only</option></select></label><label>English speed<select id="vocabRateEn">${[.6,.75,.9,1,1.15,1.3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.rateEn)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Hindi speed<select id="vocabRateHi">${[.6,.75,.9,1,1.15,1.3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.rateHi)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Translation delay<select id="vocabTranslationDelay">${[0,.5,1,1.5,2,3,5].map(x=>`<option value="${x}" ${Number(state.vocabSettings.translationDelay)===x?'selected':''}>${x} seconds</option>`).join('')}</select></label><label>Next-item gap<select id="vocabGap">${[0,1,2,3,5,8].map(x=>`<option value="${x}" ${Number(state.vocabSettings.gap)===x?'selected':''}>${x} seconds</option>`).join('')}</select></label><label>Repeat each pair<select id="vocabRepeat">${[1,2,3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.repeat)===x?'selected':''}>${x} time${x>1?'s':''}</option>`).join('')}</select></label></div><label class="toggle"><input id="vocabExamples" type="checkbox" ${state.vocabSettings.examples?'checked':''}><span>Speak examples when available</span></label><label class="toggle"><input id="vocabMySynonyms" type="checkbox" ${state.vocabSettings.speakMySynonyms!==false?'checked':''}><span>Speak My Synonyms for personal vocabulary</span></label></div>
    <div class="voice-settings-section"><h3>Dialogue voices</h3>${voiceSettingRow('English · Speaker 1','dialogueVoiceEnS1','en',state.vocabSettings.dialogueVoiceEnS1,'S1')}${voiceSettingRow('English · Speaker 2','dialogueVoiceEnS2','en',state.vocabSettings.dialogueVoiceEnS2,'S2')}${voiceSettingRow('Hindi · Speaker 1','dialogueVoiceHiS1','hi',state.vocabSettings.dialogueVoiceHiS1,'S1')}${voiceSettingRow('Hindi · Speaker 2','dialogueVoiceHiS2','hi',state.vocabSettings.dialogueVoiceHiS2,'S2')}</div>
    <div class="voice-settings-help"><b>Voice availability depends on your device.</b></div>
    <div class="settings-actions">${button('Refresh voices','refresh-voices','secondary')}${button('Use automatic voices','reset-voices','secondary')}${button('Done','close-modal','primary')}</div></div></div>`;
  }
  return '';
}
function speechVoices(){return 'speechSynthesis'in window?speechSynthesis.getVoices():[];}
function availableVoices(lang){
  const prefix=lang==='hi'?'hi':'en',seen=new Set();
  return speechVoices().filter(v=>{
    const code=String(v.lang||'').toLowerCase().replace('_','-');
    if(!code.startsWith(prefix))return false;
    const key=`${v.voiceURI||v.name}|${v.name}|${code}`;
    if(seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>`${a.lang} ${a.name}`.localeCompare(`${b.lang} ${b.name}`));
}
function voiceCounts(){return {en:availableVoices('en').length,hi:availableVoices('hi').length};}
async function refreshVoiceCatalog(){
  if(!('speechSynthesis'in window))return;
  speechSynthesis.cancel();
  const waits=[0,120,350,800,1500];
  for(const ms of waits){if(ms)await delay(ms);speechSynthesis.getVoices();if(['vocab-settings','app-settings'].includes(state.modal?.type))render();}
}

function voiceOptions(lang,selected){return availableVoices(lang).map(v=>`<option value="${esc(v.name)}" ${v.name===selected?'selected':''}>${esc(v.name)} (${esc(v.lang)})${v.localService?' · device':''}</option>`).join('');}
function voiceSettingRow(label,id,lang,selected,speaker){const fallback=speaker==='general'?'Automatic system voice':'Use learning voice';return `<div class="voice-setting-row"><label>${esc(label)}<select id="${id}"><option value="">${fallback}</option>${voiceOptions(lang,selected)}</select></label><button data-action="preview-voice" data-lang="${lang}" data-speaker="${speaker}">▶ Preview</button></div>`;}

function render(){
  if(!state.ready||!state.auth.initialized){app.innerHTML='<div class="loading">Loading APS NAATI CCL Practice…</div>';return;}
  if(localStorage.getItem(storageKeys.authChoice)!=='1'&&!state.auth.user){app.innerHTML=authWelcome();return;}
  if(state.modal?.type==='verify-email'&&state.auth.user?.email&&state.auth.user?.emailVerified===false){app.innerHTML=authWelcome();return;}
  if(!state.selectedLanguage){
    if(['email-auth','forgot-password','password-reset-sent'].includes(state.modal?.type)){app.innerHTML=authWelcome();return;}
    app.innerHTML=languageSelectionScreen();return;
  }
  if(localStorage.getItem(storageKeys.onboard)!=='1'){app.innerHTML=onboarding();return;}
  if(state.overlay==='lesson'){app.innerHTML=lessonOverlay();return;}
  if(state.overlay==='vocab-player'){app.innerHTML=vocabPlayerOverlay();return;}
  if(state.overlay==='dialogue'){app.innerHTML=dialoguePlayerOverlay();return;}
  if(state.overlay==='report'){app.innerHTML=reportOverlay();return;}
  app.innerHTML=state.tab==='learn'?learn():state.tab==='practice'?practice():state.tab==='mock'?mock():state.tab==='progress'?progress():home();
}

function showToast(text){state.toast=text;render();setTimeout(()=>{if(state.toast===text){state.toast='';render();}},1800);}
function stopAllSpeech(){state.vocabPlayer.token++;state.vocabPlayer.playing=false;state.lesson.playing=false;speechSynthesis.cancel();}
function getVoice(lang,name){const voices=speechVoices();return voices.find(v=>v.name===name)||voices.find(v=>(v.lang||'').toLowerCase().startsWith(lang==='hi'?'hi':'en'))||null;}
function selectedVoiceName(lang,speaker='general'){const hi=lang==='hi';if(speaker==='S1')return state.vocabSettings[hi?'dialogueVoiceHiS1':'dialogueVoiceEnS1']||state.vocabSettings[hi?'voiceHi':'voiceEn'];if(speaker==='S2')return state.vocabSettings[hi?'dialogueVoiceHiS2':'dialogueVoiceEnS2']||state.vocabSettings[hi?'voiceHi':'voiceEn'];return state.vocabSettings[hi?'voiceHi':'voiceEn'];}
function speak(text,lang='en',rate=.9,token=null,speaker='general'){return new Promise(resolve=>{if(!('speechSynthesis'in window)||!text)return resolve();const u=new SpeechSynthesisUtterance(text);u.lang=lang==='hi'?'hi-IN':'en-AU';u.rate=Number(rate)||1;u.voice=getVoice(lang,selectedVoiceName(lang,speaker));u.onend=()=>resolve();u.onerror=()=>resolve();speechSynthesis.speak(u);});}
function vocabRate(lang){return Number(lang==='hi'?state.vocabSettings.rateHi:state.vocabSettings.rateEn)||Number(state.vocabSettings.rate)||.9;}
function vocabTokenActive(token){return token===null||token===undefined||token===state.vocabPlayer.token;}
async function vocabDelay(seconds,token){const ms=Math.max(0,Number(seconds)||0)*1000;if(ms)await delay(ms);return vocabTokenActive(token);}
async function speakLearningPair(english,hindi,token=null){
  const mode=state.vocabSettings.reading==='both'?'en-hi':state.vocabSettings.reading,translationDelay=Number(state.vocabSettings.translationDelay)||0;
  if(mode==='english'){await speak(english,'en',vocabRate('en'),token);return vocabTokenActive(token);}
  if(mode==='hindi'){await speak(hindi,'hi',vocabRate('hi'),token);return vocabTokenActive(token);}
  const first=mode==='hi-en'?['hi',hindi]:['en',english],second=mode==='hi-en'?['en',english]:['hi',hindi];
  await speak(first[1],first[0],vocabRate(first[0]),token);if(!vocabTokenActive(token))return false;
  if(!await vocabDelay(translationDelay,token))return false;
  await speak(second[1],second[0],vocabRate(second[0]),token);return vocabTokenActive(token);
}
function mySynonymSpeechParts(item){
  const values=Array.isArray(item?.mySynonyms)?item.mySynonyms:[item?.mySynonyms];
  return values.flatMap(value=>String(value||'').split(/[,;|/\n]+/)).map(x=>x.trim()).filter(Boolean);
}
function synonymSpeechLanguage(text){
  return /[\u0900-\u097F]/.test(String(text||''))?'hi':'en';
}
async function speakPersonalSynonyms(item,token=null){
  if(item?.itemType!=='my-vocab'||state.vocabSettings.speakMySynonyms===false)return true;
  const parts=mySynonymSpeechParts(item);
  for(const part of parts){
    if(!vocabTokenActive(token))return false;
    if(!await vocabDelay(.28,token))return false;
    const lang=synonymSpeechLanguage(part);
    await speak(part,lang,vocabRate(lang),token);
  }
  return vocabTokenActive(token);
}
function chime(){return new Promise(resolve=>{const C=window.AudioContext||window.webkitAudioContext;if(!C)return resolve();const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.setValueAtTime(.001,c.currentTime);g.gain.exponentialRampToValueAtTime(.22,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.4);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.42);o.onended=()=>{c.close();resolve();};});}

// Lesson presentation
async function playLesson(){
  state.lesson.playing=true;render();
  while(state.lesson.playing&&state.overlay==='lesson'&&!state.lesson.quiz){
    const chapter=state.lessonData.chapters[state.lesson.chapter],slide=chapter.slides[state.lesson.slide];
    speechSynthesis.cancel();
    if(state.lesson.lang==='bilingual'){
      await speak(slide.narrationEn,'en',state.lesson.rate);if(!state.lesson.playing)break;await delay(300);await speak(slide.narrationHi,'hi',state.lesson.rate);
    }else await speak(state.lesson.lang==='hi'?slide.narrationHi:slide.narrationEn,state.lesson.lang,state.lesson.rate);
    if(!state.lesson.playing)break;
    if(!moveLesson(1,false)){state.lesson.playing=false;saveLessonProgress(true);render();break;}
    render();await delay(350);
  }
}
function moveLesson(delta,rerender=true){
  const chapters=state.lessonData.chapters;let c=state.lesson.chapter,s=state.lesson.slide+delta;
  if(s>=chapters[c].slides.length){if(c>=chapters.length-1)return false;c++;s=0;}
  if(s<0){if(c<=0)return false;c--;s=chapters[c].slides.length-1;}
  state.lesson.chapter=c;state.lesson.slide=s;saveLessonProgress(false);if(rerender)render();return true;
}
function saveLessonProgress(completed){setJSON(storageKeys.lesson,{chapter:state.lesson.chapter,slide:state.lesson.slide,completed:completed||false,updatedAt:new Date().toISOString()});}

// Vocabulary player
function shufflePlaylistIds(ids){
  const list=[...ids];
  for(let i=list.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [list[i],list[j]]=[list[j],list[i]];
  }
  return list;
}
function buildPlaylist(){
  const list=filteredLearnItems(true).map(x=>x.id);
  return state.vocabSettings.order==='random'?shufflePlaylistIds(list):list;
}
function applyVocabularyOrderChange(order){
  state.vocabSettings.order=order==='random'?'random':'sequential';
  saveVocabSettings();
  const vp=state.vocabPlayer;
  if(state.overlay!=='vocab-player'||!Array.isArray(vp.queue)||vp.queue.length<=1)return;
  const currentId=vp.queue[vp.index]||'';
  let queue=filteredLearnItems(true).map(x=>x.id);
  if(!queue.length)return;
  if(state.vocabSettings.order==='random'){
    const remaining=shufflePlaylistIds(queue.filter(id=>id!==currentId));
    queue=currentId&&queue.includes(currentId)?[currentId,...remaining]:remaining;
    vp.index=0;
  }else{
    vp.index=Math.max(0,queue.indexOf(currentId));
  }
  vp.queue=queue;
  vp.token++;
  vp.playing=false;
  speechSynthesis.cancel();
  const activeId=vp.queue[vp.index]||vp.queue[0];
  if(activeId)setJSON(storageKeys.vocabResume,{title:vp.title,id:activeId,updatedAt:new Date().toISOString()});
  render();
  showToast(state.vocabSettings.order==='random'?'Random order applied':'In-order sequence applied');
}
function requestPlaylist(status){
  state.learn.status=status;const queue=buildPlaylist();state.modal={type:'playlist',title:statusLabels[status],count:queue.length,queue};render();
}
function startVocabularyPlaylist(useModal=true,single=null){
  let queue,title;
  if(single){queue=[single.id];title=single.english;}
  else {queue=state.modal?.queue||buildPlaylist();title=state.modal?.title||`${topicLabels[state.learn.topic]} · ${state.learn.status==='all'?'All statuses':statusLabels[state.learn.status]}`;}
  if(!queue.length){state.modal=null;showToast('No words match these filters');return;}
  const resume=getJSON(storageKeys.vocabResume,{});let index=0;if(resume.title===title&&queue.includes(resume.id))index=queue.indexOf(resume.id);
  Object.assign(state.vocabPlayer,{queue,index,playing:false,token:state.vocabPlayer.token+1,title,revealCurrent:false});state.modal=null;state.overlay='vocab-player';render();
}
async function speakVocabItem({autoplay=false}={}){
  const vp=state.vocabPlayer,item=allVocabItems().find(x=>x.id===vp.queue[vp.index]);if(!item)return;
  const token=++vp.token;const repeats=autoplay?Number(state.vocabSettings.repeat):1;
  speechSynthesis.cancel();
  for(let r=0;r<repeats;r++){
    if(token!==vp.token)return;
    if(!await speakLearningPair(item.english,item.hindi,token))return;
    if(!await speakPersonalSynonyms(item,token))return;
    if(state.vocabSettings.examples&&item.exampleEnglish){
      if(!await vocabDelay(.35,token))return;
      if(!await speakLearningPair(item.exampleEnglish,item.exampleHindi,token))return;
    }
    if(r<repeats-1&&!await vocabDelay(.35,token))return;
  }
  if(token===vp.token&&item.itemType==='phrase')recordPhrasePractice(item.id);
  if(!autoplay||!vp.playing||token!==vp.token)return;
  for(let g=Number(state.vocabSettings.gap);g>0;g--){vp.gapRemaining=g;render();await delay(1000);if(!vp.playing||token!==vp.token)return;}
  vp.gapRemaining=0;moveVocab(1,false);render();await delay(100);if(vp.playing)speakVocabItem({autoplay:true});
}
function moveVocab(delta,rerender=true){
  const vp=state.vocabPlayer;if(!vp.queue.length)return;let i=vp.index+delta;if(i>=vp.queue.length)i=0;if(i<0)i=vp.queue.length-1;vp.index=i;vp.revealCurrent=false;const id=vp.queue[i];setJSON(storageKeys.vocabResume,{title:vp.title,id,updatedAt:new Date().toISOString()});if(rerender)render();
}
async function stepVocab(delta){const was=state.vocabPlayer.playing;state.vocabPlayer.token++;speechSynthesis.cancel();moveVocab(delta);await speakVocabItem({autoplay:was});if(was&&state.vocabPlayer.playing===false){state.vocabPlayer.playing=true;speakVocabItem({autoplay:true});}}
function saveVocabSettings(){setJSON(storageKeys.vocabSettings,state.vocabSettings);}

// Dialogue recording and assessment
function getActiveSegments(){return state.retryIds?state.dialogue.segments.filter(s=>state.retryIds.includes(s.id)):state.dialogue.segments;}
function openDialogue(id,mode='learning',rerender=true){
  stopAllSpeech();const d=state.dialogues.find(x=>x.id===id);if(!d)return;
  Object.assign(state,{dialogue:d,dialogueMode:mode,segmentIndex:0,responses:[],completed:new Set(),repeats:0,playerStatus:'ready',feedback:null,retryIds:null,report:null});
  state.dialogueSettings={rate:mode==='mock'?1:.9,gap:mode==='mock'?'manual':20,showSourceTranscript:false};state.overlay='dialogue';if(rerender)render();
}
function clearResponseMedia(){if(state.recordingUrl){URL.revokeObjectURL(state.recordingUrl);state.recordingUrl='';}state.recordingBlob=null;state.recordingId='';state.recordingError='';state.recordingDuration=0;state.recordingMime='';state.transcript='';state.transcriptInterim='';state.transcriptStatus='idle';state.feedback=null;}
async function ensureMicrophone(){
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){state.micStatus='denied';state.micError='This browser cannot record audio. Use the latest Google Chrome.';render();return false;}
  try{state.stream?.getTracks().forEach(t=>t.stop());state.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});state.micStatus='ready';state.micError='';return true;}
  catch(e){state.micStatus='denied';state.micError=e?.name==='NotAllowedError'?'Microphone permission is blocked. Click the padlock beside the address, allow Microphone and try again.':'The microphone could not be opened. Check whether another app is using it.';render();return false;}
}
function targetLanguage(seg){return seg.sourceLanguage==='en'?'hi':'en';}
function startSpeechRecognition(lang){
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R){state.transcriptStatus='unsupported';return;}
  try{const r=new R();state.speechRecognition=r;r.lang=lang==='hi'?'hi-IN':'en-AU';r.continuous=true;r.interimResults=true;r.maxAlternatives=1;let final='';
    r.onspeechstart=()=>{if(!state.speechStartedAt)state.speechStartedAt=Date.now();};
    r.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript.trim();if(e.results[i].isFinal)final+=(final?' ':'')+t;else interim+=(interim?' ':'')+t;}state.transcript=final.trim();state.transcriptInterim=interim.trim();};
    r.onerror=e=>{if(!['no-speech','aborted'].includes(e.error))state.transcriptStatus='error';};r.onend=()=>{if(state.transcript.trim())state.transcriptStatus='complete';else if(state.transcriptStatus==='listening')state.transcriptStatus='empty';};r.start();state.transcriptStatus='listening';
  }catch{state.transcriptStatus='error';}
}
function stopSpeechRecognition(){return new Promise(resolve=>{const r=state.speechRecognition;if(!r)return resolve();let done=false;const finish=()=>{if(done)return;done=true;if(!state.transcript.trim()&&state.transcriptInterim.trim())state.transcript=state.transcriptInterim.trim();state.speechRecognition=null;resolve();};r.onend=finish;try{r.stop();}catch{finish();}setTimeout(finish,900);});}
function preferredMimeType(){
  const candidates=['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm'];
  for(const t of candidates)if(MediaRecorder.isTypeSupported?.(t))return t;
  return '';
}
function audioDurationFromBlob(blob){
  return new Promise(resolve=>{
    const url=URL.createObjectURL(blob),audio=document.createElement('audio');let settled=false;
    const finish=value=>{if(settled)return;settled=true;URL.revokeObjectURL(url);resolve(Number.isFinite(value)?value:0);};
    audio.preload='metadata';audio.onloadedmetadata=()=>finish(audio.duration);audio.onerror=()=>finish(0);audio.src=url;
    setTimeout(()=>finish(0),3500);
  });
}
function beginRecording(seg){
  try{
    state.chunks=[];state.recordingError='';state.recordingDuration=0;
    const mime=preferredMimeType();state.recordingMime=mime||'';
    state.recorder=new MediaRecorder(state.stream,mime?{mimeType:mime,audioBitsPerSecond:128000}:undefined);
    state.recorder.ondataavailable=e=>{if(e.data&&e.data.size>0)state.chunks.push(e.data);};
    state.recorder.onerror=e=>{state.recordingError=e?.error?.message||'The recording was interrupted.';};
    state.recorder.start(500);state.recording=true;state.recordingStartedAt=Date.now();state.speechStartedAt=0;startSpeechRecognition(targetLanguage(seg));render();return true;
  }catch(e){state.recording=false;state.micError=e?.message||'Recording could not start. Check microphone access and try again.';render();return false;}
}
async function stopRecording(){
  if(!state.recorder||state.recorder.state==='inactive'){state.recording=false;state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;return null;}
  return new Promise(resolve=>{
    const recorder=state.recorder;let settled=false;
    const finish=async()=>{
      if(settled)return;settled=true;
      const type=recorder.mimeType||state.recordingMime||'audio/mp4';
      const blob=new Blob(state.chunks,{type});
      state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;state.recording=false;state.recorder=null;
      if(blob.size<1024){state.recordingError='The recording file was empty or incomplete. Please record again.';resolve(null);return;}
      const duration=await audioDurationFromBlob(blob);state.recordingDuration=duration;
      if(!duration||duration<0.25){state.recordingError='The recording could not be verified for playback. Please record again.';resolve(null);return;}
      state.recordingBlob=blob;state.recordingUrl=URL.createObjectURL(blob);state.recordingId=`${state.dialogue.id}-${getActiveSegments()[state.segmentIndex].id}-${Date.now()}`;
      try{await saveBlob(state.recordingId,{blob,meta:{mime:type,size:blob.size,duration,createdAt:new Date().toISOString()}});}catch(e){state.recordingError='The recording could not be saved safely on this device.';resolve(null);return;}
      resolve(blob);
    };
    recorder.onstop=finish;
    try{recorder.requestData?.();setTimeout(()=>{try{recorder.stop();}catch{finish();}},180);}catch{try{recorder.stop();}catch{finish();}}
    setTimeout(finish,5000);
  });
}
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('aps-naati-complete-v2',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('recordings'))r.result.createObjectStore('recordings')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function saveBlob(id,value){const d=await db();try{await new Promise((resolve,reject)=>{const tx=d.transaction('recordings','readwrite');tx.objectStore('recordings').put(value,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Save aborted'));});}finally{d.close();}}
async function loadBlobRecord(id){if(!id)return null;try{const d=await db();try{return await new Promise((resolve,reject)=>{const tx=d.transaction('recordings','readonly');const r=tx.objectStore('recordings').get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)});}finally{d.close();}}catch{return null;}}
async function loadBlob(id){const value=await loadBlobRecord(id);if(!value)return null;return value instanceof Blob?value:value.blob instanceof Blob?value.blob:null;}
async function hydrateResponses(responses=[]){return Promise.all(responses.map(async r=>{const value=await loadBlobRecord(r.recordingId),blob=value instanceof Blob?value:value?.blob;const meta=value instanceof Blob?{}:(value?.meta||{});return {...r,recordingUrl:blob?URL.createObjectURL(blob):'',recordingStatus:blob?'saved':'missing',recordingMime:r.recordingMime||meta.mime||blob?.type||'',recordingSize:r.recordingSize||meta.size||blob?.size||0,duration:r.duration||meta.duration||0};}));}
async function playDialogueSegment(repeat=false){
  const seg=getActiveSegments()[state.segmentIndex];if(state.playerStatus==='playing'||state.recording)return;
  if(repeat)state.repeats++;
  clearResponseMedia();state.playerStatus='playing';render();speechSynthesis.cancel();await speak(seg.source,seg.sourceLanguage,state.dialogueSettings.rate,null,seg.speaker||'general');await chime();state.playerStatus='ready';
  const ok=await ensureMicrophone();if(!ok)return;beginRecording(seg);
  if(state.dialogueSettings.gap!=='manual'){state.countdown=Number(state.dialogueSettings.gap);clearInterval(state.timer);state.timer=setInterval(()=>{state.countdown--;render();if(state.countdown<=0){clearInterval(state.timer);finishRecording();}},1000);}
}
async function finishRecording(){
  if(!state.recording)return;
  clearInterval(state.timer);
  await stopSpeechRecognition();
  const blob=await stopRecording();
  const seg=getActiveSegments()[state.segmentIndex];
  const startDelay=state.speechStartedAt
    ?(state.speechStartedAt-state.recordingStartedAt)/1000
    :0;
  if(!blob){state.playerStatus='ready';render();return;}

  const browserTranscript=state.transcript.trim();
  let assessment={
    status:'unassessed',
    coverage:0,
    deduction:0,
    captured:[],
    review:[
      browserTranscript
        ?'The browser transcript could not be assessed automatically.'
        :'No automatic browser transcript was available. Use playback and the sample answer for manual comparison.'
    ],
    critical:[],
    units:[],
    strengths:['Your complete recording was saved and verified for playback.'],
    advice:['Replay your recording and compare it with the sample interpretation.']
  };

  if(browserTranscript){
    try{
      assessment=APSScoring.assessSegment(
        seg,
        browserTranscript,
        {startDelay:Number(startDelay||0)}
      );
    }catch(error){
      assessment.review=[
        error?.message||'Local browser comparison could not be generated.'
      ];
    }
  }

  const response={
    segmentId:seg.id,
    transcript:browserTranscript,
    browserTranscript,
    transcriptSource:browserTranscript?'browser-speech-recognition':'recording-only',
    transcriptStatus:state.transcriptStatus,
    recordingId:state.recordingId,
    recordingUrl:state.recordingUrl,
    recordingStatus:'saved',
    recordingMime:blob.type,
    recordingSize:blob.size,
    showTranscript:false,
    startDelay,
    duration:state.recordingDuration||((Date.now()-state.recordingStartedAt)/1000),
    assessment,
    practiceComparison:browserTranscript?assessment:null,
    practiceComparisonSource:browserTranscript?'browser-transcript-local-v1':'manual-recording-comparison',
    cloudTranscriptionStatus:'not-required-web'
  };

  state.responses[state.segmentIndex]=response;
  state.completed.add(seg.id);
  state.playerStatus='complete';
  // The response now owns this object URL. Detach it from the transient
  // recording state so starting another segment does not revoke the saved
  // response audio. This keeps Previous/Next review playback reliable.
  state.recordingUrl='';
  state.recordingBlob=null;
  state.recordingId='';
  render();

  if(nativeCloudTranscriptionAvailable()){
    void requestCloudTranscriptionForResponse(blob,seg,response)
      .finally(()=>{
        if(state.responses.includes(response))render();
      });
  }
}
let dialogueNavigationGeneration=0;
async function navigateDialogueSegment(delta){
  if(!state.dialogue)return;
  if(state.recording){
    showToast('Finish or skip the current recording before changing segments.');
    return;
  }
  const segments=getActiveSegments();
  const next=clamp(state.segmentIndex+Number(delta||0),0,segments.length-1);
  if(next===state.segmentIndex)return;

  const generation=++dialogueNavigationGeneration;
  // Cancel any source speech, countdown, recognition or pre-recording stage.
  // The study hotfix increments its playback generation too, preventing a
  // stale async Play operation from starting the microphone on the wrong row.
  try{window.APSStudyControls?.cancelCurrentStage?.();}catch{}
  clearInterval(state.timer);state.timer=null;state.countdown=0;
  try{speechSynthesis.cancel();}catch{}

  state.segmentIndex=next;
  state.feedback=null;
  state.playerStatus=state.responses[next]?'complete':'ready';
  render();

  // Older attempts may have a revoked/missing blob URL because earlier builds
  // reused transient recording state. Rehydrate the selected segment audio
  // from IndexedDB without blocking navigation.
  const response=state.responses[next];
  if(!response?.recordingId)return;
  try{
    const value=await loadBlobRecord(response.recordingId);
    if(generation!==dialogueNavigationGeneration||state.segmentIndex!==next)return;
    const blob=value instanceof Blob?value:value?.blob;
    if(!(blob instanceof Blob))return;
    if(response.recordingUrl){try{URL.revokeObjectURL(response.recordingUrl);}catch{}}
    response.recordingUrl=URL.createObjectURL(blob);
    response.recordingStatus='saved';
    if(!response.duration&&value?.meta?.duration)response.duration=value.meta.duration;
    render();
  }catch{}
}

function assessAndSaveDialogue(){
  const d=state.dialogue,segments=getActiveSegments();if(state.responses.filter(Boolean).length<segments.length)return showToast('Complete all segments first');
  const previous=getJSON(storageKeys.attempts,[]).filter(a=>a.dialogueId===d.id&&a.finished).at(-1)?.report||null;
  const report=APSScoring.aggregateDialogue(state.responses.map(r=>r.assessment),{repeats:state.repeats,previous});
  const attempt={id:`attempt-${Date.now()}`,dialogueId:d.id,title:d.title,mode:state.dialogueMode,startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),finished:true,repeats:state.repeats,responses:state.responses.map(r=>({...r,recordingUrl:''})),report};
  const attempts=getJSON(storageKeys.attempts,[]);attempts.push(attempt);setJSON(storageKeys.attempts,attempts.slice(-150));saveMistakes(attempt,d,segments);
  if(state.dialogueMode==='mock'&&state.mock){finishMockDialogue(attempt);return;}
  state.report={type:'dialogue',attempt:{...attempt,responses:state.responses}};state.overlay='report';render();
}
function saveMistakes(attempt,d,segments){let m=getJSON(storageKeys.mistakes,[]);attempt.responses.forEach((r,i)=>{if(['review','major'].includes(r.assessment.status))m.push({id:`mistake-${Date.now()}-${i}`,dialogueId:d.id,dialogueTitle:d.title,segmentId:segments[i].id,segmentNumber:i+1,status:r.assessment.status,review:r.assessment.review,mastered:false,createdAt:new Date().toISOString()});});setJSON(storageKeys.mistakes,m.slice(-300));}
function startMock(){const pair=currentMockPair();if(pair.length<2)return showToast('Two dialogues are required');state.mock={ids:pair.map(d=>d.id),current:0,attempts:[]};openDialogue(state.mock.ids[0],'mock');}
function finishMockDialogue(attempt){state.mock.attempts.push(attempt);if(state.mock.current===0){state.mock.current=1;openDialogue(state.mock.ids[1],'mock');state.mock=Object.assign(state.mock||{}, {current:1});showToast('Dialogue 1 complete. Dialogue 2 starts now.');return;}const pass=APSScoring.mockPass(state.mock.attempts[0].report,state.mock.attempts[1].report);state.report={type:'mock',dialogues:state.mock.attempts,pass};state.overlay='report';render();}
async function loadSavedReport(id){const a=getJSON(storageKeys.attempts,[]).find(x=>x.id===id);if(!a)return;const d=state.dialogues.find(x=>x.id===a.dialogueId);const responses=await hydrateResponses(a.responses);state.report={type:'dialogue',attempt:{...a,responses}};state.dialogue=d;state.overlay='report';render();}
function loadQADialogueReport(){const d=state.dialogues[0];const responses=d.segments.map((s,i)=>({segmentId:s.id,transcript:s.model,recordingUrl:'',assessment:APSScoring.assessSegment(s,s.model,{startDelay:3})}));const report=APSScoring.aggregateDialogue(responses.map(r=>r.assessment),{repeats:0});state.dialogue=d;state.report={type:'dialogue',attempt:{id:'qa',dialogueId:d.id,title:d.title,responses,report}};state.overlay='report';}

// Backup / restore
function backupProgress(){const data={version:'2.0.9-v19',createdAt:new Date().toISOString(),vocabStatus:getJSON(storageKeys.vocabStatus,{}),vocabSettings:state.vocabSettings,vocabResume:getJSON(storageKeys.vocabResume,{}),phraseStats:getJSON(storageKeys.phraseStats,{}),dialogueVocabProgress:getJSON(storageKeys.dialogueVocabProgress,{}),myVocabs:getJSON(storageKeys.myVocabs,{schemaVersion:1,items:{}}),attempts:getJSON(storageKeys.attempts,[]),lesson:getJSON(storageKeys.lesson,{}),mistakes:getJSON(storageKeys.mistakes,[]),account:{signedIn:Boolean(state.auth.user),provider:authProviderLabel()}};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`APS_NAATI_Progress_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);}
async function restoreProgress(file){try{const d=JSON.parse(await file.text());if(!d.version)throw new Error('Invalid backup');setJSON(storageKeys.vocabStatus,d.vocabStatus||{});setJSON(storageKeys.vocabSettings,d.vocabSettings||{});setJSON(storageKeys.vocabResume,d.vocabResume||{});setJSON(storageKeys.phraseStats,d.phraseStats||{});setJSON(storageKeys.dialogueVocabProgress,d.dialogueVocabProgress||{});if(d.myVocabs){setJSON(storageKeys.myVocabs,d.myVocabs);window.dispatchEvent(new CustomEvent('aps-my-vocabs-external-update'));}setJSON(storageKeys.attempts,d.attempts||[]);setJSON(storageKeys.lesson,d.lesson||{});setJSON(storageKeys.mistakes,d.mistakes||[]);Object.assign(state.vocabSettings,d.vocabSettings||{});normaliseVocabSettings(d.vocabSettings||{});saveVocabSettings();showToast('Progress restored');}catch{showToast('This backup could not be restored');}}

// Event handling
app.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action,id=el.dataset.id;
  if(a==='auth-apple')await completeAuth('apple');
  else if(a==='auth-google')await completeAuth('google');
  else if(a==='auth-guest')await completeAuth('guest');
  else if(a==='auth-email'){state.auth.error='';state.modal={type:'email-auth'};render();}
  else if(a==='auth-phone'){state.auth.error='';state.auth.phoneStage='number';state.modal={type:'phone-auth'};render();}
  else if(a==='auth-email-switch'){state.auth.emailMode=state.auth.emailMode==='create'?'signin':'create';state.auth.error='';render();}
  else if(a==='auth-email-submit'){const email=document.querySelector('#authEmail')?.value.trim(),password=document.querySelector('#authPassword')?.value||'';if(!email||password.length<6){state.auth.error='Enter a valid email and a password of at least 6 characters.';render();}else await completeAuth(state.auth.emailMode==='create'?'email-create':'email-signin',{email,password});}
  else if(a==='auth-phone-send'){const phoneNumber=document.querySelector('#authPhone')?.value.trim();if(!phoneNumber?.startsWith('+')){state.auth.error='Enter the full number beginning with + and the country code.';render();}else{state.auth.phone=phoneNumber;await completeAuth('phone-start',{phoneNumber});}}
  else if(a==='auth-phone-confirm'){const verificationCode=document.querySelector('#authPhoneCode')?.value.trim();if(!verificationCode){state.auth.error='Enter the SMS verification code.';render();}else await completeAuth('phone-confirm',{verificationId:state.auth.verificationId,verificationCode});}
  else if(a==='auth-phone-back'){state.auth.phoneStage='number';state.auth.error='';render();}
  else if(a==='auth-open'){state.modal=null;localStorage.removeItem(storageKeys.authChoice);state.auth.user=null;saveAuthProfile();render();}
  else if(a==='auth-signout'){await runAuth('signout');state.auth.user=null;saveAuthProfile();localStorage.removeItem(storageKeys.authChoice);state.modal=null;render();}
  else if(a==='auth-delete'){if(confirm('Delete this account? Local learning progress will remain on this device.')){try{await runAuth('delete');state.auth.user=null;saveAuthProfile();localStorage.removeItem(storageKeys.authChoice);state.modal=null;render();}catch(err){state.auth.error=err?.message||'Account could not be deleted. Sign in again and retry.';render();}}}
  else if(a==='complete-onboarding'){localStorage.setItem(storageKeys.onboard,'1');render();}
  else if(a==='tab'){stopAllSpeech();state.overlay=null;state.tab=id;render();}
  else if(a==='open-lesson'){stopAllSpeech();const p=getJSON(storageKeys.lesson,{chapter:0,slide:0});state.lesson.chapter=p.chapter||0;state.lesson.slide=p.slide||0;state.lesson.quiz=false;state.overlay='lesson';render();}
  else if(a==='close-overlay'){stopAllSpeech();state.overlay=null;render();}
  else if(a==='quick-dialogue')openDialogue(state.dialogues[0].id,'learning');
  else if(a==='learn-type'){state.learn.type=id;state.learn.status='all';state.learn.completion='all';state.learn.page=1;render();}
  else if(a==='reveal'){state.learn.revealed.has(id)?state.learn.revealed.delete(id):state.learn.revealed.add(id);render();}
  else if(a==='speak-item'){const item=(el.dataset.type==='words'?state.vocab:state.phrases).find(x=>x.id===id);if(item){speechSynthesis.cancel();await speakLearningPair(item.english,item.hindi,null);if(el.dataset.type==='phrases'){recordPhrasePractice(item.id);render();}}}
  else if(a==='single-item-player'){const item=(el.dataset.type==='words'?state.vocab:state.phrases).find(x=>x.id===id);startVocabularyPlaylist(false,{...item,itemType:el.dataset.type==='words'?'word':'phrase'});}
  else if(a==='status-playlist')requestPlaylist(id);
  else if(a==='play-current-filter'){state.modal={type:'playlist',title:`${topicLabels[state.learn.topic]} · Current filters`,count:buildPlaylist().length,queue:buildPlaylist()};render();}
  else if(a==='learn-page-prev')changeLearnPage(-1);
  else if(a==='learn-page-next')changeLearnPage(1);
  else if(a==='close-modal'){state.modal=null;render();}
  else if(a==='select-language')await chooseLanguage(el.dataset.language);
  else if(a==='switch-language'){const id=el.dataset.language;if(id!==state.selectedLanguage){await chooseLanguage(id);state.modal=null;state.tab='home';}else{state.modal=null;render();}}
  else if(a==='manage-languages'){state.modal={type:'manage-languages'};render();}
  else if(a==='app-settings'){stopAllSpeech();state.modal={type:'app-settings'};render();}
  else if(a==='refresh-voices'){await refreshVoiceCatalog();render();showToast('Voice list refreshed');}
  else if(a==='reset-voices'){Object.assign(state.vocabSettings,{voiceEn:'',voiceHi:'',dialogueVoiceEnS1:'',dialogueVoiceEnS2:'',dialogueVoiceHiS1:'',dialogueVoiceHiS2:''});saveVocabSettings();render();showToast('Automatic voices selected');}
  else if(a==='preview-voice'){speechSynthesis.cancel();const lang=el.dataset.lang||'en',speaker=el.dataset.speaker||'general',text=lang==='hi'?'नमस्ते। यह आपकी चुनी हुई हिन्दी आवाज़ का नमूना है।':'Hello. This is a preview of your selected English voice.';await speak(text,lang,.9,null,speaker);}
  else if(a==='confirm-playlist')startVocabularyPlaylist();
  else if(a==='close-vocab-player'){stopAllSpeech();state.overlay=null;state.tab='learn';render();}
  else if(a==='vocab-settings'){state.modal={type:'vocab-settings'};render();}
  else if(a==='toggle-hide-english'){state.vocabSettings.hideEnglish=!state.vocabSettings.hideEnglish;state.vocabPlayer.revealCurrent=false;saveVocabSettings();render();}
  else if(a==='toggle-hide-hindi'){state.vocabSettings.hideHindi=!state.vocabSettings.hideHindi;state.vocabPlayer.revealCurrent=false;saveVocabSettings();render();}
  else if(a==='toggle-recall-reveal'){if(state.vocabSettings.hideEnglish||state.vocabSettings.hideHindi){state.vocabPlayer.revealCurrent=!state.vocabPlayer.revealCurrent;render();}}
  else if(a==='speak-current'){state.vocabPlayer.playing=false;state.vocabPlayer.token++;await speakVocabItem({autoplay:false});render();}
  else if(a==='vocab-toggle'){if(state.vocabPlayer.playing){state.vocabPlayer.playing=false;state.vocabPlayer.token++;speechSynthesis.cancel();render();}else{state.vocabPlayer.playing=true;render();speakVocabItem({autoplay:true});}}
  else if(a==='vocab-prev')stepVocab(-1);
  else if(a==='vocab-next')stepVocab(1);
  else if(a==='vocab-status'){const itemId=state.vocabPlayer.queue[state.vocabPlayer.index];setItemStatus(itemId,id);}
  else if(a==='clear-practice-search'){state.practice.query='';render();}
  else if(a==='open-dialogue')openDialogue(id,el.dataset.mode);
  else if(a==='shuffle-mock'){state.mockPair=null;render();}
  else if(a==='start-mock')startMock();
  else if(a==='exit-dialogue'){if(state.recording)await finishRecording();stopAllSpeech();state.overlay=null;state.tab=state.dialogueMode==='mock'?'mock':'practice';render();}
  else if(a==='skip-listening')await window.APSStudyControls?.skipListeningAndRecord?.();
  else if(a==='skip-recording')window.APSStudyControls?.skipRecordingAndContinue?.();
  else if(a==='play-dialogue-segment')playDialogueSegment(false);
  else if(a==='repeat-dialogue-segment')playDialogueSegment(true);
  else if(a==='finish-recording')finishRecording();
  else if(a==='retry-mic'){state.micError='';ensureMicrophone();}
  else if(a==='toggle-source-transcript'){state.dialogueSettings.showSourceTranscript=!state.dialogueSettings.showSourceTranscript;render();}
  else if(a==='toggle-response-transcript'){
    const response=state.responses[state.segmentIndex];

    if(!response){
      showToast('Record an answer before comparing.');
      return;
    }

    response.showTranscript=!response.showTranscript;
    render();
  }
  else if(a==='play-sample-answer'){const seg=getActiveSegments()[state.segmentIndex];if(seg){speechSynthesis.cancel();await speak(seg.sampleAnswer||seg.model,seg.sourceLanguage==='en'?'hi':'en',state.dialogueSettings.rate,null,seg.speaker||'general');}}
  else if(a==='record-again'){state.responses[state.segmentIndex]=null;state.completed.delete(getActiveSegments()[state.segmentIndex].id);playDialogueSegment(false);}
  else if(a==='dialogue-prev')await navigateDialogueSegment(-1);
  else if(a==='dialogue-next')await navigateDialogueSegment(1);
  else if(a==='finish-dialogue')assessAndSaveDialogue();
  else if(a==='speak-text')speak(decodeURIComponent(el.dataset.text),el.dataset.lang||'en',.9,null,el.dataset.speaker||'general');
  else if(a==='close-report'){const wasMock=state.report?.type==='mock'||state.report?.attempt?.mode==='mock';state.overlay=null;state.report=null;state.mock=null;state.tab=wasMock?'mock':'practice';render();}
  else if(a==='print-report')window.print();
  else if(a==='retry-weak'){const ids=state.report.attempt.responses.map((r,i)=>['review','major'].includes(r.assessment.status)?state.dialogue.segments[i].id:null).filter(Boolean);openDialogue(state.dialogue.id,'learning');state.retryIds=ids;render();}
  else if(a==='repeat-full-dialogue')openDialogue(state.dialogue.id,'practice');
  else if(a==='open-saved-report')await loadSavedReport(id);
  else if(a==='toggle-mastered'){const m=getJSON(storageKeys.mistakes,[]),x=m.find(v=>v.id===id);if(x)x.mastered=!x.mastered;setJSON(storageKeys.mistakes,m);render();}
  else if(a==='backup-progress')backupProgress();
  else if(a==='restore-progress')document.querySelector('#restoreFile')?.click();
  else if(a==='lesson-toggle'){if(state.lesson.playing){state.lesson.playing=false;speechSynthesis.cancel();render();}else playLesson();}
  else if(a==='lesson-next'){state.lesson.playing=false;speechSynthesis.cancel();if(!moveLesson(1))state.lesson.quiz=true;render();}
  else if(a==='lesson-prev'){state.lesson.playing=false;speechSynthesis.cancel();moveLesson(-1);}
  else if(a==='lesson-chapter'){state.lesson.playing=false;speechSynthesis.cancel();state.lesson.chapter=Number(id);state.lesson.slide=0;saveLessonProgress(false);render();}
  else if(a==='lesson-captions'){state.lesson.captions=!state.lesson.captions;render();}
  else if(a==='lesson-quiz'){state.lesson.playing=false;speechSynthesis.cancel();state.lesson.quiz=true;state.lesson.quizIndex=0;render();}
  else if(a==='lesson-review'){state.lesson.quiz=false;render();}
  else if(a==='quiz-answer'){state.lesson.quizAnswers[state.lesson.quizIndex]=Number(id);render();}
  else if(a==='quiz-next'){state.lesson.quizIndex++;render();}
  else if(a==='lesson-finish'){saveLessonProgress(true);state.overlay=null;state.tab='practice';render();}
  else if(a==='review-mock-dialogue'){const attempt=state.report.dialogues[Number(id)],d=state.dialogues.find(x=>x.id===attempt.dialogueId),responses=await hydrateResponses(attempt.responses);state.dialogue=d;state.report={type:'dialogue',attempt:{...attempt,responses}};render();}
});
let searchRenderTimer=null;
function scheduleSearchRender(inputId){
  clearTimeout(searchRenderTimer);
  const el=document.getElementById(inputId);
  const selectionStart=el?.selectionStart??null;
  const selectionEnd=el?.selectionEnd??null;
  searchRenderTimer=setTimeout(()=>{
    render();
    requestAnimationFrame(()=>{
      const next=document.getElementById(inputId);
      if(next){
        next.focus({preventScroll:true});
        if(selectionStart!==null&&typeof next.setSelectionRange==='function'){
          const end=Math.min(selectionEnd??selectionStart,next.value.length);
          next.setSelectionRange(Math.min(selectionStart,next.value.length),end);
        }
      }
    });
  },220);
}
app.addEventListener('input',e=>{
  if(e.target.id==='learnQuery'){
    state.learn.query=e.target.value;
    state.learn.page=1;
    scheduleSearchRender('learnQuery');
  }else if(e.target.id==='practiceQuery'){
    state.practice.query=e.target.value;
    scheduleSearchRender('practiceQuery');
  }else if(e.target.id==='languageSearch'){
    state.languageQuery=e.target.value;
    scheduleSearchRender('languageSearch');
  }
});
app.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='learnTopic'){state.learn.topic=t.value;state.learn.page=1;render();}
  else if(t.id==='practiceTopic'){state.practice.topic=t.value;render();}
  else if(t.id==='practiceDifficulty'){state.practice.difficulty=t.value;render();}
  else if(t.id==='practiceReview'){state.practice.review=t.value;render();}
  else if(t.id==='practiceCompletion'){state.practice.completion=t.value;render();}
  else if(t.id==='learnCompletion'){state.learn.completion=t.value;state.learn.page=1;render();}
  else if(t.id==='learnStatus'){state.learn.status=t.value;state.learn.page=1;render();}
  else if(t.id==='learnPageSelect')changeLearnPage(Number(t.value),true);
  else if(t.id==='lessonLang'){state.lesson.lang=t.value;render();}
  else if(t.id==='lessonRate'){state.lesson.rate=Number(t.value);render();}
  else if(t.id==='vocabRateEn'){state.vocabSettings.rateEn=Number(t.value);saveVocabSettings();}
  else if(t.id==='vocabRateHi'){state.vocabSettings.rateHi=Number(t.value);saveVocabSettings();}
  else if(t.id==='vocabTranslationDelay'){state.vocabSettings.translationDelay=Number(t.value);saveVocabSettings();}
  else if(t.id==='vocabGap'){state.vocabSettings.gap=Number(t.value);saveVocabSettings();}
  else if(t.id==='vocabRepeat'){state.vocabSettings.repeat=Number(t.value);saveVocabSettings();}
  else if(t.id==='vocabOrder'){applyVocabularyOrderChange(t.value);}
  else if(t.id==='vocabReading'){state.vocabSettings.reading=t.value;saveVocabSettings();}
  else if(t.id==='vocabExamples'){state.vocabSettings.examples=t.checked;saveVocabSettings();}
  else if(t.id==='vocabMySynonyms'){state.vocabSettings.speakMySynonyms=t.checked;saveVocabSettings();}
  else if(t.id==='voiceEn'){state.vocabSettings.voiceEn=t.value;saveVocabSettings();}
  else if(t.id==='voiceHi'){state.vocabSettings.voiceHi=t.value;saveVocabSettings();}
  else if(t.id==='dialogueVoiceEnS1'){state.vocabSettings.dialogueVoiceEnS1=t.value;saveVocabSettings();}
  else if(t.id==='dialogueVoiceEnS2'){state.vocabSettings.dialogueVoiceEnS2=t.value;saveVocabSettings();}
  else if(t.id==='dialogueVoiceHiS1'){state.vocabSettings.dialogueVoiceHiS1=t.value;saveVocabSettings();}
  else if(t.id==='dialogueVoiceHiS2'){state.vocabSettings.dialogueVoiceHiS2=t.value;saveVocabSettings();}
  else if(t.id==='dialogueRate'){state.dialogueSettings.rate=Number(t.value);}
  else if(t.id==='dialogueGap'){state.dialogueSettings.gap=t.value==='manual'?'manual':Number(t.value);}
  else if(t.id==='restoreFile'&&t.files[0])restoreProgress(t.files[0]);
});
app.addEventListener('error',e=>{const audio=e.target;if(audio?.tagName==='AUDIO'&&audio.dataset.recordingId){const response=state.responses.find(r=>r?.recordingId===audio.dataset.recordingId);if(response){response.recordingStatus='playback-error';showToast('This recording cannot be played. Please record the segment again.');}}},true);
window.addEventListener('beforeunload',()=>{speechSynthesis.cancel();state.stream?.getTracks().forEach(t=>t.stop());});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
if('speechSynthesis'in window){speechSynthesis.onvoiceschanged=()=>{if(['vocab-settings','app-settings'].includes(state.modal?.type))render();};setTimeout(()=>speechSynthesis.getVoices(),0);setTimeout(()=>speechSynthesis.getVoices(),500);}
loadData();
