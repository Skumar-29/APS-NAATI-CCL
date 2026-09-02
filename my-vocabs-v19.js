(function(){
'use strict';
const VERSION='My Vocabs V19';
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

state.myVocabWorkspace=state.myVocabWorkspace||{query:'',status:'all',source:'all',sort:'recent',player:false};

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
function lookupProposal(term){
  const hit=verifiedLookup(term),syn=suggestedSynonyms(term);
  return {
    hindi:hit?.hindi||'',suggestedSynonyms:syn,
    exampleEnglish:hit?.exampleEnglish||'',exampleHindi:hit?.exampleHindi||'',
    topic:hit?.topic||'community',lookupSource:hit?.lookupSource||''
  };
}
function newRecord(src=null){
  const now=iso();const r={id:makeId(),english:'',hindi:'',suggestedSynonyms:[],mySynonyms:[],exampleEnglish:'',exampleHindi:'',status:'needs-review',topic:'community',sources:[],practiceCount:0,lastPractisedAt:'',createdAt:now,updatedAt:now,deleted:false};
  if(src)addSource(r,src);return r;
}
function upsert(record){const s=store();record.updatedAt=iso();s.items[record.id]=record;saveStore(s);return record;}
function applyLookup(record,force=false){
  const p=lookupProposal(record.english);
  if(force||!String(record.hindi||'').trim())record.hindi=p.hindi||record.hindi||'';
  record.suggestedSynonyms=p.suggestedSynonyms||[];
  if(force||!String(record.exampleEnglish||'').trim())record.exampleEnglish=p.exampleEnglish||record.exampleEnglish||'';
  if(force||!String(record.exampleHindi||'').trim())record.exampleHindi=p.exampleHindi||record.exampleHindi||'';
  if(record.topic==='community'&&p.topic)record.topic=p.topic;
  record.lookupSource=p.lookupSource||record.lookupSource||'';
  return record;
}
function personalPlayerItem(r){return {id:r.id,english:r.english||'',hindi:r.hindi||'',exampleEnglish:r.exampleEnglish||'',exampleHindi:r.exampleHindi||'',topic:r.topic||'community',itemType:'my-vocab',mySynonyms:r.mySynonyms||[],suggestedSynonyms:r.suggestedSynonyms||[]};}

// Make personal rows available to the existing vocabulary player without changing master libraries.
const baseAllVocabItems=allVocabItems;
allVocabItems=function v19AllVocabItems(){return [...baseAllVocabItems(),...rows().filter(r=>r.english&&r.hindi).map(personalPlayerItem)];};
const baseItemStatus=itemStatus;
itemStatus=function v19ItemStatus(id){
  const r=findMy(id);if(!r||r.deleted)return baseItemStatus(id);
  return r.status==='mastered'?'known':r.status==='learning'?'learning':'again';
};
const baseSetItemStatus=setItemStatus;
setItemStatus=function v19SetItemStatus(id,status){
  const r=findMy(id);if(!r||r.deleted)return baseSetItemStatus(id,status);
  r.status=status==='known'?'mastered':status==='learning'?'learning':'needs-review';upsert(r);render();
};
const baseSpeakVocabItem=speakVocabItem;
speakVocabItem=async function v19SpeakVocabItem(options={}){
  const id=state.vocabPlayer?.queue?.[state.vocabPlayer.index],r=findMy(id);
  if(r&&!r.deleted){r.practiceCount=(Number(r.practiceCount)||0)+1;r.lastPractisedAt=iso();upsert(r);}
  return baseSpeakVocabItem(options);
};

function filteredRows(){
  const w=state.myVocabWorkspace||{},q=String(w.query||'').trim();let list=rows();
  if(w.status&&w.status!=='all')list=list.filter(r=>r.status===w.status);
  if(w.source==='dialogue')list=list.filter(r=>(r.sources||[]).some(s=>s.type==='dialogue'));
  if(w.source==='manual')list=list.filter(r=>!(r.sources||[]).some(s=>s.type==='dialogue'));
  if(q)list=list.filter(r=>searchMatches(`${r.english} ${r.hindi} ${(r.suggestedSynonyms||[]).join(' ')} ${(r.mySynonyms||[]).join(' ')} ${r.exampleEnglish||''} ${r.exampleHindi||''} ${sourcesText(r)}`,q));
  const sort=w.sort||'recent';
  list.sort((a,b)=>sort==='az'?String(a.english||'').localeCompare(String(b.english||'')):sort==='status'?(statusMeta[a.status]?.rank??0)-(statusMeta[b.status]?.rank??0)||String(a.english||'').localeCompare(String(b.english||'')):Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0));
  return list;
}
function counts(){const a=rows();return {all:a.length,review:a.filter(x=>x.status==='needs-review').length,learning:a.filter(x=>x.status==='learning').length,mastered:a.filter(x=>x.status==='mastered').length};}
function statusOptionsFor(value){return Object.entries(statusMeta).map(([id,m])=>`<option value="${id}" ${value===id?'selected':''}>${m.icon} ${m.label}</option>`).join('');}
function rowHtml(r){
  const meta=statusMeta[r.status]||statusMeta['needs-review'];
  return `<tr data-my-row="${esc(r.id)}" data-search="${esc(normaliseSearchText(`${r.english} ${r.hindi} ${sourcesText(r)}`))}">
    <td class="my-sticky"><input class="my-cell my-english" data-my-field="english" data-id="${esc(r.id)}" value="${esc(r.english||'')}" placeholder="English word"></td>
    <td><input class="my-cell" data-my-field="hindi" data-id="${esc(r.id)}" value="${esc(r.hindi||'')}" placeholder="Hindi meaning"></td>
    <td><textarea class="my-cell my-readonly" readonly title="Suggested automatically from APS verified data">${esc((r.suggestedSynonyms||[]).join(', '))}</textarea></td>
    <td><textarea class="my-cell" data-my-field="mySynonyms" data-id="${esc(r.id)}" placeholder="Type your synonyms">${esc((r.mySynonyms||[]).join(', '))}</textarea></td>
    <td><textarea class="my-cell my-example" data-my-field="exampleEnglish" data-id="${esc(r.id)}" placeholder="Clear English example">${esc(r.exampleEnglish||'')}</textarea></td>
    <td><textarea class="my-cell my-example" data-my-field="exampleHindi" data-id="${esc(r.id)}" placeholder="सरल हिन्दी उदाहरण">${esc(r.exampleHindi||'')}</textarea></td>
    <td><select class="my-cell my-status ${esc(r.status)}" data-my-field="status" data-id="${esc(r.id)}" aria-label="Recall status">${statusOptionsFor(r.status)}</select></td>
    <td class="my-source"><span title="${esc(sourcesText(r))}">${esc(sourcesText(r))}</span>${r.lookupSource?`<small>Auto-filled from ${esc(r.lookupSource)}</small>`:''}</td>
    <td class="my-row-actions"><button data-action="my-autofill" data-id="${esc(r.id)}" title="Fill verified meaning and example">↻ Auto-fill</button><button data-action="my-play-one" data-id="${esc(r.id)}" title="Open in word player">▶</button><button class="danger-text" data-action="my-delete" data-id="${esc(r.id)}" title="Delete this personal row">Delete</button></td>
  </tr>`;
}
function workspace(){
  const list=filteredRows(),c=counts(),newWindow=new URL(location.href).searchParams.get('myvocabs')==='1';
  return `<div class="fullscreen my-vocabs-screen"><header class="top"><button data-action="close-my-vocabs">← ${newWindow?'Close window':'Back to Learn'}</button><div><strong>My Vocabs</strong><span>Personal vocabulary workspace · autosaved</span></div><div class="top-actions">${newWindow?'':`<button data-action="open-my-vocabs-window">▣ Open in new window</button>`}<button class="player-settings-button" data-action="app-settings">⚙ <b>Settings</b></button></div></header>
  <main class="my-vocabs-main"><section class="my-vocab-intro"><div><small>PERSONAL STUDY SHEET</small><h1>Record words while you practise</h1><p>Type an English term and APS will first look in the installed verified vocabulary for its Hindi meaning, suggested synonyms and teaching example. Your own synonyms always stay separate and editable.</p></div><div class="my-sync-note"><b>Autosaved</b><span>Included in APS progress backup and cloud progress for signed-in accounts.</span></div></section>
  <section class="my-vocab-stats"><button data-action="my-filter-status" data-id="all" class="${state.myVocabWorkspace.status==='all'?'active':''}"><strong>${c.all}</strong><span>All</span></button><button data-action="my-filter-status" data-id="needs-review" class="review ${state.myVocabWorkspace.status==='needs-review'?'active':''}"><strong>${c.review}</strong><span>🔴 Needs Review</span></button><button data-action="my-filter-status" data-id="learning" class="learning ${state.myVocabWorkspace.status==='learning'?'active':''}"><strong>${c.learning}</strong><span>🟡 Learning</span></button><button data-action="my-filter-status" data-id="mastered" class="mastered ${state.myVocabWorkspace.status==='mastered'?'active':''}"><strong>${c.mastered}</strong><span>🟢 Mastered</span></button></section>
  <section class="my-vocab-toolbar"><label class="search"><span>⌕</span><input id="myVocabSearch" type="search" placeholder="Search English, Hindi, synonym, example or dialogue" value="${esc(state.myVocabWorkspace.query||'')}"></label><select id="myVocabStatusFilter"><option value="all">All recall statuses</option>${Object.entries(statusMeta).map(([id,m])=>`<option value="${id}" ${state.myVocabWorkspace.status===id?'selected':''}>${m.icon} ${m.label}</option>`).join('')}</select><select id="myVocabSourceFilter"><option value="all" ${state.myVocabWorkspace.source==='all'?'selected':''}>All sources</option><option value="dialogue" ${state.myVocabWorkspace.source==='dialogue'?'selected':''}>Added from dialogues</option><option value="manual" ${state.myVocabWorkspace.source==='manual'?'selected':''}>Added manually / import</option></select><select id="myVocabSort"><option value="recent" ${state.myVocabWorkspace.sort==='recent'?'selected':''}>Recently changed</option><option value="az" ${state.myVocabWorkspace.sort==='az'?'selected':''}>English A–Z</option><option value="status" ${state.myVocabWorkspace.sort==='status'?'selected':''}>Recall status</option></select></section>
  <section class="my-vocab-actions"><button class="primary" data-action="my-add-row">+ Add Row</button><button class="secondary" data-action="my-play-filtered" ${list.filter(r=>r.english&&r.hindi).length?'':'disabled'}>▶ Play Filtered Words (${list.filter(r=>r.english&&r.hindi).length})</button><button class="secondary" data-action="my-export-csv">Export CSV</button><button class="secondary" data-action="my-import-trigger">Import CSV</button><input id="myImportCsv" type="file" accept=".csv,text/csv" hidden><span>${list.length.toLocaleString()} matching rows</span></section>
  <div class="my-sheet-wrap"><table class="my-sheet"><thead><tr><th>English</th><th>Hindi Meaning</th><th>Suggested Synonyms</th><th>My Synonyms</th><th>English Example</th><th>Hindi Example</th><th>Recall</th><th>Source</th><th>Actions</th></tr></thead><tbody>${list.map(rowHtml).join('')||`<tr><td colspan="9"><div class="my-empty"><h3>${rows().length?'No rows match these filters':'Your personal vocabulary sheet is empty'}</h3><p>${rows().length?'Change the search or recall filter.':'Click “Add Row” or use “+ My Vocab” while practising a dialogue.'}</p><button class="primary" data-action="my-add-row">+ Add your first word</button></div></td></tr>`}</tbody></table></div>
  <section class="my-vocab-help"><b>How auto-fill works</b><span>APS searches Core Vocabulary first, then reviewed General Vocabs and verified Dialogue Vocabulary. If it cannot find a trustworthy exact match, the Hindi field stays blank for you to enter manually rather than guessing.</span></section></main>${renderModal()}</div>`;
}

function openWorkspace(separate=true){
  if(separate){
    const u=new URL(location.href);u.searchParams.set('myvocabs','1');
    const w=window.open(u.toString(),'APSMyVocabs','popup=yes,width=1500,height=900,resizable=yes,scrollbars=yes');
    if(w)return;
    showToast('New window was blocked — My Vocabs opened here instead');
  }
  stopAllSpeech();state.modal=null;state.overlay='my-vocabs';state.tab='learn';render();
}
function addRow(src=null){const r=newRecord(src);upsert(r);render();requestAnimationFrame(()=>document.querySelector(`[data-my-field="english"][data-id="${CSS.escape(r.id)}"]`)?.focus());}
function updateField(el){
  const r=findMy(el.dataset.id);if(!r||r.deleted)return;
  const field=el.dataset.myField;if(field==='mySynonyms')r.mySynonyms=cleanList(el.value);else if(field==='status')r.status=statusMeta[el.value]?el.value:'needs-review';else r[field]=el.value;
  if(field==='english'){
    const duplicate=rows().find(x=>x.id!==r.id&&normaliseSearchText(x.english)===normaliseSearchText(r.english));
    if(duplicate)showToast(`“${duplicate.english}” is already in My Vocabs — check the existing row before keeping a duplicate.`);
    applyLookup(r,false);
  }
  upsert(r);
}
function autofill(id){const r=findMy(id);if(!r)return;applyLookup(r,true);upsert(r);render();if(!r.hindi)showToast('No verified exact match found. Enter the Hindi meaning manually.');else showToast('Verified fields refreshed');}
function deleteRow(id){const s=store(),r=s.items[id];if(!r)return;if(!confirm(`Delete “${r.english||'this row'}” from My Vocabs? This only removes your personal row; master APS vocabulary is not affected.`))return;r.deleted=true;r.deletedAt=iso();r.updatedAt=iso();s.items[id]=r;saveStore(s);render();}
function playRows(list,title='My Vocabs'){
  const playable=list.filter(r=>r.english&&r.hindi);if(!playable.length){showToast('Add English and Hindi before playing these words');return;}
  state.v15DialogueVocabContext=null;state.myVocabWorkspace.player=true;
  Object.assign(state.vocabPlayer,{queue:playable.map(r=>r.id),index:0,playing:false,token:(state.vocabPlayer.token||0)+1,gapRemaining:0,title,revealCurrent:false});
  state.overlay='vocab-player';state.modal=null;render();
}
function quickModal(){
  const src=currentDialogueSource();
  return `<div class="modal-backdrop"><div class="modal my-quick-modal"><button class="modal-close" data-action="close-modal">×</button><small>MY VOCABS · ${esc(sourceLabel(src))}</small><h2>Add a word without leaving this dialogue</h2><p>Type the English term. APS will fill a verified Hindi meaning and example when an exact reviewed match is available.</p><label>English word<input id="myQuickEnglish" type="text" autocomplete="off" placeholder="e.g. eligible"></label><div class="my-quick-grid"><label>Hindi meaning<input id="myQuickHindi" type="text" placeholder="Auto-fill or type manually"></label><label>Suggested synonyms<input id="myQuickSuggested" type="text" readonly placeholder="Verified suggestions"></label></div><label>My synonyms<input id="myQuickSynonyms" type="text" placeholder="Your own synonyms, comma separated"></label><label>English example<textarea id="myQuickExampleEnglish" placeholder="Clear example that explains the meaning"></textarea></label><label>Hindi example<textarea id="myQuickExampleHindi" placeholder="सरल और स्पष्ट हिन्दी उदाहरण"></textarea></label><div id="myQuickLookupNote" class="my-lookup-note">Start typing an English word.</div><div class="actions"><button class="secondary" data-action="my-quick-autofill">↻ Auto-fill</button><button class="primary" data-action="my-quick-save">Save to My Vocabs</button></div></div></div>`;
}
function fillQuick(){
  const en=document.querySelector('#myQuickEnglish')?.value?.trim()||'',p=lookupProposal(en);
  const hi=document.querySelector('#myQuickHindi'),sg=document.querySelector('#myQuickSuggested'),ee=document.querySelector('#myQuickExampleEnglish'),eh=document.querySelector('#myQuickExampleHindi'),note=document.querySelector('#myQuickLookupNote');
  if(hi&&!hi.value.trim())hi.value=p.hindi||'';if(sg)sg.value=(p.suggestedSynonyms||[]).join(', ');if(ee&&!ee.value.trim())ee.value=p.exampleEnglish||'';if(eh&&!eh.value.trim())eh.value=p.exampleHindi||'';
  if(note)note.textContent=p.hindi?`Found in ${p.lookupSource||'APS verified vocabulary'}. You can edit any field before saving.`:'No verified exact match found. Please enter the Hindi meaning manually.';
}
function saveQuick(){
  const en=document.querySelector('#myQuickEnglish')?.value?.trim()||'';if(!en){showToast('Enter the English word first');return;}
  let existing=rows().find(x=>normaliseSearchText(x.english)===normaliseSearchText(en));
  const src=currentDialogueSource();
  if(existing){addSource(existing,src);existing.updatedAt=iso();upsert(existing);state.modal=null;render();showToast('Already in My Vocabs — this dialogue was added as another source');return;}
  const r=newRecord(src);r.english=en;r.hindi=document.querySelector('#myQuickHindi')?.value?.trim()||'';r.suggestedSynonyms=cleanList(document.querySelector('#myQuickSuggested')?.value||'');r.mySynonyms=cleanList(document.querySelector('#myQuickSynonyms')?.value||'');r.exampleEnglish=document.querySelector('#myQuickExampleEnglish')?.value?.trim()||'';r.exampleHindi=document.querySelector('#myQuickExampleHindi')?.value?.trim()||'';const p=lookupProposal(en);r.lookupSource=p.lookupSource||'';r.topic=p.topic||state.dialogue?.topic||'community';upsert(r);state.modal=null;render();showToast('Added to My Vocabs');
}

function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function exportCsv(){
  const headers=['English','Hindi Meaning','Suggested Synonyms','My Synonyms','English Example','Hindi Example','Recall Status','Source'];
  const lines=[headers,...rows().map(r=>[r.english,r.hindi,(r.suggestedSynonyms||[]).join('; '),(r.mySynonyms||[]).join('; '),r.exampleEnglish,r.exampleHindi,r.status,sourcesText(r)])].map(row=>row.map(csvEscape).join(','));
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`APS_My_Vocabs_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
}
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(quoted&&n==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x!==''))rows.push(row);return rows;
}
async function importCsv(file){
  const parsed=parseCsv((await file.text()).replace(/^\ufeff/,''));if(parsed.length<2){showToast('CSV contains no vocabulary rows');return;}
  const head=parsed[0].map(x=>normaliseSearchText(x)),idx=name=>head.indexOf(normaliseSearchText(name));const s=store();let added=0,updated=0;
  for(const cells of parsed.slice(1)){const en=String(cells[idx('English')]||'').trim();if(!en)continue;let r=Object.values(s.items).find(x=>!x.deleted&&normaliseSearchText(x.english)===normaliseSearchText(en));if(!r){r=newRecord({type:'import',label:'CSV import',addedAt:iso()});added++;}else updated++;
    r.english=en;r.hindi=String(cells[idx('Hindi Meaning')]||r.hindi||'').trim();r.suggestedSynonyms=cleanList(cells[idx('Suggested Synonyms')]||r.suggestedSynonyms||[]);r.mySynonyms=cleanList([...(r.mySynonyms||[]),...cleanList(cells[idx('My Synonyms')]||'')]);r.exampleEnglish=String(cells[idx('English Example')]||r.exampleEnglish||'').trim();r.exampleHindi=String(cells[idx('Hindi Example')]||r.exampleHindi||'').trim();const st=String(cells[idx('Recall Status')]||'').trim();if(statusMeta[st])r.status=st;r.updatedAt=iso();s.items[r.id]=r;
  }
  saveStore(s);render();showToast(`CSV imported: ${added} added, ${updated} updated`);
}

// Add the My Vocabs entry to the final Learn page without changing its existing tabs.
const baseLearn=learn;
learn=function v19Learn(){
  let html=baseLearn();const c=counts();
  const card=`<section class="my-vocabs-learn-entry"><div><small>PERSONAL VOCABULARY</small><h3>My Vocabs</h3><p>Keep your own English ↔ Hindi study sheet, filter words for recall and play them in the current APS word player.</p><span>${c.all} saved · 🔴 ${c.review} · 🟡 ${c.learning} · 🟢 ${c.mastered}</span></div><div><button class="primary" data-action="open-my-vocabs">Open My Vocabs →</button><button class="secondary" data-action="open-my-vocabs-window">▣ Open in separate window</button></div></section>`;
  const m=html.match(/<div class="segments reliability-learn-tabs">[\s\S]*?<\/div>/);if(m)html=html.replace(m[0],m[0]+card);else html=html.replace('<section class="status-cards">',card+'<section class="status-cards">');
  return html;
};

// Small quick-add control inside Learning/Practice dialogue players. Mock Test is deliberately excluded.
const baseDialogueOverlay=dialoguePlayerOverlay;
dialoguePlayerOverlay=function v19DialoguePlayerOverlay(){
  let html=baseDialogueOverlay();if(state.dialogueMode==='mock')return html;
  return html.replace('<button class="top-search-button"','<button class="my-vocab-quick-button" data-action="my-quick-open" type="button">+ My Vocab</button><button class="top-search-button"');
};

const baseRenderModal=renderModal;
renderModal=function v19RenderModal(){if(state.modal?.type==='my-vocab-quick-add')return quickModal();return baseRenderModal();};
const baseRender=render;
render=function v19Render(){if(state.overlay==='my-vocabs'){app.innerHTML=workspace();return;}return baseRender();};

// Capture navigation before the older app handler changes the overlay.
document.addEventListener('click',event=>{
  const el=event.target.closest?.('[data-action]');if(!el)return;const a=el.dataset.action;
  if(a==='close-vocab-player'&&state.myVocabWorkspace.player){event.preventDefault();event.stopImmediatePropagation();stopAllSpeech();state.myVocabWorkspace.player=false;state.overlay='my-vocabs';state.tab='learn';render();}
},true);

app.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el)return;const a=el.dataset.action,id=el.dataset.id;
  if(a==='open-my-vocabs'){event.preventDefault();openWorkspace(false);}
  else if(a==='open-my-vocabs-window'){event.preventDefault();openWorkspace(true);}
  else if(a==='close-my-vocabs'){event.preventDefault();stopAllSpeech();state.myVocabWorkspace.player=false;const standalone=new URL(location.href).searchParams.get('myvocabs')==='1';if(standalone&&window.opener){window.close();return;}state.overlay=null;state.tab='learn';render();}
  else if(a==='my-add-row'){event.preventDefault();addRow({type:'manual',label:'Manual',addedAt:iso()});}
  else if(a==='my-autofill'){event.preventDefault();autofill(id);}
  else if(a==='my-delete'){event.preventDefault();deleteRow(id);}
  else if(a==='my-play-one'){event.preventDefault();const r=findMy(id);if(r)playRows([r],`My Vocab · ${r.english}`);}
  else if(a==='my-play-filtered'){event.preventDefault();playRows(filteredRows(),'My Vocabs · Current filters');}
  else if(a==='my-filter-status'){event.preventDefault();state.myVocabWorkspace.status=id||'all';render();}
  else if(a==='my-export-csv'){event.preventDefault();exportCsv();}
  else if(a==='my-import-trigger'){event.preventDefault();document.querySelector('#myImportCsv')?.click();}
  else if(a==='my-quick-open'){event.preventDefault();state.modal={type:'my-vocab-quick-add'};render();requestAnimationFrame(()=>document.querySelector('#myQuickEnglish')?.focus());}
  else if(a==='my-quick-autofill'){event.preventDefault();fillQuick();}
  else if(a==='my-quick-save'){event.preventDefault();saveQuick();}
});

app.addEventListener('change',async event=>{
  const t=event.target;
  if(t.dataset?.myField){updateField(t);if(t.dataset.myField==='english'||t.dataset.myField==='status')render();}
  else if(t.id==='myVocabStatusFilter'){state.myVocabWorkspace.status=t.value;render();}
  else if(t.id==='myVocabSourceFilter'){state.myVocabWorkspace.source=t.value;render();}
  else if(t.id==='myVocabSort'){state.myVocabWorkspace.sort=t.value;render();}
  else if(t.id==='myImportCsv'&&t.files?.[0]){await importCsv(t.files[0]);t.value='';}
  else if(t.id==='myQuickEnglish'){fillQuick();}
});
let searchTimer=null;
app.addEventListener('input',event=>{
  const t=event.target;
  if(t.id==='myVocabSearch'){state.myVocabWorkspace.query=t.value;clearTimeout(searchTimer);const pos=t.selectionStart;searchTimer=setTimeout(()=>{render();requestAnimationFrame(()=>{const n=document.querySelector('#myVocabSearch');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch{}}});},180);}
  else if(t.id==='myQuickEnglish'){clearTimeout(searchTimer);searchTimer=setTimeout(fillQuick,220);}
});

// New-window mode: wait for the normal APS boot/auth/language flow, then open the sheet.
if(new URL(location.href).searchParams.get('myvocabs')==='1'){
  const timer=setInterval(()=>{if(state.ready&&state.auth?.initialized&&state.selectedLanguage){clearInterval(timer);state.tab='learn';state.overlay='my-vocabs';render();}},80);
  setTimeout(()=>clearInterval(timer),15000);
}
console.info(`${VERSION} loaded · personal vocabulary remains separate from master APS content.`);
})();
