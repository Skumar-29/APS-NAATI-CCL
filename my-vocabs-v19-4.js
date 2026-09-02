(function(){
'use strict';
const VERSION='My Vocabs V19.4.1';
const VIEW_KEY='apsMyVocabsViewV194:hi';
const BULK_KEY='apsMyVocabsBulkTranslateV194:hi';
const ONLINE_CACHE_KEY='apsMyVocabsTranslationV3:hi';
const ONLINE_CACHE_TTL=1000*60*60*24*14;
const MY_KEY=storageKeys.myVocabs||'apsMyVocabsV1:hi';
const statusMeta={
  'needs-review':{label:'Needs Review',icon:'🔴',rank:0},
  learning:{label:'Learning',icon:'🟡',rank:1},
  mastered:{label:'Mastered',icon:'🟢',rank:2}
};
const synonymGroups=[
  ['appointment','booking','meeting'],['assistance','help','support'],['doctor','physician','gp','medical practitioner'],
  ['medicine','medication','drug'],['fee','charge','cost'],['information','details','particulars'],['document','record','paperwork'],
  ['application','request'],['process','procedure','steps'],['option','choice','alternative'],['evidence','proof','supporting information'],
  ['vaccination','immunisation'],['vaccine','immunisation'],['eligible','qualified','entitled'],['eligibility','qualification','entitlement'],
  ['refund','reimbursement','money back'],['complaint','grievance'],['appeal','review request'],['rent','rental payment'],
  ['landlord','rental provider'],['tenant','renter'],['bond','security deposit','rental bond'],['job','employment','position','role'],
  ['salary','pay','remuneration'],['wage','pay'],['interview','meeting'],['skill','ability','competency'],['contract','agreement'],
  ['lawyer','solicitor','legal practitioner'],['fine','penalty'],['witness','observer'],['evidence','proof'],['licence','permit'],
  ['registration','enrolment'],['income','earnings'],['payment','remittance'],['loan','credit'],['interest rate','rate of interest'],
  ['claim','request for compensation'],['insurance policy','policy'],['premium','insurance premium'],['coverage','cover','protection'],
  ['consumer','customer'],['purchase','buying'],['product','goods','item'],['supplier','provider'],['faulty','defective'],
  ['repair','fix'],['replacement','substitute'],['cancel','withdraw'],['cancellation','withdrawal'],['confirm','verify'],['confirmation','verification'],
  ['flight','air journey'],['baggage','luggage'],['reservation','booking'],['passport','travel document'],['customs','border customs'],
  ['community','local community'],['local council','council','municipal council'],['service','assistance'],['emergency','urgent situation'],
  ['symptom','sign'],['treatment','care','therapy'],['diagnosis','medical finding'],['specialist','expert'],['referral','medical referral'],
  ['check-up','health check','examination'],['pain','ache','discomfort'],['illness','sickness','disease'],['injury','wound','harm'],
  ['form','application form'],['deadline','due date'],['reference number','reference','case number'],['receipt','proof of payment'],
  ['approved','accepted','authorised'],['refused','rejected','declined'],['required','necessary','mandatory'],['optional','voluntary'],
  ['contact','get in touch'],['notify','inform','advise'],['provide','supply','give'],['receive','get'],['submit','lodge','file'],
  ['issue','problem','matter'],['resolve','settle','fix'],['dispute','disagreement'],['condition','requirement'],['criteria','requirements']
];
const groupIndex=new Map();
synonymGroups.forEach(group=>group.forEach(x=>groupIndex.set(normaliseSearchText(x),group)));

state.myVocabWorkspace=state.myVocabWorkspace||{query:'',status:'all',source:'all',sort:'sheet',player:false};
if(!state.myVocabWorkspace.sort||state.myVocabWorkspace.sort==='recent')state.myVocabWorkspace.sort='sheet';
const selectedIds=new Set();
let selectionAnchorId=null;
let bulkRunnerActive=false;

function iso(){return new Date().toISOString();}
function blankStore(){return {schemaVersion:1,updatedAt:'',items:{}};}
function store(){
  const raw=getJSON(MY_KEY,null);
  if(!raw)return blankStore();
  if(Array.isArray(raw)){
    const s=blankStore();raw.forEach(r=>{if(r?.id)s.items[r.id]=r;});return s;
  }
  return {schemaVersion:1,updatedAt:raw.updatedAt||'',items:raw.items&&typeof raw.items==='object'?raw.items:{}};
}
function saveStore(s){s.schemaVersion=1;s.updatedAt=iso();setJSON(MY_KEY,s);}

function defaultView(){return {widths:{no:64,english:250,hindi:285,synonyms:300,recall:165,actions:220},density:'comfortable'};}
function viewSettings(){const raw=getJSON(VIEW_KEY,null)||{};const d=defaultView();return {widths:{...d.widths,...(raw.widths||{})},density:raw.density==='compact'?'compact':'comfortable'};}
function saveViewSettings(v){setJSON(VIEW_KEY,v);}
function tableStyle(){const v=viewSettings(),w=v.widths;return `--my-col-no:${Number(w.no)||64}px;--my-col-english:${Number(w.english)||250}px;--my-col-hindi:${Number(w.hindi)||285}px;--my-col-synonyms:${Number(w.synonyms)||300}px;--my-col-recall:${Number(w.recall)||165}px;--my-col-actions:${Number(w.actions)||220}px;`;}
function bulkJob(){const j=getJSON(BULK_KEY,null);return j&&typeof j==='object'?j:null;}
function saveBulkJob(j){if(!j){localStorage.removeItem(BULK_KEY);return;}setJSON(BULK_KEY,j);}
function missingHindiRows(){return rows().filter(r=>String(r.english||'').trim()&&!String(r.hindi||'').trim());}
function bulkStatusText(j=bulkJob()){
  if(!j)return '';
  const total=Number(j.total)||0,done=Number(j.done)||0,failed=(j.failedIds||[]).length,pending=(j.pendingIds||[]).length;
  if(j.status==='waiting')return `Waiting for internet · ${pending.toLocaleString()} words remaining`;
  if(j.status==='paused')return `Bulk translation paused · ${done.toLocaleString()} / ${total.toLocaleString()} finished`;
  if(j.status==='cancelled')return `Bulk translation cancelled · ${done.toLocaleString()} translated`;
  if(j.status==='done')return failed?`Bulk translation finished · ${done.toLocaleString()} translated · ${failed.toLocaleString()} failed`:`✓ Bulk translation finished · ${done.toLocaleString()} / ${total.toLocaleString()} translated`;
  return `Translating ${Math.min(done+1,total).toLocaleString()} / ${total.toLocaleString()} · ${pending.toLocaleString()} remaining`;
}
function updateBulkDom(){
  const box=document.querySelector('#myBulkTranslationStatus');if(!box)return;
  let j=bulkJob();
  // A completed/cancelled queue must never leave a stale progress strip behind.
  // Only keep the strip after completion when failed untranslated rows still need Retry Failed.
  if(j&&j.status==='done'){
    const failed=(j.failedIds||[]).filter(id=>{const r=findMy(id);return r&&String(r.english||'').trim()&&!String(r.hindi||'').trim();});
    if(!failed.length){saveBulkJob(null);j=null;}else if(failed.length!==(j.failedIds||[]).length){j.failedIds=failed;saveBulkJob(j);}
  }
  if(j&&j.status==='cancelled'){saveBulkJob(null);j=null;}
  if(!j){box.hidden=true;box.removeAttribute('data-state');return;}
  box.hidden=false;box.dataset.state=j.status||'running';
  const text=box.querySelector('[data-bulk-text]');if(text)text.textContent=bulkStatusText(j);
  const bar=box.querySelector('progress');if(bar){bar.max=Math.max(1,Number(j.total)||1);bar.value=Math.min(Number(j.total)||1,(Number(j.done)||0)+(j.failedIds||[]).length);}
  const terminal=j.status==='done'||j.status==='cancelled';
  const pause=box.querySelector('[data-action="my-bulk-pause"]');if(pause){pause.hidden=terminal;pause.textContent=j.status==='paused'?'▶ Resume':'Ⅱ Pause';}
  const cancel=box.querySelector('[data-action="my-bulk-cancel"]');if(cancel)cancel.hidden=terminal;
  const retry=box.querySelector('[data-action="my-bulk-retry"]');if(retry)retry.hidden=!(j.status==='done'&&(j.failedIds||[]).length);
}
function activeSheetOrder(){
  return rows().slice().sort((a,b)=>Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0)||String(a.id).localeCompare(String(b.id)));
}
function rowNumberMap(){const m=new Map();activeSheetOrder().forEach((r,i)=>m.set(r.id,i+1));return m;}
function selectedRows(){const map=new Map(rows().map(r=>[r.id,r]));return [...selectedIds].map(id=>map.get(id)).filter(Boolean);}
function updateSelectedDom(){
  document.querySelectorAll('[data-my-row]').forEach(tr=>tr.classList.toggle('my-row-selected',selectedIds.has(tr.dataset.myRow)));
  const badge=document.querySelector('#mySelectedCount');if(badge)badge.textContent=selectedIds.size?`${selectedIds.size} selected`:'';
  const play=document.querySelector('[data-action="my-play-selected"]');if(play){play.hidden=!selectedIds.size;play.disabled=!selectedRows().some(r=>r.english&&r.hindi);}
  const clear=document.querySelector('[data-action="my-clear-selection"]');if(clear)clear.hidden=!selectedIds.size;
}
function clearSelection(){selectedIds.clear();selectionAnchorId=null;updateSelectedDom();}
function visibleRowIds(){return [...document.querySelectorAll('[data-my-row]')].map(tr=>tr.dataset.myRow);}
function selectRange(fromId,toId,{add=false}={}){
  const ids=visibleRowIds(),a=ids.indexOf(fromId),b=ids.indexOf(toId);if(a<0||b<0)return;
  if(!add)selectedIds.clear();for(let i=Math.min(a,b);i<=Math.max(a,b);i++)selectedIds.add(ids[i]);updateSelectedDom();
}
function selectRow(id,{toggle=false,range=false}={}){
  if(range&&selectionAnchorId){selectRange(selectionAnchorId,id);return;}
  if(toggle){selectedIds.has(id)?selectedIds.delete(id):selectedIds.add(id);}else{selectedIds.clear();selectedIds.add(id);}
  selectionAnchorId=id;updateSelectedDom();
}

function rows(includeDeleted=false){
  const list=Object.values(store().items||{}).filter(x=>x&&x.id&&(includeDeleted||!x.deleted));
  return list;
}
function findMy(id){return store().items?.[id]||null;}
function makeId(){return `myv-hi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
function cleanList(v){
  const arr=Array.isArray(v)?v:String(v||'').split(/[,;\n]/);
  const seen=new Set(),out=[];arr.forEach(x=>{const t=String(x||'').trim(),k=normaliseSearchText(t);if(t&&!seen.has(k)){seen.add(k);out.push(t);}});return out;
}
function sourceLabel(src){
  if(!src)return 'Manual';
  if(src.type==='dialogue')return `${src.library==='original'?'Original Source':'Verified Practice'} · ${src.title||src.dialogueId||'Dialogue'}`;
  return src.label||'Manual';
}
function sourcesText(r){return (r.sources||[]).map(sourceLabel).filter(Boolean).join(' · ')||'Manual';}
function addSource(record,src){
  if(!src)return record;
  record.sources=Array.isArray(record.sources)?record.sources:[];
  const key=src.type==='dialogue'?`${src.dialogueId||''}|${src.segmentId||''}`:`${src.type||'manual'}|${src.label||''}`;
  if(!record.sources.some(s=>(s.type==='dialogue'?`${s.dialogueId||''}|${s.segmentId||''}`:`${s.type||'manual'}|${s.label||''}`)===key))record.sources.push(src);
  return record;
}
function currentDialogueSource(){
  const d=state.dialogue;if(!d)return {type:'manual',label:'Manual',addedAt:iso()};
  const seg=(typeof getActiveSegments==='function'?getActiveSegments():d.segments||[])[state.segmentIndex]||{};
  return {type:'dialogue',dialogueId:d.id,title:d.title||d.id,library:String(d.id||'').startsWith('original-')?'original':'verified',segmentId:seg.id||'',addedAt:iso()};
}
function suggestedSynonyms(term){
  const key=normaliseSearchText(term),group=groupIndex.get(key)||[];
  return group.filter(x=>normaliseSearchText(x)!==key);
}
function verifiedLookup(term){
  const key=normaliseSearchText(term);if(!key)return null;
  const core=(state.vocab||[]).find(x=>normaliseSearchText(x.english)===key);
  if(core)return {...core,lookupSource:'Core Vocabulary'};
  const general=(state.generalVocab||[]).find(x=>x.qualityStatus!=='source-reference'&&normaliseSearchText(x.english)===key);
  if(general)return {...general,lookupSource:'Reviewed General Vocabs'};
  const dialogueRows=Object.values(state.dialogueVocabById||{}).flatMap(r=>(r.items||[]).map(x=>({...x,_dialogueId:r.dialogueId})));
  for(const row of dialogueRows){
    if(normaliseSearchText(row.english)!==key)continue;
    if(row.masterVocabId){
      const m=(state.vocab||[]).find(x=>x.id===row.masterVocabId);if(m)return {...m,lookupSource:'Dialogue Vocabulary'};
    }
    if(!String(row._dialogueId||'').startsWith('original-'))return {...row,lookupSource:'Verified Dialogue Vocabulary'};
  }
  return null;
}
function localLookupProposal(term){
  const hit=verifiedLookup(term),syn=suggestedSynonyms(term);
  return {
    hindi:hit?.hindi||'',suggestedSynonyms:syn,
    exampleEnglish:hit?.exampleEnglish||'',exampleHindi:hit?.exampleHindi||'',
    topic:hit?.topic||'community',lookupSource:hit?.lookupSource||'',online:false
  };
}
function onlineCache(){return getJSON(ONLINE_CACHE_KEY,{items:{}})||{items:{}};}
function cacheOnline(term,data){const c=onlineCache(),k=normaliseSearchText(term);c.items=c.items||{};c.items[k]={at:Date.now(),data};setJSON(ONLINE_CACHE_KEY,c);}
function cachedOnline(term){const e=onlineCache().items?.[normaliseSearchText(term)];return e&&Date.now()-Number(e.at||0)<ONLINE_CACHE_TTL?e.data:null;}
async function fetchJson(url,timeout=6500){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
  try{const r=await fetch(url,{signal:ctl.signal,cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}
  finally{clearTimeout(timer);}
}
function usableTranslation(v){const s=String(v||'').trim();return s&&!/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(s);}
const translateInflight=new Map();
let translateQueue=Promise.resolve();
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function extractTranslationPayload(data){
  if(typeof data==='string')return data.trim();
  if(Array.isArray(data)){
    // translate_a/single: [[['आना','come',...]], ...]
    if(Array.isArray(data[0])){
      const pieces=[];
      for(const part of data[0]){
        if(Array.isArray(part)&&typeof part[0]==='string')pieces.push(part[0]);
        else if(typeof part==='string')pieces.push(part);
      }
      const joined=pieces.join('').trim();if(joined)return joined;
    }
    // Chrome dictionary endpoint may return a plain first string.
    if(typeof data[0]==='string')return data[0].trim();
    for(const item of data){const v=extractTranslationPayload(item);if(v)return v;}
  }
  if(data&&typeof data==='object'){
    if(typeof data.translatedText==='string')return data.translatedText.trim();
    if(Array.isArray(data.sentences))return data.sentences.map(x=>x?.trans||'').join('').trim();
  }
  return '';
}
async function googleTranslateAttempt(q,target='hi'){
  const urls=[
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(q)}`,
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(q)}`,
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${encodeURIComponent(target)}&q=${encodeURIComponent(q)}`
  ];
  for(let i=0;i<urls.length;i++){
    try{
      const d=await fetchJson(urls[i],i===0?9000:7000),v=extractTranslationPayload(d);
      if(usableTranslation(v))return v;
    }catch{}
    if(i<urls.length-1)await sleep(180*(i+1));
  }
  return '';
}
async function translateOnline(text,target='hi'){
  const q=String(text||'').trim();if(!q||!navigator.onLine)return '';
  const key=`${target}|${normaliseSearchText(q)}`;
  const cached=cachedOnline(key);if(cached?.hindi)return cached.hindi;
  if(translateInflight.has(key))return translateInflight.get(key);
  const task=translateQueue.then(async()=>{
    let result='';
    for(let attempt=0;attempt<3&&!result;attempt++){
      result=await googleTranslateAttempt(q,target);
      if(!result&&attempt<2)await sleep(450*(attempt+1));
    }
    if(result)cacheOnline(key,{hindi:result});
    return result;
  }).catch(()=> '');
  // Keep requests one-at-a-time so rapid Enter entry does not overwhelm the translation service.
  translateQueue=task.then(()=>undefined,()=>undefined);
  translateInflight.set(key,task);
  try{return await task;}finally{translateInflight.delete(key);}
}
async function lookupProposal(term){
  const q=String(term||'').trim();if(!q)return {hindi:'',topic:'community',lookupSource:'',online:false};
  if(navigator.onLine){
    const hindi=await translateOnline(q,'hi');
    if(hindi)return {hindi,topic:verifiedLookup(q)?.topic||'community',lookupSource:'Online translation',online:true};
  }
  // Offline/failure fallback only: use installed APS content if it has an exact reviewed match.
  const local=localLookupProposal(q);
  return {hindi:local.hindi||'',topic:local.topic||'community',lookupSource:local.lookupSource||(navigator.onLine?'APS fallback · online translation unavailable':'APS offline fallback'),online:false};
}
function newRecord(src=null){
  const now=iso();const r={id:makeId(),english:'',hindi:'',suggestedSynonyms:[],mySynonyms:[],exampleEnglish:'',exampleHindi:'',status:'needs-review',topic:'community',sources:[],practiceCount:0,lastPractisedAt:'',createdAt:now,updatedAt:now,deleted:false,manualFields:{}};
  if(src)addSource(r,src);return r;
}
function upsert(record){const s=store();record.updatedAt=iso();record.manualFields=record.manualFields||{};s.items[record.id]=record;saveStore(s);return record;}
async function applyLookup(record,{fillMissingOnly=true,replaceAuto=false}={}){
  const p=await lookupProposal(record.english);record.manualFields=record.manualFields||{};
  if(p.hindi&&!record.manualFields.hindi&&(!fillMissingOnly||replaceAuto||!String(record.hindi||'').trim()))record.hindi=p.hindi;
  if(record.topic==='community'&&p.topic)record.topic=p.topic;
  record.lookupSource=p.lookupSource||record.lookupSource||'';record.lastLookupOnline=Boolean(p.online);record.lastLookupAt=iso();
  return record;
}
function personalPlayerItem(r){return {id:r.id,english:r.english||'',hindi:r.hindi||'',exampleEnglish:r.exampleEnglish||'',exampleHindi:r.exampleHindi||'',topic:r.topic||'community',itemType:'my-vocab',mySynonyms:r.mySynonyms||[],suggestedSynonyms:r.suggestedSynonyms||[]};}

// Make personal rows available to the existing vocabulary player without changing master libraries.
const baseAllVocabItems=allVocabItems;
allVocabItems=function v191AllVocabItems(){return [...baseAllVocabItems(),...rows().filter(r=>r.english&&r.hindi).map(personalPlayerItem)];};
const baseItemStatus=itemStatus;
itemStatus=function v191ItemStatus(id){
  const r=findMy(id);if(!r||r.deleted)return baseItemStatus(id);
  return r.status==='mastered'?'known':r.status==='learning'?'learning':'again';
};
const baseSetItemStatus=setItemStatus;
setItemStatus=function v191SetItemStatus(id,status){
  const r=findMy(id);if(!r||r.deleted)return baseSetItemStatus(id,status);
  r.status=status==='known'?'mastered':status==='learning'?'learning':'needs-review';upsert(r);render();
};
const baseSpeakVocabItem=speakVocabItem;
speakVocabItem=async function v191SpeakVocabItem(options={}){
  const id=state.vocabPlayer?.queue?.[state.vocabPlayer.index],r=findMy(id);
  if(r&&!r.deleted){r.practiceCount=(Number(r.practiceCount)||0)+1;r.lastPractisedAt=iso();upsert(r);}
  return baseSpeakVocabItem(options);
};

function filteredRows(){
  const w=state.myVocabWorkspace||{},q=String(w.query||'').trim();let list=rows();
  if(w.status&&w.status!=='all')list=list.filter(r=>r.status===w.status);
  if(q)list=list.filter(r=>searchMatches(`${r.english} ${r.hindi} ${(r.mySynonyms||[]).join(' ')}`,q));
  const sort=w.sort||'recent';
  list.sort((a,b)=>sort==='az'?String(a.english||'').localeCompare(String(b.english||'')):sort==='status'?(statusMeta[a.status]?.rank??0)-(statusMeta[b.status]?.rank??0)||String(a.english||'').localeCompare(String(b.english||'')):sort==='recent'?Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0):Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0)||String(a.id).localeCompare(String(b.id)));
  return list;
}
function counts(){const a=rows();return {all:a.length,review:a.filter(x=>x.status==='needs-review').length,learning:a.filter(x=>x.status==='learning').length,mastered:a.filter(x=>x.status==='mastered').length};}
function statusOptionsFor(value){return Object.entries(statusMeta).map(([id,m])=>`<option value="${id}" ${value===id?'selected':''}>${m.icon} ${m.label}</option>`).join('');}
function rowHtml(r,rowNo){
  const selected=selectedIds.has(r.id)?' my-row-selected':'';
  return `<tr class="${selected.trim()}" data-my-row="${esc(r.id)}" data-search="${esc(normaliseSearchText(`${r.english} ${r.hindi} ${(r.mySynonyms||[]).join(' ')}`))}">
    <td class="my-no-cell" data-row-selector="${esc(r.id)}" tabindex="0" title="Click to select this row">${Number(rowNo)||''}</td>
    <td class="my-freeze-english"><input class="my-cell my-english" data-my-field="english" data-id="${esc(r.id)}" value="${esc(r.english||'')}" placeholder="English word"></td>
    <td class="my-freeze-hindi"><input class="my-cell my-hindi" data-my-field="hindi" data-id="${esc(r.id)}" value="${esc(r.hindi||'')}" placeholder="${r.lookupSource==='Translating…'?'Translating…':'Hindi meaning'}"></td>
    <td><input class="my-cell" data-my-field="mySynonyms" data-id="${esc(r.id)}" value="${esc((r.mySynonyms||[]).join(', '))}" placeholder="Type your synonyms"></td>
    <td><select class="my-cell my-status ${esc(r.status)}" data-my-field="status" data-id="${esc(r.id)}" aria-label="Recall status">${statusOptionsFor(r.status)}</select></td>
    <td class="my-row-actions"><button data-action="my-autofill" data-id="${esc(r.id)}" title="Retry online Hindi translation">↻ Translate</button><button data-action="my-play-one" data-id="${esc(r.id)}" title="Open in word player">▶ Play</button><button class="danger-text" data-action="my-delete" data-id="${esc(r.id)}" title="Delete this personal row">Delete</button></td>
  </tr>`;
}
function resizerHtml(col){return `<span class="my-col-resizer" data-resize-col="${col}" title="Drag to resize · double-click to auto fit"></span>`;}
function networkBadge(){return navigator.onLine?'<span class="my-online"><i></i> Online translation</span>':'<span class="my-offline"><i></i> Offline fallback</span>';}
function workspace(){
  const list=filteredRows(),c=counts(),newWindow=new URL(location.href).searchParams.get('myvocabs')==='1',nums=rowNumberMap(),view=viewSettings();
  const playable=list.filter(r=>r.english&&r.hindi).length;
  return `<div class="fullscreen my-vocabs-screen ${newWindow?'my-vocabs-focus':''} ${view.density==='compact'?'my-density-compact':''}"><header class="top my-vocabs-top">${newWindow?'':`<button data-action="close-my-vocabs">← Back</button>`}<div class="my-vocab-title"><strong>My Vocabs</strong><span>✓ Autosaved · ${networkBadge()}</span></div><div class="top-actions">${newWindow?'':`<button data-action="open-my-vocabs-window">▣ New window</button>`}<button data-action="my-help" title="How My Vocabs works">? Help</button>${newWindow?'':`<button class="player-settings-button" data-action="app-settings">⚙ <b>Settings</b></button>`}${newWindow?`<button class="my-close-focus" data-action="close-my-vocabs">✕ Close</button>`:''}</div></header>
  <main class="my-vocabs-main"><section class="my-vocab-stats"><button data-action="my-filter-status" data-id="all" class="${state.myVocabWorkspace.status==='all'?'active':''}"><strong>${c.all}</strong><span>All</span></button><button data-action="my-filter-status" data-id="needs-review" class="review ${state.myVocabWorkspace.status==='needs-review'?'active':''}"><strong>${c.review}</strong><span>🔴 Review</span></button><button data-action="my-filter-status" data-id="learning" class="learning ${state.myVocabWorkspace.status==='learning'?'active':''}"><strong>${c.learning}</strong><span>🟡 Learning</span></button><button data-action="my-filter-status" data-id="mastered" class="mastered ${state.myVocabWorkspace.status==='mastered'?'active':''}"><strong>${c.mastered}</strong><span>🟢 Mastered</span></button></section>
  <section class="my-vocab-toolbar my-vocab-toolbar-v194"><label class="search"><span>⌕</span><input id="myVocabSearch" type="search" placeholder="Search English, Hindi or your synonyms" value="${esc(state.myVocabWorkspace.query||'')}"></label><select id="myVocabStatusFilter"><option value="all">All recall statuses</option>${Object.entries(statusMeta).map(([id,m])=>`<option value="${id}" ${state.myVocabWorkspace.status===id?'selected':''}>${m.icon} ${m.label}</option>`).join('')}</select><select id="myVocabSort"><option value="sheet" ${state.myVocabWorkspace.sort==='sheet'?'selected':''}>Sheet order</option><option value="recent" ${state.myVocabWorkspace.sort==='recent'?'selected':''}>Recently changed</option><option value="az" ${state.myVocabWorkspace.sort==='az'?'selected':''}>English A–Z</option><option value="status" ${state.myVocabWorkspace.sort==='status'?'selected':''}>Recall status</option></select><select id="myVocabDensity"><option value="comfortable" ${view.density==='comfortable'?'selected':''}>Comfortable rows</option><option value="compact" ${view.density==='compact'?'selected':''}>Compact rows</option></select></section>
  <section class="my-vocab-actions"><button class="primary" data-action="my-add-row">+ Add Row</button><button class="secondary" data-action="my-translate-all">↻ Translate All Missing</button><button class="secondary" data-action="my-play-filtered" ${playable?'':'disabled'}>▶ Play Filtered (${playable})</button><button class="secondary" data-action="my-play-selected" hidden>▶ Play Selected</button><button class="secondary" data-action="my-clear-selection" hidden>Clear Selection</button><button class="secondary" data-action="my-auto-fit-all">Auto Fit Columns</button><button class="secondary" data-action="my-reset-widths">Reset Widths</button><button class="secondary" data-action="my-export-csv">Export CSV</button><button class="secondary" data-action="my-import-trigger">Import CSV</button><input id="myImportCsv" type="file" accept=".csv,text/csv" hidden><span id="mySelectedCount"></span><span>${list.length.toLocaleString()} rows</span></section>
  <section id="myBulkTranslationStatus" class="my-bulk-status" hidden><div class="my-bulk-status-line"><strong data-bulk-text></strong><div><button class="secondary" data-action="my-bulk-pause">Ⅱ Pause</button><button class="secondary" data-action="my-bulk-retry" hidden>Retry Failed</button><button class="secondary danger-text" data-action="my-bulk-cancel">Cancel</button></div></div><progress value="0" max="1"></progress></section>
  <div class="my-sheet-wrap"><table class="my-sheet my-sheet-v194" style="${tableStyle()}"><thead><tr><th class="my-freeze-no">No.</th><th class="my-freeze-english">English${resizerHtml('english')}</th><th class="my-freeze-hindi">Hindi Meaning${resizerHtml('hindi')}</th><th>My Synonyms${resizerHtml('synonyms')}</th><th>Recall${resizerHtml('recall')}</th><th>Actions${resizerHtml('actions')}</th></tr></thead><tbody>${list.map(r=>rowHtml(r,nums.get(r.id))).join('')||`<tr><td colspan="6"><div class="my-empty"><h3>${rows().length?'No rows match these filters':'Your personal vocabulary sheet is empty'}</h3><p>${rows().length?'Change the search or recall filter.':'Type an English word and press Enter. Hindi translation fills automatically while you type the next word.'}</p><button class="primary" data-action="my-add-row">+ Add your first word</button></div></td></tr>`}</tbody></table></div></main>${renderModal()}</div>`;
}
function captureReturnContext(){
  if(state.overlay==='my-vocabs')return;
  state.myVocabReturnContext={tab:state.tab,overlay:state.overlay,segmentIndex:state.segmentIndex,dialogueMode:state.dialogueMode,scrollY:window.scrollY||0};
}
function restoreReturnContext(){
  const c=state.myVocabReturnContext;state.myVocabWorkspace.player=false;state.overlay=c?.overlay??null;state.tab=c?.tab||'learn';
  if(Number.isInteger(c?.segmentIndex))state.segmentIndex=c.segmentIndex;if(c?.dialogueMode)state.dialogueMode=c.dialogueMode;state.myVocabReturnContext=null;render();
  requestAnimationFrame(()=>window.scrollTo(0,Number(c?.scrollY)||0));
}
function openWorkspace(separate=true){
  if(separate){
    const u=new URL(location.href);u.searchParams.set('myvocabs','1');u.hash='my-vocabs';
    const w=window.open(u.toString(),'APSMyVocabs','popup=yes,width=1500,height=900,resizable=yes,scrollbars=yes');
    if(w){try{w.focus();}catch{}return;}
    showToast('New window was blocked — My Vocabs opened here instead');
  }
  captureReturnContext();stopAllSpeech();state.modal=null;state.overlay='my-vocabs';render();void refreshLegacyAutoRowsOnce();
}
function focusEnglish(id){requestAnimationFrame(()=>document.querySelector(`[data-my-field="english"][data-id="${CSS.escape(id)}"]`)?.focus());}
function addRow(src=null,{focus=true}={}){
  if(focus){state.myVocabWorkspace.query='';state.myVocabWorkspace.status='all';state.myVocabWorkspace.source='all';state.myVocabWorkspace.sort='sheet';}
  let existing=rows().find(r=>!String(r.english||'').trim()&&!r.deleted);
  if(existing){render();if(focus)focusEnglish(existing.id);return existing;}
  const r=newRecord(src);upsert(r);render();if(focus)focusEnglish(r.id);return r;
}
function updateRowDom(r){
  const row=document.querySelector(`[data-my-row="${CSS.escape(r.id)}"]`);if(!row)return;
  const hi=row.querySelector('[data-my-field="hindi"]');if(hi&&document.activeElement!==hi){hi.value=r.hindi||'';hi.placeholder=r.lookupSource==='Translating…'?'Translating…':'Hindi meaning';}
}
async function autoFillRecord(id,{showMessage=false,replaceAuto=true}={}){
  const r=findMy(id);if(!r||!String(r.english||'').trim())return r;
  const before=normaliseSearchText(r.english);
  r.lookupSource=navigator.onLine?'Translating…':'Checking APS offline fallback…';upsert(r);updateRowDom(r);
  await applyLookup(r,{fillMissingOnly:true,replaceAuto});if(before!==normaliseSearchText(findMy(id)?.english||r.english))return r;upsert(r);updateRowDom(r);
  if(showMessage)showToast(r.hindi?`Hindi updated · ${r.lookupSource||'APS'}`:'Translation unavailable right now — you can retry or type Hindi manually');return r;
}
async function updateField(el,{lookup=true}={}){
  const r=findMy(el.dataset.id);if(!r||r.deleted)return;
  const field=el.dataset.myField;r.manualFields=r.manualFields||{};
  if(field==='mySynonyms'){r.mySynonyms=cleanList(el.value);r.manualFields.mySynonyms=true;}
  else if(field==='status')r.status=statusMeta[el.value]?el.value:'needs-review';
  else{r[field]=el.value;if(field!=='english')r.manualFields[field]=true;}
  if(field==='english'){
    const duplicate=rows().find(x=>x.id!==r.id&&normaliseSearchText(x.english)===normaliseSearchText(r.english));if(duplicate)showToast(`“${duplicate.english}” is already in My Vocabs — check the existing row before keeping a duplicate.`);
  }
  upsert(r);if(field==='english'&&lookup&&String(r.english||'').trim())await autoFillRecord(r.id);
}
async function autofill(id){await autoFillRecord(id,{showMessage:true});}
async function fillMissingDetails(){const targets=filteredRows().filter(r=>String(r.english||'').trim()&&!String(r.hindi||'').trim());for(const r of targets)await autoFillRecord(r.id);render();}

function startBulkTranslation(ids=null){
  let targets=(ids?ids.map(findMy).filter(Boolean):missingHindiRows()).filter(r=>String(r.english||'').trim()&&!String(r.hindi||'').trim());
  const seen=new Set();targets=targets.filter(r=>!seen.has(r.id)&&(seen.add(r.id),true));
  if(!targets.length){showToast('All vocabulary rows already have Hindi meanings');return;}
  const job={schemaVersion:1,status:navigator.onLine?'running':'waiting',total:targets.length,done:0,pendingIds:targets.map(r=>r.id),failedIds:[],startedAt:iso(),updatedAt:iso()};saveBulkJob(job);updateBulkDom();void runBulkTranslation();
}
async function runBulkTranslation(){
  if(bulkRunnerActive)return;bulkRunnerActive=true;
  try{
    while(true){
      let job=bulkJob();if(!job||['paused','cancelled','done'].includes(job.status))break;
      if(!navigator.onLine){job.status='waiting';job.updatedAt=iso();saveBulkJob(job);updateBulkDom();break;}
      job.status='running';
      const id=(job.pendingIds||[])[0];if(!id){
        const unresolved=(job.failedIds||[]).filter(fid=>{const rr=findMy(fid);return rr&&String(rr.english||'').trim()&&!String(rr.hindi||'').trim();});
        if(unresolved.length){job.status='done';job.failedIds=unresolved;job.updatedAt=iso();saveBulkJob(job);}else saveBulkJob(null);
        updateBulkDom();break;
      }
      const r=findMy(id);
      if(!r||!String(r.english||'').trim()||String(r.hindi||'').trim()){
        job.pendingIds.shift();job.done=(Number(job.done)||0)+1;job.updatedAt=iso();saveBulkJob(job);updateBulkDom();continue;
      }
      let ok=false;try{await autoFillRecord(id,{showMessage:false,replaceAuto:true});ok=Boolean(String(findMy(id)?.hindi||'').trim());}catch{}
      job=bulkJob()||job;
      if((job.pendingIds||[])[0]===id)job.pendingIds.shift();
      if(ok)job.done=(Number(job.done)||0)+1;else{job.failedIds=Array.from(new Set([...(job.failedIds||[]),id]));}
      job.updatedAt=iso();saveBulkJob(job);updateBulkDom();
      // Gentle pacing is intentional: large CSV imports should be reliable instead of firing hundreds of simultaneous requests.
      await sleep(ok?180:650);
    }
  }finally{bulkRunnerActive=false;}
}
function pauseResumeBulk(){const j=bulkJob();if(!j)return;if(j.status==='paused'){j.status=navigator.onLine?'running':'waiting';j.updatedAt=iso();saveBulkJob(j);updateBulkDom();void runBulkTranslation();}else if(['running','waiting'].includes(j.status)){j.status='paused';j.updatedAt=iso();saveBulkJob(j);updateBulkDom();}}
function cancelBulk(){
  const j=bulkJob();if(!j)return;
  const remaining=missingHindiRows().length;
  saveBulkJob(null);updateBulkDom();
  showToast(remaining?`Bulk translation stopped · ${remaining.toLocaleString()} words still need Hindi`:'All imported words are translated');
}
function retryFailedBulk(){const j=bulkJob();if(!j||(j.failedIds||[]).length)return;const ids=(j.failedIds||[]).filter(id=>{const r=findMy(id);return r&&r.english&&!r.hindi;});if(!ids.length){saveBulkJob(null);updateBulkDom();return;}startBulkTranslation(ids);}

function deleteRow(id){const s=store(),r=s.items[id];if(!r)return;if(!confirm(`Delete “${r.english||'this row'}” from My Vocabs? This only removes your personal row; master APS vocabulary is not affected.`))return;r.deleted=true;r.deletedAt=iso();r.updatedAt=iso();s.items[id]=r;saveStore(s);render();}
function playRows(list,title='My Vocabs'){
  const playable=list.filter(r=>r.english&&r.hindi);if(!playable.length){showToast('Add English and Hindi before playing these words');return;}
  state.v15DialogueVocabContext=null;state.myVocabWorkspace.player=true;
  Object.assign(state.vocabPlayer,{queue:playable.map(r=>r.id),index:0,playing:false,token:(state.vocabPlayer.token||0)+1,gapRemaining:0,title,revealCurrent:false});
  state.overlay='vocab-player';state.modal=null;render();
}
function quickModal(){
  const src=currentDialogueSource();
  return `<div class="modal-backdrop"><div class="modal my-quick-modal my-quick-simple"><button class="modal-close" data-action="close-modal">×</button><small>MY VOCABS · ${esc(sourceLabel(src))}</small><h2>Add a word</h2><p>Add it quickly without leaving this dialogue. Hindi translates online automatically; if offline, APS uses its installed vocabulary when available.</p><div class="my-quick-form"><label>English word<input id="myQuickEnglish" type="text" autocomplete="off" placeholder="e.g. eligible"></label><label>Hindi meaning<input id="myQuickHindi" type="text" placeholder="Translates automatically"></label><label>My synonyms<input id="myQuickSynonyms" type="text" placeholder="Optional — type your own synonyms"></label></div><div id="myQuickLookupNote" class="my-lookup-note">Type an English word.</div><div class="actions my-quick-actions"><button class="secondary" data-action="my-quick-autofill">↻ Retry translation</button><button class="secondary" data-action="my-quick-open-sheet">▣ Open My Vocabs Sheet</button><button class="primary" data-action="my-quick-save">Save</button></div></div></div>`;
}
function helpModal(){return `<div class="modal-backdrop"><div class="modal my-quick-modal"><button class="modal-close" data-action="close-modal">×</button><small>MY VOCABS</small><h2>Simple fast vocabulary sheet</h2><p><b>Online first:</b> type an English word and press Enter. APS queues one online Hindi translation at a time, so rapid entry stays fast and does not flood the translation service.</p><p><b>Keep typing:</b> Enter saves the current English word, immediately moves to a fresh row, and the previous row fills in the background.</p><p><b>CSV bulk translation:</b> import a one-column English CSV and APS automatically translates every missing Hindi meaning through a paced queue. The job can pause/resume and continues after reopening.</p><p><b>Spreadsheet controls:</b> the first three columns (No., English, Hindi Meaning) stay frozen while you scroll horizontally. Drag header dividers to resize columns; Shift + ↑/↓ extends row selection.</p><p><b>Your My Synonyms stay yours:</b> APS never fills or overwrites that column.</p><p><b>Offline:</b> previously installed APS vocabulary is used only when internet translation is unavailable.</p><div class="actions"><button class="primary" data-action="close-modal">Done</button></div></div></div>`;}
let quickLookupToken=0;
async function fillQuick(){
  const en=document.querySelector('#myQuickEnglish')?.value?.trim()||'',token=++quickLookupToken;if(!en)return;const note=document.querySelector('#myQuickLookupNote');if(note)note.textContent=navigator.onLine?'Translating…':'Offline — checking installed APS vocabulary…';
  const p=await lookupProposal(en);if(token!==quickLookupToken)return;const hi=document.querySelector('#myQuickHindi');if(hi&&!hi.dataset.manual&&p.hindi)hi.value=p.hindi||'';
  if(note)note.textContent=p.hindi?`Hindi ready · ${p.lookupSource||'APS'}`:'Translation unavailable. Retry or type the Hindi meaning manually.';
}
function saveQuick({openSheet=false}={}){
  const en=document.querySelector('#myQuickEnglish')?.value?.trim()||'';if(!en){showToast('Enter the English word first');return null;}
  let existing=rows().find(x=>normaliseSearchText(x.english)===normaliseSearchText(en));const src=currentDialogueSource();
  if(existing){addSource(existing,src);const hi=document.querySelector('#myQuickHindi')?.value?.trim()||'';const my=cleanList(document.querySelector('#myQuickSynonyms')?.value||'');if(hi&&!existing.hindi){existing.hindi=hi;}if(my.length)existing.mySynonyms=cleanList([...(existing.mySynonyms||[]),...my]);existing.updatedAt=iso();upsert(existing);state.modal=null;render();if(!existing.hindi)void autoFillRecord(existing.id);showToast('Already in My Vocabs — dialogue linked to the existing word');return existing;}
  const r=newRecord(src);r.english=en;r.hindi=document.querySelector('#myQuickHindi')?.value?.trim()||'';r.mySynonyms=cleanList(document.querySelector('#myQuickSynonyms')?.value||'');r.manualFields={hindi:Boolean(document.querySelector('#myQuickHindi')?.dataset.manual),mySynonyms:Boolean(r.mySynonyms.length)};r.topic=state.dialogue?.topic||'community';upsert(r);state.modal=null;render();if(!r.hindi)void autoFillRecord(r.id);showToast('Added to My Vocabs');return r;
}
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function exportCsv(){
  const nums=rowNumberMap(),headers=['No.','English','Hindi Meaning','My Synonyms','Recall Status'];
  const lines=[headers,...activeSheetOrder().map(r=>[nums.get(r.id),r.english,r.hindi,(r.mySynonyms||[]).join('; '),r.status])].map(row=>row.map(csvEscape).join(','));
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`APS_My_Vocabs_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
}
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(quoted&&n==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x!==''))rows.push(row);return rows;
}
async function importCsv(file){
  const parsed=parseCsv((await file.text()).replace(/^\ufeff/,''));if(!parsed.length){showToast('CSV contains no vocabulary rows');return;}
  const first=parsed[0].map(x=>normaliseSearchText(x));
  const hasHeader=first.some(x=>['english','english word','word','hindi meaning','my synonyms','recall status','no','no.'].includes(x));
  const header=hasHeader?first:[];const dataRows=hasHeader?parsed.slice(1):parsed;
  const idx=(...names)=>{for(const n of names){const i=header.indexOf(normaliseSearchText(n));if(i>=0)return i;}return -1;};
  const englishIndex=hasHeader?Math.max(0,idx('English','English Word','Word')):0;
  const hindiIndex=hasHeader?idx('Hindi Meaning','Hindi'): -1;
  const synIndex=hasHeader?idx('My Synonyms','Synonyms'): -1;
  const statusIndex=hasHeader?idx('Recall Status','Recall'): -1;
  const s=store();let added=0,updated=0;const translateIds=[];
  for(const cells of dataRows){
    const en=String(cells[englishIndex]||'').trim();if(!en)continue;
    let r=Object.values(s.items).find(x=>!x.deleted&&normaliseSearchText(x.english)===normaliseSearchText(en));
    if(!r){r=newRecord({type:'import',label:'CSV import',addedAt:iso()});added++;}else updated++;
    r.english=en;
    if(hindiIndex>=0){const hi=String(cells[hindiIndex]||'').trim();if(hi)r.hindi=hi;}
    if(synIndex>=0){const my=String(cells[synIndex]||'').trim();if(my)r.mySynonyms=cleanList([...(r.mySynonyms||[]),...cleanList(my)]);}
    if(statusIndex>=0){const st=String(cells[statusIndex]||'').trim();if(statusMeta[st])r.status=st;}
    r.updatedAt=iso();s.items[r.id]=r;if(!String(r.hindi||'').trim())translateIds.push(r.id);
  }
  saveStore(s);state.myVocabWorkspace.sort='sheet';render();showToast(`CSV imported: ${added} added, ${updated} already existed · ${translateIds.length} need Hindi translation`);
  if(translateIds.length)startBulkTranslation(translateIds);
}

// Add the My Vocabs entry to the final Learn page without changing its existing tabs.
const baseLearn=learn;
learn=function v191Learn(){
  let html=baseLearn();const c=counts();
  const card=`<section class="my-vocabs-learn-entry"><div><small>PERSONAL VOCABULARY</small><h3>My Vocabs</h3><p>Keep your own English ↔ Hindi study sheet, filter words for recall and play them in the current APS word player.</p><span>${c.all} saved · 🔴 ${c.review} · 🟡 ${c.learning} · 🟢 ${c.mastered}</span></div><div><button class="primary" data-action="open-my-vocabs">Open My Vocabs →</button><button class="secondary" data-action="open-my-vocabs-window">▣ Open in separate window</button></div></section>`;
  const m=html.match(/<div class="segments reliability-learn-tabs">[\s\S]*?<\/div>/);if(m)html=html.replace(m[0],m[0]+card);else html=html.replace('<section class="status-cards">',card+'<section class="status-cards">');
  return html;
};

// Small quick-add control inside Learning/Practice dialogue players. Mock Test is deliberately excluded.
const baseDialogueOverlay=dialoguePlayerOverlay;
dialoguePlayerOverlay=function v191DialoguePlayerOverlay(){
  let html=baseDialogueOverlay();if(state.dialogueMode==='mock')return html;
  return html.replace('<button class="top-search-button"','<button class="my-vocab-quick-button" data-action="my-quick-open" type="button">+ Add My Vocab</button><button class="top-search-button"');
};

const baseRenderModal=renderModal;
renderModal=function v191RenderModal(){if(state.modal?.type==='my-vocab-quick-add')return quickModal();if(state.modal?.type==='my-vocab-help')return helpModal();return baseRenderModal();};
const baseRender=render;
render=function v194Render(){if(state.overlay==='my-vocabs'){app.innerHTML=workspace();requestAnimationFrame(()=>{updateBulkDom();updateSelectedDom();});return;}return baseRender();};


function autoFitColumn(col){
  const map={english:1,hindi:2,synonyms:3,recall:4,actions:5},idx=map[col];if(idx==null)return;
  const table=document.querySelector('.my-sheet-v194');if(!table)return;
  let max=col==='actions'?190:col==='recall'?145:160;
  const rows=[...table.querySelectorAll('tr')].slice(0,220);
  rows.forEach(tr=>{const cell=tr.children[idx];if(!cell)return;const text=(cell.querySelector('input,select')?.value||cell.textContent||'').trim();max=Math.max(max,Math.min(col==='synonyms'?520:col==='actions'?260:440,30+text.length*(col==='hindi'?9:8)));});
  const v=viewSettings();v.widths[col]=Math.round(max);saveViewSettings(v);render();
}
function autoFitAllColumns(){['english','hindi','synonyms','recall','actions'].forEach(col=>{const map={english:1,hindi:2,synonyms:3,recall:4,actions:5},idx=map[col],table=document.querySelector('.my-sheet-v194');if(!table)return;let max=col==='actions'?190:col==='recall'?145:160;[...table.querySelectorAll('tr')].slice(0,220).forEach(tr=>{const cell=tr.children[idx];if(!cell)return;const text=(cell.querySelector('input,select')?.value||cell.textContent||'').trim();max=Math.max(max,Math.min(col==='synonyms'?520:col==='actions'?260:440,30+text.length*(col==='hindi'?9:8)));});const v=viewSettings();v.widths[col]=Math.round(max);saveViewSettings(v);});render();}
function startColumnResize(event,handle){
  const col=handle.dataset.resizeCol;if(!col)return;event.preventDefault();event.stopPropagation();const startX=event.clientX,v=viewSettings(),start=Number(v.widths[col])||200;
  const min={english:150,hindi:170,synonyms:170,recall:125,actions:170}[col]||120,max={english:520,hindi:560,synonyms:620,recall:240,actions:320}[col]||700;
  document.body.classList.add('my-resizing-column');
  const move=e=>{const n=Math.max(min,Math.min(max,start+(e.clientX-startX)));document.querySelector('.my-sheet-v194')?.style.setProperty(`--my-col-${col}`,`${Math.round(n)}px`);};
  const up=e=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.body.classList.remove('my-resizing-column');const n=Math.max(min,Math.min(max,start+(e.clientX-startX)));const next=viewSettings();next.widths[col]=Math.round(n);saveViewSettings(next);};
  document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});
}

// Capture navigation before the older app handler changes the overlay.
document.addEventListener('click',event=>{
  const el=event.target.closest?.('[data-action]');if(!el)return;const a=el.dataset.action;
  if(a==='close-vocab-player'&&state.myVocabWorkspace.player){event.preventDefault();event.stopImmediatePropagation();stopAllSpeech();state.myVocabWorkspace.player=false;state.overlay='my-vocabs';state.tab='learn';render();}
},true);

app.addEventListener('click',async event=>{
  const rowSel=event.target.closest?.('[data-row-selector]');if(rowSel){event.preventDefault();selectRow(rowSel.dataset.rowSelector,{toggle:event.ctrlKey||event.metaKey,range:event.shiftKey});return;}
  const el=event.target.closest('[data-action]');if(!el)return;const a=el.dataset.action,id=el.dataset.id;
  if(a==='open-my-vocabs'){event.preventDefault();openWorkspace(false);}
  else if(a==='open-my-vocabs-window'){event.preventDefault();openWorkspace(true);}
  else if(a==='close-my-vocabs'){event.preventDefault();stopAllSpeech();const standalone=new URL(location.href).searchParams.get('myvocabs')==='1';if(standalone){try{window.opener?.focus();}catch{}window.close();return;}restoreReturnContext();}
  else if(a==='my-add-row'){event.preventDefault();addRow({type:'manual',label:'Manual',addedAt:iso()});}
  else if(a==='my-translate-all'){event.preventDefault();startBulkTranslation();}
  else if(a==='my-bulk-pause'){event.preventDefault();pauseResumeBulk();}
  else if(a==='my-bulk-cancel'){event.preventDefault();cancelBulk();}
  else if(a==='my-bulk-retry'){event.preventDefault();retryFailedBulk();}
  else if(a==='my-play-selected'){event.preventDefault();playRows(selectedRows(),'My Vocabs · Selected rows');}
  else if(a==='my-clear-selection'){event.preventDefault();clearSelection();}
  else if(a==='my-auto-fit-all'){event.preventDefault();autoFitAllColumns();}
  else if(a==='my-reset-widths'){event.preventDefault();saveViewSettings(defaultView());render();}
  else if(a==='my-autofill'){event.preventDefault();await autofill(id);}
  else if(a==='my-fill-missing'){event.preventDefault();await fillMissingDetails();}
  else if(a==='my-help'){event.preventDefault();state.modal={type:'my-vocab-help'};render();}
  else if(a==='my-delete'){event.preventDefault();deleteRow(id);}
  else if(a==='my-play-one'){event.preventDefault();const r=findMy(id);if(r)playRows([r],`My Vocab · ${r.english}`);}
  else if(a==='my-play-filtered'){event.preventDefault();playRows(filteredRows(),'My Vocabs · Current filters');}
  else if(a==='my-filter-status'){event.preventDefault();state.myVocabWorkspace.status=id||'all';render();}
  else if(a==='my-export-csv'){event.preventDefault();exportCsv();}
  else if(a==='my-import-trigger'){event.preventDefault();document.querySelector('#myImportCsv')?.click();}
  else if(a==='my-quick-open'){event.preventDefault();state.modal={type:'my-vocab-quick-add'};render();requestAnimationFrame(()=>document.querySelector('#myQuickEnglish')?.focus());}
  else if(a==='my-quick-autofill'){event.preventDefault();await fillQuick();}
  else if(a==='my-quick-save'){event.preventDefault();saveQuick();}
  else if(a==='my-quick-open-sheet'){event.preventDefault();saveQuick();openWorkspace(true);}
});

app.addEventListener('change',async event=>{
  const t=event.target;
  if(t.dataset?.myField){await updateField(t);if(t.dataset.myField==='status')render();}
  else if(t.id==='myVocabStatusFilter'){state.myVocabWorkspace.status=t.value;render();}
  else if(t.id==='myVocabSort'){state.myVocabWorkspace.sort=t.value;render();}
  else if(t.id==='myVocabDensity'){const v=viewSettings();v.density=t.value==='compact'?'compact':'comfortable';saveViewSettings(v);render();}
  else if(t.id==='myImportCsv'&&t.files?.[0]){await importCsv(t.files[0]);t.value='';}
  else if(t.id==='myQuickEnglish'){await fillQuick();}
  else if(t.id==='myQuickHindi'){t.dataset.manual='1';}
});
let searchTimer=null;
app.addEventListener('input',event=>{
  const t=event.target;
  if(t.id==='myVocabSearch'){state.myVocabWorkspace.query=t.value;clearTimeout(searchTimer);const pos=t.selectionStart;searchTimer=setTimeout(()=>{render();requestAnimationFrame(()=>{const n=document.querySelector('#myVocabSearch');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch{}}});},180);}
  else if(t.id==='myQuickEnglish'){clearTimeout(searchTimer);searchTimer=setTimeout(()=>fillQuick(),450);}
  else if(t.id==='myQuickHindi'){t.dataset.manual='1';}
});

app.addEventListener('pointerdown',event=>{const h=event.target.closest?.('[data-resize-col]');if(h)startColumnResize(event,h);});
app.addEventListener('dblclick',event=>{const h=event.target.closest?.('[data-resize-col]');if(h){event.preventDefault();autoFitColumn(h.dataset.resizeCol);}});
app.addEventListener('focusin',event=>{const tr=event.target.closest?.('[data-my-row]');if(tr&&!selectedIds.size)selectionAnchorId=tr.dataset.myRow;});

app.addEventListener('keydown',async event=>{
  const t=event.target;
  if(t?.id==='myQuickEnglish'&&event.key==='Enter'){event.preventDefault();await fillQuick();document.querySelector('#myQuickSynonyms')?.focus();return;}
  const tr=t?.closest?.('[data-my-row]');
  if(tr&&event.shiftKey&&(event.key==='ArrowDown'||event.key==='ArrowUp')){
    event.preventDefault();
    const trs=[...document.querySelectorAll('[data-my-row]')],i=trs.indexOf(tr),nextIndex=Math.max(0,Math.min(trs.length-1,i+(event.key==='ArrowDown'?1:-1))),next=trs[nextIndex];
    if(!selectionAnchorId)selectionAnchorId=tr.dataset.myRow;
    selectRange(selectionAnchorId,next.dataset.myRow);
    const field=t?.dataset?.myField;const focus=field?next.querySelector(`[data-my-field="${CSS.escape(field)}"]`):next.querySelector('[data-my-field="english"]');focus?.focus();return;
  }
  if(!t?.matches?.('[data-my-field="english"]'))return;
  if(event.key==='Enter'&&!event.shiftKey){
    event.preventDefault();const value=String(t.value||'').trim();if(!value)return;
    const id=t.dataset.id;await updateField(t,{lookup:false});
    const next=addRow({type:'manual',label:'Manual',addedAt:iso()});
    void autoFillRecord(id);if(next)focusEnglish(next.id);
  }else if(event.key==='Enter'&&event.shiftKey){
    event.preventDefault();const all=[...document.querySelectorAll('[data-my-field="english"]')],i=all.indexOf(t);if(i>0)all[i-1].focus();
  }
});

const V192_REPAIR_KEY='apsMyVocabsV193AutoRepair:hi';
async function refreshLegacyAutoRowsOnce(){
  if(!navigator.onLine||localStorage.getItem(V192_REPAIR_KEY)==='1')return;
  localStorage.setItem(V192_REPAIR_KEY,'1');
  const targets=rows().filter(r=>String(r.english||'').trim()&&!r.manualFields?.hindi&&!String(r.hindi||'').trim()).slice(0,100);
  for(const r of targets){try{await autoFillRecord(r.id,{replaceAuto:true});}catch{}}
}

window.addEventListener('online',()=>{const j=bulkJob();if(j&&j.status==='waiting'){j.status='running';j.updatedAt=iso();saveBulkJob(j);void runBulkTranslation();}if(state.overlay==='my-vocabs')render();});
window.addEventListener('offline',()=>{if(state.overlay==='my-vocabs')render();});

// Pop-out mode never shows the Home screen: it displays a focused loading shell until APS data/auth are ready.
const pendingBulkAtLoad=bulkJob();if(pendingBulkAtLoad&&['running','waiting'].includes(pendingBulkAtLoad.status)&&navigator.onLine){pendingBulkAtLoad.status='running';saveBulkJob(pendingBulkAtLoad);setTimeout(()=>void runBulkTranslation(),800);}

if(new URL(location.href).searchParams.get('myvocabs')==='1'){
  document.documentElement.classList.add('my-vocabs-boot');
  const timer=setInterval(()=>{if(state.ready&&state.auth?.initialized&&state.selectedLanguage){clearInterval(timer);state.overlay='my-vocabs';document.documentElement.classList.add('my-vocabs-ready');render();void refreshLegacyAutoRowsOnce();}},60);
  setTimeout(()=>{clearInterval(timer);document.documentElement.classList.add('my-vocabs-ready');if(state.ready){state.overlay='my-vocabs';render();}},15000);
}
console.info(`${VERSION} loaded · bulk status auto-hides on successful completion · automatic CSV bulk Hindi translation · frozen/resizable columns · Shift+Arrow selection.`);
})();
