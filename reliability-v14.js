'use strict';
(() => {
  const VERSION='reliability-v14';
  const OVERRIDE_PREFIX='apsContentOverridesV14:';
  const LEGACY_OVERRIDE_PREFIX='apsContentOverridesV13:';
  const GENERAL_PATH='./content/packs/hi/general-vocabulary.json';

  state.generalVocab=[];
  state.generalVocabMeta={counts:{total:0,reviewed:0,sourceReference:0}};
  state.learn.generalQuality=state.learn.generalQuality||'reviewed';
  if(state.practice.review!=='study')state.practice.review='study';
  state.v13Studio={dialogueId:'',draft:null,dirty:false};
  state.__v13BaseDialogues=[];

  const deepClone=value=>JSON.parse(JSON.stringify(value));
  const overrideKey=()=>`${OVERRIDE_PREFIX}${state.selectedLanguage||'hi'}`;
  const getOverrides=()=>{ const current=getJSON(overrideKey(),null); if(current)return current; const legacy=getJSON(`${LEGACY_OVERRIDE_PREFIX}${state.selectedLanguage||'hi'}`,{}); return legacy||{}; };
  const saveOverrides=value=>setJSON(overrideKey(),value);
  const qualityOf=d=>{
    const q=String(d?.qualityTier||'');
    if(q.startsWith('study-ready'))return 'study';
    const r=String(d?.reviewStatus||'').toLowerCase();
    return /human-edited|source-checked|owner edited|owner-reviewed/.test(r)?'study':'draft';
  };
  const studyReadyDialogues=()=>state.dialogues.filter(d=>qualityOf(d)==='study'&&d.testEligible!==false);
  const qualityLabel=d=>{
    if(String(d?.qualityTier||'').includes('revalidated'))return ['reviewed','✓ V14 natural Hindi · revalidated'];
    if(String(d?.qualityTier||'').includes('rebuilt'))return ['reviewed','✓ V14 natural Hindi · rebuilt'];
    if(/owner/i.test(String(d?.reviewStatus||'')))return ['reviewed','✓ Owner-edited local version'];
    return ['reviewed','✓ V14 natural Hindi · study-ready'];
  };

  function applyOverrides(){
    if(!state.__v13BaseDialogues.length)return;
    const overrides=getOverrides();
    const base=deepClone(state.__v13BaseDialogues);
    state.dialogues=base.map(d=>overrides[d.id]?deepClone(overrides[d.id]):d);
  }

  async function loadGeneralVocabulary(){
    if(state.selectedLanguage!=='hi'){state.generalVocab=[];return;}
    try{
      const response=await fetch(GENERAL_PATH,{cache:'no-store'});
      if(!response.ok)throw new Error(`General vocabulary HTTP ${response.status}`);
      const data=await response.json();
      state.generalVocab=Array.isArray(data.items)?data.items:[];
      state.generalVocabMeta=data;
    }catch(error){
      console.error(`${VERSION}: general vocabulary could not load`,error);
      state.generalVocab=[];
    }
  }

  function captureBaseAndOverrides(){
    state.__v13BaseDialogues=deepClone(state.dialogues);
    applyOverrides();
  }

  const originalLoadLanguagePack=loadLanguagePack;
  loadLanguagePack=async function v13LoadLanguagePack(languageId){
    await originalLoadLanguagePack(languageId);
    await loadGeneralVocabulary();
    captureBaseAndOverrides();
  };

  const originalCurrentItems=currentItems;
  currentItems=function v13CurrentItems(){
    if(state.learn.type==='general')return state.generalVocab||[];
    return originalCurrentItems();
  };

  const originalAllVocabItems=allVocabItems;
  allVocabItems=function v13AllVocabItems(){
    return [
      ...originalAllVocabItems(),
      ...(state.generalVocab||[]).map(x=>({...x,itemType:'general'}))
    ];
  };

  const originalFilteredLearnItems=filteredLearnItems;
  filteredLearnItems=function v13FilteredLearnItems(noLimit=false){
    if(state.learn.type!=='general')return originalFilteredLearnItems(noLimit);
    const q=String(state.learn.query||'');
    const quality='reviewed';
    const items=(state.generalVocab||[]).filter(x=>{
      const qualityOk=quality==='all'||(quality==='reviewed'?x.qualityStatus!=='source-reference':x.qualityStatus==='source-reference');
      return qualityOk&&
        (state.learn.topic==='all'||x.topic===state.learn.topic)&&
        (state.learn.status==='all'||itemStatus(x.id)===state.learn.status)&&
        searchMatches(`${x.english||''} ${x.hindi||''} ${(x.acceptedHindi||[]).join(' ')}`,q);
    });
    if(noLimit)return items;
    const pageSize=Number(state.learn.pageSize)||120,totalPages=Math.max(1,Math.ceil(items.length/pageSize));
    state.learn.page=clamp(Number(state.learn.page)||1,1,totalPages);
    const start=(state.learn.page-1)*pageSize;
    return items.slice(start,start+pageSize);
  };

  const originalLearnPagination=learnPagination;
  learnPagination=function v13LearnPagination(total){
    if(state.learn.type!=='general')return originalLearnPagination(total);
    const pageSize=Number(state.learn.pageSize)||120,totalPages=Math.max(1,Math.ceil(total/pageSize)),page=clamp(Number(state.learn.page)||1,1,totalPages);
    if(totalPages<=1)return '';
    const options=Array.from({length:totalPages},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===page?'selected':''}>${n}</option>`).join('');
    return `<nav class="learn-pagination" aria-label="General vocabulary pages"><button data-action="learn-page-prev" ${page<=1?'disabled':''}>← Previous</button><div><span>Page</span><select id="learnPageSelect" aria-label="Select page">${options}</select><span>of ${totalPages}</span></div><button data-action="learn-page-next" ${page>=totalPages?'disabled':''}>Next →</button></nav>`;
  };

  const originalLearnCard=learnCard;
  learnCard=function v13LearnCard(item){
    if(state.learn.type!=='general')return originalLearnCard(item);
    const open=state.learn.revealed.has(item.id),st=itemStatus(item.id);
    const reviewed=item.qualityStatus!=='source-reference';
    const qualityText=item.qualityLabel||(reviewed?'Reviewed':'Source reference');
    const synonyms=(item.acceptedHindi||[]).filter(Boolean);
    return `<article class="learn-card general-vocab-card ${open?'open':''} ${reviewed?'general-reviewed':'general-reference'}"><div class="learn-top"><small>GENERAL VOCAB</small><span class="general-quality-badge ${reviewed?'reviewed':'reference'}">${reviewed?'✓':'⚠'} ${esc(qualityText)}</span></div><button class="card-main" data-action="reveal" data-id="${esc(item.id)}"><h3>${esc(item.english)}</h3><p>${open?esc(item.hindi):'Tap to reveal Hindi'}</p>${open&&synonyms.length?`<div class="general-synonyms"><b>Also acceptable:</b> ${esc(synonyms.join(' · '))}</div>`:''}${open&&item.exampleEnglish?`<div class="example"><b>Example</b>${esc(item.exampleEnglish)}<br><span>${esc(item.exampleHindi||'')}</span></div>`:''}${open&&!reviewed?`<div class="source-reference-warning">Editorial reference only — this PDF entry has not passed APS bilingual review.</div>`:''}</button><div class="card-actions"><button data-action="general-speak-item" data-id="${esc(item.id)}">🔊 Play</button><button data-action="general-single-item-player" data-id="${esc(item.id)}">Open player ›</button></div></article>`;
  };

  learn=function v13Learn(){
    const allItems=filteredLearnItems(true),pageSize=Number(state.learn.pageSize)||120,totalPages=Math.max(1,Math.ceil(allItems.length/pageSize));
    state.learn.page=clamp(Number(state.learn.page)||1,1,totalPages);
    const start=(state.learn.page-1)*pageSize,items=allItems.slice(start,start+pageSize),shownFrom=allItems.length?start+1:0,shownTo=Math.min(start+items.length,allItems.length);
    const isPhrase=state.learn.type==='phrases',isGeneral=state.learn.type==='general';
    const countSource=isGeneral?filteredLearnItems(true):currentItems();
    const counts={};Object.keys(statusLabels).forEach(s=>counts[s]=countSource.filter(x=>itemStatus(x.id)===s).length);
    const pt=phraseTotals();
    const completionFilter=isPhrase?`<select id="learnCompletion"><option value="all" ${state.learn.completion==='all'?'selected':''}>All phrases</option><option value="remaining" ${state.learn.completion==='remaining'?'selected':''}>Remaining</option><option value="completed" ${state.learn.completion==='completed'?'selected':''}>Completed</option></select>`:'';
    const phraseSummary=isPhrase?`<section class="completion-summary"><div><strong>${pt.completed}</strong><span>completed phrases</span></div><div><strong>${pt.remaining}</strong><span>remaining phrases</span></div><div><strong>${pt.totalPractices}</strong><span>total phrase practices</span></div></section>`:'';
    const meta=state.generalVocabMeta?.counts||{total:state.generalVocab.length,reviewed:0,sourceReference:0};
    const generalSummary=isGeneral?`<section class="completion-summary general-summary"><div><strong>${Number(meta.reviewed||0).toLocaleString()}</strong><span>reviewed general terms</span></div><div><strong>${Number(meta.sourceReference||0).toLocaleString()}</strong><span>source-reference terms</span></div><div><strong>${Number(meta.total||state.generalVocab.length).toLocaleString()}</strong><span>total imported terms</span></div></section>`:'';
    const info=isGeneral
      ?`<div class="info"><b>Reviewed General Vocabs:</b> only APS-reviewed terms are shown to students. The raw PDF reference list is preserved in the content file for future editorial work but is not published in the learner view.</div>`
      :(state.learn.type==='words'?'<div class="info"><b>Core CCL Vocabulary:</b> words and short multi-word terms used for exam preparation. Full dialogue sentences remain separate.</div>':phraseSummary);
    const qualitySelect='';
    return shell(`${header('Learn',isGeneral?'Core learning plus a separate General Vocabs library':'Core CCL vocabulary and phrases')}
      <div class="segments reliability-learn-tabs"><button data-action="learn-type" data-id="words" class="${state.learn.type==='words'?'active':''}">Vocabulary <span>${state.vocab.length.toLocaleString()}</span></button><button data-action="learn-type" data-id="phrases" class="${state.learn.type==='phrases'?'active':''}">Phrases <span>${state.phrases.length.toLocaleString()}</span></button><button data-action="learn-type" data-id="general" class="${isGeneral?'active':''}">General Vocabs <span>${(state.generalVocabMeta?.counts?.reviewed||0).toLocaleString()} reviewed</span></button></div>
      ${isGeneral?generalSummary:''}${info}
      <section class="status-cards">${Object.entries(statusLabels).map(([id,label])=>`<button data-action="status-playlist" data-id="${id}" class="status-card ${id}"><b>${statusIcons[id]}</b><span><strong>${label}</strong><em>${counts[id]} ${isGeneral?'terms':state.learn.type==='words'?'words':'phrases'}</em></span><i>Play ›</i></button>`).join('')}</section>
      <section class="filter-panel"><div class="filter-row"><label class="search"><span>⌕</span><input id="learnQuery" placeholder="Search English or Hindi" value="${esc(state.learn.query)}"></label><select id="learnTopic">${topicOptions(state.learn.topic)}</select><select id="learnStatus">${statusOptions(state.learn.status)}</select>${completionFilter}${qualitySelect}</div><div class="filter-summary"><span>Showing ${shownFrom.toLocaleString()}–${shownTo.toLocaleString()} of ${allItems.length.toLocaleString()} · Page ${state.learn.page} of ${totalPages}</span>${button('▶ Play all current filters','play-current-filter','primary compact')}</div></section>
      ${learnPagination(allItems.length)}<div class="learn-grid">${items.map(item=>learnCard(item)).join('')||`<div class="empty wide-card"><h3>No matching items</h3><p>Change the quality, topic, status or search filters.</p></div>`}</div>${learnPagination(allItems.length)}
      <p class="status-note">Learning status remains local/device-synced using the existing APS progress system. General source-reference terms are never labelled as verified.</p>`);
  };

  filteredDialogues=function v13FilteredDialogues(){
    const q=state.practice.query,records=dialogueStatsMap();
    return state.dialogues.filter(d=>{
      const done=(records[d.id]?.practiceCount||0)>0;
      const completionOk=state.practice.completion==='all'||(state.practice.completion==='completed'?done:!done);
      const quality=qualityOf(d),qualityOk=state.practice.review==='all'||state.practice.review===quality;
      return qualityOk&&(state.practice.topic==='all'||d.topic===state.practice.topic)&&
        (state.practice.difficulty==='all'||d.difficulty===state.practice.difficulty)&&completionOk&&searchMatches(dialogueSearchText(d),q);
    });
  };

  practice=function v13Practice(){
    const list=filteredDialogues(),records=dialogueStatsMap();
    const qualityBase=state.dialogues.filter(d=>state.practice.review==='all'||qualityOf(d)===state.practice.review);
    let completed=0,totalPractices=0;qualityBase.forEach(d=>{const n=records[d.id]?.practiceCount||0;if(n)completed++;totalPractices+=n;});
    const remaining=Math.max(0,qualityBase.length-completed);
    return shell(`${header('Dialogue Practice','Quality-gated bilingual dialogue library')}
      <div class="info"><b>V14 study-ready library.</b> All packaged dialogues are rebuilt or revalidated for natural Hindi. Player controls, recording, transcript toggle, speed and response-gap settings are unchanged.</div>
      <section class="completion-summary"><div><strong>${completed}</strong><span>completed in this content tier</span></div><div><strong>${remaining}</strong><span>remaining in this tier</span></div><div><strong>${totalPractices}</strong><span>practices in this tier</span></div></section>
      <section class="dialogue-filter-panel"><div class="practice-search-row"><label class="search"><span aria-hidden="true">⌕</span><input id="practiceQuery" type="search" inputmode="search" autocomplete="off" aria-label="Search dialogue title, topic, English or Hindi" placeholder="Search title, topic, English or Hindi" value="${esc(state.practice.query)}"></label>${state.practice.query?button('Clear','clear-practice-search','secondary compact practice-clear'):''}</div><div class="practice-filter-row"><label><span>Topic</span><select id="practiceTopic">${topicOptions(state.practice.topic)}</select></label><label><span>Level</span><select id="practiceDifficulty"><option value="all">All levels</option>${['Foundation','Developing','Exam level'].map(x=>`<option value="${x}" ${state.practice.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>Content quality</span><select id="practiceReview"><option value="study" ${state.practice.review==='study'?'selected':''}>Study-ready (recommended)</option><option value="all" ${state.practice.review==='all'?'selected':''}>All content</option></select></label><label><span>Progress</span><select id="practiceCompletion"><option value="all" ${state.practice.completion==='all'?'selected':''}>All dialogues</option><option value="remaining" ${state.practice.completion==='remaining'?'selected':''}>Remaining</option><option value="completed" ${state.practice.completion==='completed'?'selected':''}>Completed</option></select></label></div></section>
      <div class="dialogue-count"><b>${list.length}</b> dialogues match the filters</div>
      <div class="dialogues">${list.map(d=>{const r=records[d.id]||{practiceCount:0};const done=r.practiceCount>0;const [qc,ql]=qualityLabel(d);return `<article class="dialogue-card ${qualityOf(d)==='draft'?'draft-dialogue-card':''}"><div class="tags"><span>${topicLabels[d.topic]||'Community'}</span><em>${d.difficulty}</em></div><div class="dialogue-progress ${done?'done':'remaining'}"><b>${done?'✓ Completed':'○ Remaining'}</b><span>${done?`Practised ${r.practiceCount} ${r.practiceCount===1?'time':'times'}${r.bestLow!==null?` · best ${r.bestLow}–${r.bestHigh}/45`:''}`:'Not practised yet'}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.situation)}</p><div class="content-quality ${qc}">${ql}</div>${qualityOf(d)==='draft'?'<div class="draft-notice">Not used in Mock Test. Open only for comparison or owner review.</div>':''}<div class="meta">${d.estimatedMinutes||8} min · ${d.segments.length} segments · Audio + recording${r.lastPractisedAt?` · last ${new Date(r.lastPractisedAt).toLocaleDateString()}`:''}</div><div class="actions">${button('Learning Mode','open-dialogue','secondary',`data-id="${d.id}" data-mode="learning"`)}${button(done?'Practise again →':'Practice →','open-dialogue','primary',`data-id="${d.id}" data-mode="practice"`)}</div></article>`;}).join('')||'<div class="empty wide-card"><h3>No dialogues match</h3><p>Change the topic, level, quality, completion status or search.</p></div>'}</div>`);
  };

  currentMockPair=function v13CurrentMockPair(){
    const eligible=studyReadyDialogues();
    if(eligible.length<2)return eligible;
    const current=(state.mockPair||[]).map(id=>eligible.find(d=>d.id===id)).filter(Boolean);
    if(current.length!==2){
      const shuffled=[...eligible].sort(()=>Math.random()-.5),first=shuffled[0],second=shuffled.find(d=>d.id!==first.id&&d.topic!==first.topic)||shuffled[1];
      state.mockPair=[first.id,second.id];
    }
    return state.mockPair.map(id=>eligible.find(d=>d.id===id)).filter(Boolean);
  };

  const originalHome=home;
  home=function v13Home(){
    const attempts=getJSON(storageKeys.attempts,[]),lessonProgress=getJSON(storageKeys.lesson,{chapter:0,completed:false}),last=attempts.at(-1);
    const ready=studyReadyDialogues().length,drafts=state.dialogues.length-ready,gen=state.generalVocabMeta?.counts||{};
    return shell(`${header('APS NAATI CCL Practice','English ↔ Hindi preparation · Reliability v13')}
      <section class="hero"><div><span>MEANING-FIRST CCL TRAINING</span><h2>Trust the meaning, not one memorised sentence.</h2><p>Quality-gated dialogues, vocabulary and phrases with recording, semantic feedback and a separate General Vocabs library.</p><div class="hero-actions">${button(lessonProgress.completed?'Review Lesson 0':'Start Lesson 0 →','open-lesson')}${button('Start a study-ready dialogue','quick-dialogue','secondary')}</div></div><div class="hero-score"><strong>${last?.report?`${last.report.low}–${last.report.high}`:'—'}</strong><span>${last?.report?'latest dialogue estimate':'complete a dialogue'}</span></div></section>
      <section class="stats">${[[state.vocab.length.toLocaleString(),'core vocabulary'],[state.phrases.length.toLocaleString(),'phrases'],[Number(gen.reviewed||0).toLocaleString(),'reviewed general vocabs'],[ready,'study-ready dialogues']].map(([v,l])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</section>
      <section class="reliability-banner"><div><small>CONTENT RELIABILITY V14</small><h3>All dialogue content rebuilt or revalidated for natural Hindi</h3><p>${ready} study-ready dialogues are available by default. All packaged dialogues have been rebuilt or revalidated in V14; no legacy machine-formatted dialogue is published to students.</p></div><button data-action="tab" data-id="practice" class="secondary">Open dialogue library →</button></section>
      <section class="dashboard-grid"><article class="card"><small>TODAY’S LEARNING PATH</small><h3>Word → Phrase → Segment → Dialogue</h3><div class="path"><button data-action="tab" data-id="learn"><b>1</b><span><strong>Vocabulary & General Vocabs</strong><em>Reviewed lists are the default.</em></span>›</button><button data-action="quick-dialogue"><b>2</b><span><strong>Guided dialogue</strong><em>Record, review and retry mistakes.</em></span>›</button><button data-action="start-mock"><b>3</b><span><strong>Full mock</strong><em>Only study-ready content is selected.</em></span>›</button></div></article><article class="card"><small>HOW RESULTS TEACH YOU</small><h3>Different wording can still be correct</h3><ul class="check-list"><li>Meaning-first comparison, not exact sentence matching</li><li>Synonyms and natural paraphrases can be accepted</li><li>Active/passive variation can be accepted when meaning is unchanged</li><li>Numbers, names, negation, modality and conditions remain critical</li><li>Your recording and source can be replayed for review</li></ul></article></section>
      <div class="warning">Independent preparation app. Estimated feedback is not an official NAATI result.</div>`);
  };

  function baseDialogue(id){return state.__v13BaseDialogues.find(d=>d.id===id);}
  function loadStudioDialogue(id){
    const current=state.dialogues.find(d=>d.id===id)||baseDialogue(id);
    state.v13Studio.dialogueId=id||current?.id||'';
    state.v13Studio.draft=current?deepClone(current):null;
    state.v13Studio.dirty=false;
  }
  function newOwnerSegment(dialogue,index){
    const previous=dialogue.segments[index-1]||dialogue.segments.at(-1);
    const lang=previous?.sourceLanguage==='en'?'hi':'en';
    const token=(crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`).replace(/[^a-z0-9]/gi,'').slice(0,10).toLowerCase();
    return {id:`${dialogue.id}-owner-${token}`,speaker:index%2===0?'S1':'S2',sourceLanguage:lang,source:'',model:'',sampleAnswer:'',acceptedAlternatives:[],meaningUnits:[],criticalDetails:[],comparisonPoints:[],noteHint:'',contentStatus:'Owner-added local segment — review before publication.',semanticPolicy:{meaningFirst:true,synonymsAllowed:true,naturalParaphraseAllowed:true,wordOrderFlexible:true,activePassiveEquivalentWhenMeaningPreserved:true,directSpeechPreferred:true,criticalDetailsMustMatch:true}};
  }
  function parseCritical(text){
    return String(text||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const [type,value,severity]=line.split('|').map(x=>String(x||'').trim());return {type:type||'detail',value:value||'',severity:severity||'major'};}).filter(x=>x.value);
  }
  function criticalText(list){return (list||[]).map(x=>`${x.type||'detail'} | ${x.value||''} | ${x.severity||'major'}`).join('\n');}
  function captureStudioForm(){
    const d=state.v13Studio.draft;if(!d)return;
    const title=document.querySelector('#studioTitle'),sit=document.querySelector('#studioSituation'),rs=document.querySelector('#studioReviewStatus');
    if(title)d.title=title.value.trim();if(sit)d.situation=sit.value.trim();if(rs)d.reviewStatus=rs.value.trim()||'Owner edited — local override';
    document.querySelectorAll('.studio-segment').forEach(card=>{
      const i=Number(card.dataset.index),s=d.segments[i];if(!s)return;
      const get=name=>card.querySelector(`[data-studio-field="${name}"]`);
      s.sourceLanguage=get('language')?.value==='hi'?'hi':'en';
      s.source=get('source')?.value.trim()||'';
      s.model=get('model')?.value.trim()||'';s.sampleAnswer=s.model;
      s.acceptedAlternatives=String(get('alternatives')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);
      s.comparisonPoints=String(get('points')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);
      s.meaningUnits=s.comparisonPoints.map((p,j)=>({id:`${s.id}u${j+1}`,label:p,acceptedConcepts:[p],required:true}));
      s.criticalDetails=parseCritical(get('critical')?.value||'');
      s.noteHint=s.comparisonPoints.join(' | ');
      s.contentStatus='Owner edited locally in Content Studio v13. Export and merge to GitHub after review.';
      s.semanticPolicy={meaningFirst:true,synonymsAllowed:true,naturalParaphraseAllowed:true,wordOrderFlexible:true,activePassiveEquivalentWhenMeaningPreserved:true,directSpeechPreferred:true,criticalDetailsMustMatch:true};
    });
    state.v13Studio.dirty=true;
  }
  function saveStudio(){
    captureStudioForm();const d=state.v13Studio.draft;if(!d)return;
    if(!d.title||!d.segments.length){showToast('Dialogue needs a title and at least one segment');return;}
    const invalid=d.segments.find(s=>!s.source||!s.model||!['en','hi'].includes(s.sourceLanguage));
    if(invalid){showToast('Complete source and sample answer for every segment');return;}
    d.reviewStatus=d.reviewStatus||'Owner edited — local override';d.qualityTier='study-ready-owner-edited';d.publicationStatus='local-owner-review';d.testEligible=d.segments.every(s=>String(s.source||'').trim().split(/\s+/).filter(Boolean).length<=35);
    d.contentVersion='v13-owner-local';d.lastOwnerEditAt=new Date().toISOString();
    const overrides=getOverrides();overrides[d.id]=deepClone(d);saveOverrides(overrides);applyOverrides();loadStudioDialogue(d.id);showToast('Local content override saved');
  }
  function exportOverrides(){
    const payload={schemaVersion:'1.0',type:'aps-naati-content-overrides',contentVersion:'v13',language:state.selectedLanguage||'hi',exportedAt:new Date().toISOString(),dialogues:Object.values(getOverrides())};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`APS_NAATI_Content_Overrides_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  async function importOverrides(file){
    const data=JSON.parse(await file.text());const arr=Array.isArray(data)?data:(Array.isArray(data.dialogues)?data.dialogues:[]);if(!arr.length)throw new Error('No dialogue overrides found');
    const known=new Set(state.__v13BaseDialogues.map(d=>d.id));const overrides=getOverrides();let count=0;
    for(const d of arr){if(d&&d.id&&known.has(d.id)&&Array.isArray(d.segments)){overrides[d.id]=d;count++;}}
    if(!count)throw new Error('No matching dialogue IDs found');saveOverrides(overrides);applyOverrides();loadStudioDialogue(arr.find(d=>d?.id&&known.has(d.id))?.id||state.dialogues[0]?.id);render();showToast(`${count} content override${count===1?'':'s'} imported`);
  }
  function studioSegmentCard(s,i,total){
    return `<article class="studio-segment" data-index="${i}"><header><div><b>Segment ${i+1}</b><small>${esc(s.id)}</small></div><div class="studio-move"><button type="button" data-action="studio-move" data-index="${i}" data-delta="-1" ${i===0?'disabled':''}>↑</button><button type="button" data-action="studio-move" data-index="${i}" data-delta="1" ${i===total-1?'disabled':''}>↓</button><button type="button" data-action="studio-delete" data-index="${i}" class="danger">Delete</button></div></header><div class="studio-grid"><label>Source language<select data-studio-field="language"><option value="en" ${s.sourceLanguage==='en'?'selected':''}>English</option><option value="hi" ${s.sourceLanguage==='hi'?'selected':''}>Hindi</option></select></label><label class="wide">Source / dialogue line<textarea rows="3" data-studio-field="source">${esc(s.source||'')}</textarea></label><label class="wide">Primary sample answer<textarea rows="3" data-studio-field="model">${esc(s.sampleAnswer||s.model||'')}</textarea></label><label class="wide">Accepted example alternatives <span>one per line; semantic scoring can accept other valid paraphrases too</span><textarea rows="3" data-studio-field="alternatives">${esc((s.acceptedAlternatives||[]).join('\n'))}</textarea></label><label>Meaning points <span>one per line</span><textarea rows="4" data-studio-field="points">${esc((s.comparisonPoints||[]).join('\n'))}</textarea></label><label>Critical details <span>type | value | severity</span><textarea rows="4" data-studio-field="critical">${esc(criticalText(s.criticalDetails))}</textarea></label></div></article>`;
  }
  function renderStudio(){
    if(!state.v13Studio.draft)loadStudioDialogue(state.dialogues[0]?.id||'');
    const d=state.v13Studio.draft,overrides=getOverrides(),count=Object.keys(overrides).length;
    if(!d)return `<div class="modal-backdrop"><div class="modal settings-modal"><h2>No dialogues loaded</h2>${button('Done','close-modal')}</div></div>`;
    const options=state.dialogues.map(x=>{const q=qualityOf(x)==='study'?'Study-ready':'Draft';return `<option value="${esc(x.id)}" ${x.id===d.id?'selected':''}>${esc(x.id.replace('dialogue-',''))} · ${esc(x.title)} · ${q}</option>`;}).join('');
    return `<div class="modal-backdrop content-studio-backdrop"><div class="modal content-studio-modal"><button class="modal-close" data-action="close-modal">×</button><div class="studio-heading"><div><small>OWNER / EDITOR TOOL</small><h2>Content Studio</h2><p>Edit dialogue lines and sample answers, add missing segments, reorder segments and export your corrections. Changes are local until you export and merge them into GitHub.</p></div><span>${count} locally edited dialogue${count===1?'':'s'}</span></div><div class="studio-toolbar"><label>Dialogue<select id="contentDialogueSelect">${options}</select></label><div>${button('Import edits','studio-import-trigger','secondary')}${button('Export all edits','studio-export','secondary')}<input id="studioImportFile" type="file" accept="application/json,.json" hidden></div></div><section class="studio-dialogue-meta"><label>Dialogue title<input id="studioTitle" value="${esc(d.title||'')}"></label><label>Content status<input id="studioReviewStatus" value="${esc(d.reviewStatus||'Owner edited — local override')}"></label><label class="wide">Situation<textarea id="studioSituation" rows="2">${esc(d.situation||'')}</textarea></label></section><div class="studio-safety-note"><b>Meaning-first answer policy:</b> the sample answers are examples, not a fixed sentence key. Valid synonyms, natural paraphrases and active/passive changes can be accepted when the same meaning, speaker intent and critical details are preserved.</div><div class="studio-segments">${d.segments.map((s,i)=>studioSegmentCard(s,i,d.segments.length)).join('')}</div><div class="studio-bottom-actions">${button('+ Add missing segment','studio-add-segment','secondary')}${button('Reset this dialogue to packaged version','studio-reset','danger')}${button('Save local edit','studio-save','primary')}${button('Done','close-modal','secondary')}</div></div></div>`;
  }

  const originalRenderModal=renderModal;
  renderModal=function v13RenderModal(){
    if(state.modal?.type==='content-studio')return renderStudio();
    const html=originalRenderModal();
    if(state.modal?.type!=='app-settings'||!html)return html;
    const insert=`<div class="voice-settings-section content-studio-settings"><h3>Content reliability & editing</h3><p>Open the local Content Studio to correct dialogue wording, sample answers or missing segments without changing the Firebase login or requiring another server.</p><div class="content-studio-setting-actions">${button('Open Content Studio','open-content-studio','secondary')}${button('Export content edits','studio-export','secondary')}</div><small>${Object.keys(getOverrides()).length} dialogue override${Object.keys(getOverrides()).length===1?'':'s'} saved on this device.</small></div>`;
    return html.replace('<div class="settings-actions">',`${insert}<div class="settings-actions">`);
  };

  app.addEventListener('click',async event=>{
    const el=event.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
    if(a==='general-speak-item'){
      event.preventDefault();const item=(state.generalVocab||[]).find(x=>x.id===el.dataset.id);if(item){speechSynthesis.cancel();await speakLearningPair(item.english,item.hindi,null);}
    }else if(a==='general-single-item-player'){
      event.preventDefault();const item=(state.generalVocab||[]).find(x=>x.id===el.dataset.id);if(item)startVocabularyPlaylist(false,{...item,itemType:'general'});
    }else if(a==='open-content-studio'){
      event.preventDefault();loadStudioDialogue(state.v13Studio.dialogueId||state.dialogues[0]?.id);state.modal={type:'content-studio'};render();
    }else if(a==='studio-add-segment'){
      event.preventDefault();captureStudioForm();const d=state.v13Studio.draft;d.segments.push(newOwnerSegment(d,d.segments.length));render();
    }else if(a==='studio-delete'){
      event.preventDefault();captureStudioForm();const i=Number(el.dataset.index);if(state.v13Studio.draft.segments.length<=1){showToast('A dialogue must keep at least one segment');return;}state.v13Studio.draft.segments.splice(i,1);render();
    }else if(a==='studio-move'){
      event.preventDefault();captureStudioForm();const i=Number(el.dataset.index),j=i+Number(el.dataset.delta),arr=state.v13Studio.draft.segments;if(j>=0&&j<arr.length){[arr[i],arr[j]]=[arr[j],arr[i]];render();}
    }else if(a==='studio-save'){
      event.preventDefault();saveStudio();render();
    }else if(a==='studio-reset'){
      event.preventDefault();const id=state.v13Studio.draft?.id;if(!id)return;if(!confirm('Reset this dialogue to the packaged version and remove its local edit?'))return;const overrides=getOverrides();delete overrides[id];saveOverrides(overrides);applyOverrides();loadStudioDialogue(id);render();showToast('Local override removed');
    }else if(a==='studio-export'){
      event.preventDefault();exportOverrides();
    }else if(a==='studio-import-trigger'){
      event.preventDefault();document.querySelector('#studioImportFile')?.click();
    }
  });

  app.addEventListener('change',async event=>{
    const t=event.target;
    if(t.id==='generalQuality'){state.learn.generalQuality=t.value;state.learn.page=1;render();}
    else if(t.id==='contentDialogueSelect'){captureStudioForm();loadStudioDialogue(t.value);render();}
    else if(t.id==='studioImportFile'&&t.files?.[0]){try{await importOverrides(t.files[0]);}catch(error){console.error(error);showToast(error.message||'Could not import content edits');}t.value='';}
  });

  // Patch quick-dialogue so the default home button cannot randomly open a legacy draft.
  app.addEventListener('click',event=>{
    const el=event.target.closest('[data-action="quick-dialogue"]');if(!el)return;
    const eligible=studyReadyDialogues();
    if(!eligible.length)return;
    event.stopImmediatePropagation();event.preventDefault();
    const d=eligible[Math.floor(Math.random()*eligible.length)];openDialogue(d.id,'learning');
  },true);

  async function initialise(){
    if(!state.ready)return false;
    await loadGeneralVocabulary();
    if(!state.__v13BaseDialogues.length)captureBaseAndOverrides();
    if(state.practice.review!=='study')state.practice.review='study';
    render();
    console.info(`${VERSION} loaded: ${studyReadyDialogues().length} study-ready dialogues, ${state.generalVocab.length} general vocabulary records`);
    return true;
  }
  const timer=setInterval(async()=>{if(await initialise())clearInterval(timer);},60);
  setTimeout(async()=>{if(!state.__v13BaseDialogues.length)await initialise();},1500);
})();
