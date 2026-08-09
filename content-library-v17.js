'use strict';
(() => {
  const VERSION='content-library-v17';
  const OWNER_PATH='./content/owner-content-v16.json';
  const OWNER_LOCAL_PREFIX='apsOwnerContentV16:';
  const GITHUB_CONFIG_KEY='apsV16GithubConfig';
  const V15_DIALOGUE_OVERRIDE_PREFIX='apsContentOverridesV15:';
  const API_VERSION='2026-03-10';

  const clone=value=>JSON.parse(JSON.stringify(value));
  const nowIso=()=>new Date().toISOString();
  const ownerKey=()=>`${OWNER_LOCAL_PREFIX}${state.selectedLanguage||'hi'}`;
  const v15DialogueKey=()=>`${V15_DIALOGUE_OVERRIDE_PREFIX}${state.selectedLanguage||'hi'}`;
  const emptyOwner=()=>({schemaVersion:'1.1',contentVersion:'17.0.0',language:state.selectedLanguage||'hi',updatedAt:null,vocabulary:{},phrases:{},dialogues:{},merges:{vocabulary:{},phrases:{}}});
  const safeOwner=value=>({
    ...emptyOwner(),
    ...(value&&typeof value==='object'?value:{}),
    vocabulary:{...(value?.vocabulary||{})},
    phrases:{...(value?.phrases||{})},
    dialogues:{...(value?.dialogues||{})},
    merges:{
      vocabulary:{...(value?.merges?.vocabulary||{})},
      phrases:{...(value?.merges?.phrases||{})}
    }
  });

  state.v16Published=emptyOwner();
  state.v16Base={captured:false,vocab:[],general:[],phrases:[],dialogueVocab:{}};
  state.dialoguePhrasesById=state.dialoguePhrasesById||{};
  state.v16Studio={
    tab:'dialogues',vocabQuery:'',vocabFilter:'all',phraseQuery:'',phraseFilter:'all',
    selectedVocabId:'',selectedPhraseId:'',vocabDraft:null,phraseDraft:null,
    vocabAllocSearch:'',phraseAllocSearch:'',publishReview:false,
    mergeSearch:'',mergePanel:false,mergeCandidateId:'',dirty:false
  };
  state.v16Github={...(getJSON(GITHUB_CONFIG_KEY,{})||{}),token:'',busy:false,status:'',lastCommit:''};
  state.v16ReturnToStudio=false;

  function getLocalOwner(){return safeOwner(getJSON(ownerKey(),emptyOwner()));}
  function saveLocalOwner(value){value.updatedAt=nowIso();setJSON(ownerKey(),safeOwner(value));}
  function getDialogueOverrides(){return getJSON(v15DialogueKey(),{})||{};}

  function mergeOwnerRecords(){
    const local=getLocalOwner();
    return {
      vocabulary:{...(state.v16Published.vocabulary||{}),...(local.vocabulary||{})},
      phrases:{...(state.v16Published.phrases||{}),...(local.phrases||{})}
    };
  }

  function mergedAliases(kind){
    const bucket=kind==='vocab'?'vocabulary':'phrases';
    return {
      ...(state.v16Published?.merges?.[bucket]||{}),
      ...(getLocalOwner()?.merges?.[bucket]||{})
    };
  }

  function resolveMergedId(kind,id){
    if(!id)return id;
    const aliases=mergedAliases(kind),seen=new Set();let current=id;
    while(aliases[current]&&aliases[current]!==current&&!seen.has(current)){
      seen.add(current);current=aliases[current];
    }
    return current;
  }

  function isMergedAway(kind,id){return Boolean(id&&resolveMergedId(kind,id)!==id);}

  function captureBase(){
    state.v16Base={
      captured:true,
      vocab:clone(state.vocab||[]),
      general:clone(state.generalVocab||[]),
      phrases:clone(state.phrases||[]),
      dialogueVocab:clone(state.dialogueVocabById||{})
    };
  }

  function normaliseAllocations(a={},kind='vocab'){
    return {
      core:kind==='vocab'&&a.core===true,
      general:kind==='vocab'&&a.general===true,
      main:kind==='phrase'&&a.main!==false,
      dialogues:[...new Set(Array.isArray(a.dialogues)?a.dialogues.filter(Boolean):[])].sort()
    };
  }

  function baseVocabCatalog(){
    const map=new Map();
    const upsert=(item,patch={})=>{
      if(!item?.id)return;
      const old=map.get(item.id)||{
        id:item.id,english:item.english||'',hindi:item.hindi||'',acceptedHindi:[],exampleEnglish:'',exampleHindi:'',notes:'',topic:item.topic||'community',
        allocations:{core:false,general:false,dialogues:[]},reviewStatus:'packaged',archived:false,source:'packaged'
      };
      const merged={...old,...item,...patch};
      merged.acceptedHindi=[...new Set([...(old.acceptedHindi||[]),...(item.acceptedHindi||[])].filter(Boolean))];
      merged.allocations=normaliseAllocations({...old.allocations,...(patch.allocations||{})},'vocab');
      merged.allocations.dialogues=[...new Set([...(old.allocations?.dialogues||[]),...(patch.allocations?.dialogues||[])])].sort();
      if(!merged.exampleEnglish&&item.sourceExampleEnglish)merged.exampleEnglish=item.sourceExampleEnglish;
      map.set(item.id,merged);
    };
    state.v16Base.vocab.forEach(x=>upsert(x,{allocations:{core:true}}));
    state.v16Base.general.forEach(x=>upsert(x,{allocations:{general:true}}));
    Object.entries(state.v16Base.dialogueVocab||{}).forEach(([dialogueId,row])=>(row.items||[]).forEach(x=>upsert(x,{allocations:{dialogues:[dialogueId]}})));
    return map;
  }

  function basePhraseCatalog(){
    const map=new Map();
    state.v16Base.phrases.forEach(item=>{
      if(!item?.id)return;
      map.set(item.id,{...item,acceptedHindi:[...(item.acceptedHindi||[])],exampleEnglish:item.exampleEnglish||'',exampleHindi:item.exampleHindi||'',notes:item.notes||'',allocations:{main:true,dialogues:[]},reviewStatus:'packaged',archived:false,source:'packaged'});
    });
    return map;
  }

  function overlayRecord(base,override,kind){
    if(!override)return base;
    const merged={...(base||{}),...clone(override)};
    merged.allocations=normaliseAllocations(override.allocations||base?.allocations||{},kind);
    merged.acceptedHindi=[...new Set((override.acceptedHindi||base?.acceptedHindi||[]).filter(Boolean))];
    return merged;
  }

  function vocabCatalog({includeDrafts=true}={}){
    const map=baseVocabCatalog(),published=state.v16Published.vocabulary||{},local=getLocalOwner().vocabulary||{};
    Object.entries(published).forEach(([id,record])=>map.set(id,overlayRecord(map.get(id),record,'vocab')));
    Object.entries(local).forEach(([id,record])=>{if(includeDrafts||record.reviewStatus!=='draft')map.set(id,overlayRecord(map.get(id),record,'vocab'));});
    return map;
  }

  function phraseCatalog({includeDrafts=true}={}){
    const map=basePhraseCatalog(),published=state.v16Published.phrases||{},local=getLocalOwner().phrases||{};
    Object.entries(published).forEach(([id,record])=>map.set(id,overlayRecord(map.get(id),record,'phrase')));
    Object.entries(local).forEach(([id,record])=>{if(includeDrafts||record.reviewStatus!=='draft')map.set(id,overlayRecord(map.get(id),record,'phrase'));});
    return map;
  }

  function studentOwnerRecord(local,published){
    if(local){
      if(local.reviewStatus==='draft')return published||null;
      return local;
    }
    return published||null;
  }

  function applyOwnerContent(){
    if(!state.v16Base.captured)return;
    const local=getLocalOwner(),published=state.v16Published;
    const vocabMap=baseVocabCatalog();
    const ids=new Set([...Object.keys(published.vocabulary||{}),...Object.keys(local.vocabulary||{})]);
    ids.forEach(id=>{
      const owner=studentOwnerRecord(local.vocabulary?.[id],published.vocabulary?.[id]);
      if(owner)vocabMap.set(id,overlayRecord(vocabMap.get(id),owner,'vocab'));
    });

    const core=[],general=[],dialogueRows=clone(state.v16Base.dialogueVocab||{});
    Object.values(dialogueRows).forEach(row=>row.items=[]);
    const baseRows=state.v16Base.dialogueVocab||{};
    Object.keys(baseRows).forEach(id=>{if(!dialogueRows[id])dialogueRows[id]={...clone(baseRows[id]),items:[]};});

    vocabMap.forEach(record=>{
      if(record.archived||isMergedAway('vocab',record.id))return;
      const common={
        id:record.id,topic:record.topic||'community',english:record.english||'',hindi:record.hindi||'',acceptedHindi:[...(record.acceptedHindi||[])],
        exampleEnglish:record.exampleEnglish||record.sourceExampleEnglish||'',exampleHindi:record.exampleHindi||'',notes:record.notes||'',qualityStatus:record.reviewStatus==='published'?'owner-published-v17':record.reviewStatus==='reviewed'?'owner-reviewed-v17':record.qualityStatus,
        status:record.status||record.reviewStatus||'owner-v17'
      };
      if(record.allocations?.core)core.push({...common,itemType:'word'});
      if(record.allocations?.general)general.push({...common,itemType:'general',kind:'general-vocabulary',qualityStatus:common.qualityStatus||'owner-reviewed-v17',qualityLabel:'Owner reviewed'});
      (record.allocations?.dialogues||[]).forEach(dialogueId=>{
        const d=state.dialogues.find(x=>x.id===dialogueId);
        if(!d)return;
        if(!dialogueRows[dialogueId])dialogueRows[dialogueId]={dialogueId,title:d.title,topic:d.topic,itemCount:0,items:[]};
        dialogueRows[dialogueId].items.push({...common,itemType:'dialogue-vocab',kind:'dialogue-key-vocabulary',dialogueId});
      });
    });
    Object.values(dialogueRows).forEach(row=>{row.items=row.items||[];row.itemCount=row.items.length;});
    state.vocab=core;
    state.generalVocab=general;
    state.dialogueVocabById=dialogueRows;
    state.dialogueVocabMeta={...(state.dialogueVocabMeta||{}),dialogueCount:Object.keys(dialogueRows).length,itemCount:Object.values(dialogueRows).reduce((n,r)=>n+(r.items?.length||0),0)};

    const phraseMap=basePhraseCatalog();
    const phraseIds=new Set([...Object.keys(published.phrases||{}),...Object.keys(local.phrases||{})]);
    phraseIds.forEach(id=>{
      const owner=studentOwnerRecord(local.phrases?.[id],published.phrases?.[id]);
      if(owner)phraseMap.set(id,overlayRecord(phraseMap.get(id),owner,'phrase'));
    });
    const main=[],byDialogue={};
    phraseMap.forEach(record=>{
      if(record.archived||isMergedAway('phrase',record.id))return;
      const common={id:record.id,topic:record.topic||'community',english:record.english||'',hindi:record.hindi||'',acceptedHindi:[...(record.acceptedHindi||[])],exampleEnglish:record.exampleEnglish||'',exampleHindi:record.exampleHindi||'',notes:record.notes||'',status:record.reviewStatus||record.status||'owner-v17',itemType:'phrase'};
      if(record.allocations?.main!==false)main.push(common);
      (record.allocations?.dialogues||[]).forEach(dialogueId=>{(byDialogue[dialogueId]||(byDialogue[dialogueId]=[])).push({...common,dialogueId});});
    });
    state.phrases=main;
    state.dialoguePhrasesById=byDialogue;
    migrateAllMergeAliases();
  }

  async function loadPublishedOwner(){
    try{
      const r=await fetch(OWNER_PATH,{cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      state.v16Published=safeOwner(await r.json());
      const localDialogs=getDialogueOverrides();
      const merged={...(state.v16Published.dialogues||{}),...localDialogs};
      if(JSON.stringify(merged)!==JSON.stringify(localDialogs))setJSON(v15DialogueKey(),merged);
      if(Object.keys(state.v16Published.dialogues||{}).length){
        state.dialogues=state.dialogues.map(d=>merged[d.id]?clone(merged[d.id]):d);
      }
    }catch(error){
      console.warn(`${VERSION}: published owner content unavailable; using packaged content`,error);
      state.v16Published=emptyOwner();
    }
  }

  // Keep the working V15 language-pack flow and layer V17 content after it.
  const v15LoadLanguagePack=loadLanguagePack;
  loadLanguagePack=async function v17LoadLanguagePack(languageId){
    await v15LoadLanguagePack(languageId);
    captureBase();
    await loadPublishedOwner();
    applyOwnerContent();
  };

  function initialiseExampleSettings(){
    if(state.vocabSettings.showExamples===undefined)state.vocabSettings.showExamples=true;
    if(state.vocabSettings.speakExamples===undefined)state.vocabSettings.speakExamples=state.vocabSettings.examples!==false;
    state.vocabSettings.showExamples=state.vocabSettings.showExamples!==false;
    state.vocabSettings.speakExamples=state.vocabSettings.speakExamples!==false;
    state.vocabSettings.examples=state.vocabSettings.speakExamples;
    saveVocabSettings();
  }

  // Independent display and speech controls for examples in recall/player mode.
  vocabPlayerOverlay=function v17VocabPlayerOverlay(){
    const vp=state.vocabPlayer,item=allVocabItems().find(x=>x.id===vp.queue[vp.index]);
    if(!item)return `<div class="fullscreen"><div class="empty"><h2>No items in this playlist</h2>${button('Close','close-overlay')}</div></div>`;
    const st=itemStatus(item.id),progress=(vp.index+1)/vp.queue.length*100;
    const hideEnglish=state.vocabSettings.hideEnglish===true,hideHindi=state.vocabSettings.hideHindi===true;
    const hasExample=Boolean(item.exampleEnglish||item.exampleHindi);
    const hideExample=hasExample&&state.vocabSettings.showExamples===false;
    const recallActive=hideEnglish||hideHindi||hideExample;
    const revealed=recallActive&&vp.revealCurrent===true;
    const englishHidden=hideEnglish&&!revealed,hindiHidden=hideHindi&&!revealed,exampleHidden=hideExample&&!revealed;
    const stageAction=recallActive?' data-action="toggle-recall-reveal" tabindex="0" role="button" aria-label="Reveal or hide recalled content for this card"':'';
    const exampleHtml=hasExample?`<div class="player-example ${exampleHidden?'is-hidden':''}"><b>Example</b>${exampleHidden?'<p class="recall-hidden-label">Example hidden</p>':`${item.exampleEnglish?`<p>${esc(item.exampleEnglish)}</p>`:''}${item.exampleHindi?`<span>${esc(item.exampleHindi)}</span>`:''}`}</div>`:'';
    return `<div class="fullscreen vocab-player-screen"><header class="top"><button data-action="close-vocab-player">← Exit</button><div><strong>${esc(vp.title)}</strong><span>${vp.index+1}/${vp.queue.length}</span></div><div class="top-actions"><button class="top-search-button" data-action="global-search" type="button" aria-label="Search all Hindi material" aria-expanded="false">⌕ <b>Search</b></button><button class="compact-settings-button" data-action="vocab-settings" aria-label="Open vocabulary settings"><span aria-hidden="true">⚙</span><b>Settings</b></button></div></header><div class="progress"><i style="width:${progress}%"></i></div>
      <main class="vocab-player"><div class="vocab-topic">${topicLabels[item.topic]||'Community'} · ${item.itemType==='phrase'?'Phrase':item.itemType==='dialogue-vocab'?'Dialogue vocabulary':'NAATI vocabulary'}</div>
      <section class="recall-display-controls" aria-label="Recall display options"><span>Recall</span><button type="button" data-action="toggle-hide-english" class="recall-display-toggle ${hideEnglish?'active':''}" aria-pressed="${hideEnglish?'true':'false'}">${hideEnglish?'Show':'Hide'} English</button><button type="button" data-action="toggle-hide-hindi" class="recall-display-toggle ${hideHindi?'active':''}" aria-pressed="${hideHindi?'true':'false'}">${hideHindi?'Show':'Hide'} Hindi</button><button type="button" data-action="toggle-hide-example" class="recall-display-toggle ${hideExample?'active':''}" aria-pressed="${hideExample?'true':'false'}" ${hasExample?'':'disabled'}>${hideExample?'Show':'Hide'} Example</button></section>
      <section class="word-stage ${recallActive?'recall-active':''} ${revealed?'recall-revealed':''}"${stageAction}><button class="speaker-button" data-action="speak-current" aria-label="Play pronunciation">🔊</button><h1 class="recall-language english ${englishHidden?'is-hidden':''}">${englishHidden?'<span class="recall-hidden-label">English hidden</span>':esc(item.english)}</h1><h2 class="recall-language hindi ${hindiHidden?'is-hidden':''}">${hindiHidden?'<span class="recall-hidden-label">Hindi hidden</span>':esc(item.hindi)}</h2>${exampleHtml}${recallActive?`<div class="recall-reveal-hint">${revealed?'Tap card again to hide':'Tap anywhere on this card to reveal hidden content'}</div>`:''}</section>
      <div class="player-timeline"><span>${vp.playing?vp.gapRemaining>0?`Next item in ${vp.gapRemaining}s`:'Speaking…':'Paused'}</span><div><i style="width:${progress}%"></i></div></div>
      <div class="transport"><button data-action="vocab-prev">‹<span>Previous</span></button><button class="main-play" data-action="vocab-toggle">${vp.playing?'Ⅱ':'▶'}</button><button data-action="vocab-next"><span>Next</span>›</button></div>
      <section class="status-control"><h3>Change word status</h3><div>${Object.entries(statusLabels).map(([id,label])=>`<button data-action="vocab-status" data-id="${id}" class="${st===id?'active':''} ${id}"><b>${statusIcons[id]}</b><span>${label}</span></button>`).join('')}</div></section>
      <section class="quick-settings six"><label>English speed<select id="vocabRateEn">${[.6,.75,.9,1,1.15,1.3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.rateEn)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Hindi speed<select id="vocabRateHi">${[.6,.75,.9,1,1.15,1.3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.rateHi)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Meaning delay<select id="vocabTranslationDelay">${[0,.5,1,1.5,2,3,5].map(x=>`<option value="${x}" ${Number(state.vocabSettings.translationDelay)===x?'selected':''}>${x}s</option>`).join('')}</select></label><label>Next-item gap<select id="vocabGap">${[0,1,2,3,5,8].map(x=>`<option value="${x}" ${Number(state.vocabSettings.gap)===x?'selected':''}>${x}s</option>`).join('')}</select></label><label>Repeat pair<select id="vocabRepeat">${[1,2,3].map(x=>`<option value="${x}" ${Number(state.vocabSettings.repeat)===x?'selected':''}>${x}×</option>`).join('')}</select></label><label>Order<select id="vocabOrder"><option value="sequential" ${state.vocabSettings.order==='sequential'?'selected':''}>In order</option><option value="random" ${state.vocabSettings.order==='random'?'selected':''}>Random</option></select></label></section></main>${renderModal()}</div>`;
  };

  speakVocabItem=async function v17SpeakVocabItem({autoplay=false}={}){
    const vp=state.vocabPlayer,item=allVocabItems().find(x=>x.id===vp.queue[vp.index]);if(!item)return;
    const token=++vp.token,repeats=autoplay?Number(state.vocabSettings.repeat):1;
    speechSynthesis.cancel();
    for(let r=0;r<repeats;r++){
      if(token!==vp.token)return;
      if(!await speakLearningPair(item.english,item.hindi,token))return;
      if(state.vocabSettings.speakExamples!==false&&(item.exampleEnglish||item.exampleHindi)){
        if(!await vocabDelay(.35,token))return;
        if(!await speakLearningPair(item.exampleEnglish||'',item.exampleHindi||'',token))return;
      }
      if(r<repeats-1&&!await vocabDelay(.35,token))return;
    }
    if(token===vp.token&&item.itemType==='phrase')recordPhrasePractice(item.id);
    if(!autoplay||!vp.playing||token!==vp.token)return;
    for(let g=Number(state.vocabSettings.gap);g>0;g--){vp.gapRemaining=g;render();await delay(1000);if(!vp.playing||token!==vp.token)return;}
    vp.gapRemaining=0;moveVocab(1,false);render();await delay(100);if(vp.playing)speakVocabItem({autoplay:true});
  };

  function topicSelect(value){
    return Object.entries(topicLabels).filter(([id])=>id!=='all').map(([id,label])=>`<option value="${esc(id)}" ${value===id?'selected':''}>${esc(label)}</option>`).join('');
  }
  function statusBadge(status){const s=status||'packaged';return `<span class="v16-status ${esc(s)}">${esc(s.replace(/-/g,' '))}</span>`;}
  function allocLabel(record,kind){
    if(record?.mergedInto)return `Merged → ${record.mergedInto}`;
    const a=record.allocations||{};const parts=[];
    if(kind==='vocab'&&a.core)parts.push('Core');if(kind==='vocab'&&a.general)parts.push('General');if(kind==='phrase'&&a.main!==false)parts.push('Main phrases');
    if(a.dialogues?.length)parts.push(`${a.dialogues.length} dialogue${a.dialogues.length===1?'':'s'}`);
    const label=parts.join(' · ')||'Unallocated';return record?.archived?`Archived · ${label}`:label;
  }
  function dialogueName(id){const d=state.dialogues.find(x=>x.id===id);return d?`${id.replace('dialogue-','Dialogue ')} · ${d.title}`:id;}
  function searchVocabRecords(){
    const q=state.v16Studio.vocabQuery||'',filter=state.v16Studio.vocabFilter||'all';
    let rows=[...vocabCatalog().values()];
    if(filter==='core')rows=rows.filter(x=>x.allocations?.core);
    else if(filter==='general')rows=rows.filter(x=>x.allocations?.general);
    else if(filter==='dialogue')rows=rows.filter(x=>x.allocations?.dialogues?.length);
    else if(filter==='review')rows=rows.filter(x=>['draft','reviewed','published'].includes(x.reviewStatus));
    if(q){rows=rows.filter(x=>searchMatches(`${x.id} ${x.english} ${x.hindi} ${(x.acceptedHindi||[]).join(' ')} ${x.exampleEnglish||''} ${x.exampleHindi||''} ${x.topic||''} ${(x.allocations?.dialogues||[]).map(dialogueName).join(' ')}`,q));}
    rows.sort((a,b)=>String(a.english).localeCompare(String(b.english)));
    return rows;
  }
  function searchPhraseRecords(){
    const q=state.v16Studio.phraseQuery||'',filter=state.v16Studio.phraseFilter||'all';
    let rows=[...phraseCatalog().values()];
    if(filter==='dialogue')rows=rows.filter(x=>x.allocations?.dialogues?.length);
    else if(filter==='review')rows=rows.filter(x=>['draft','reviewed','published'].includes(x.reviewStatus));
    if(q){rows=rows.filter(x=>searchMatches(`${x.id} ${x.english} ${x.hindi} ${(x.acceptedHindi||[]).join(' ')} ${x.exampleEnglish||''} ${x.exampleHindi||''} ${x.topic||''} ${(x.allocations?.dialogues||[]).map(dialogueName).join(' ')}`,q));}
    rows.sort((a,b)=>String(a.english).localeCompare(String(b.english)));
    return rows;
  }

  function makeVocabDraft(id){
    const row=id?vocabCatalog().get(id):null;
    return row?clone(row):{id:`own-vocab-hi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,english:'',hindi:'',acceptedHindi:[],exampleEnglish:'',exampleHindi:'',notes:'',topic:'community',allocations:{core:false,general:false,dialogues:[]},reviewStatus:'draft',archived:false,source:'owner-v17'};
  }
  function makePhraseDraft(id){
    const row=id?phraseCatalog().get(id):null;
    return row?clone(row):{id:`own-phrase-hi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,english:'',hindi:'',acceptedHindi:[],exampleEnglish:'',exampleHindi:'',notes:'',topic:'community',allocations:{main:true,dialogues:[]},reviewStatus:'draft',archived:false,source:'owner-v17'};
  }
  function ensureSelectedVocab(){
    if(!state.v16Studio.vocabDraft){const rows=searchVocabRecords();state.v16Studio.selectedVocabId=state.v16Studio.selectedVocabId||rows[0]?.id||'';state.v16Studio.vocabDraft=makeVocabDraft(state.v16Studio.selectedVocabId||null);}
  }
  function ensureSelectedPhrase(){
    if(!state.v16Studio.phraseDraft){const rows=searchPhraseRecords();state.v16Studio.selectedPhraseId=state.v16Studio.selectedPhraseId||rows[0]?.id||'';state.v16Studio.phraseDraft=makePhraseDraft(state.v16Studio.selectedPhraseId||null);}
  }

  function allocationOptions(selected=[],query=''){
    const ids=new Set(selected||[]),q=String(query||'').trim();
    let rows=state.dialogues.filter(d=>!q||searchMatches(`${d.id} ${d.title} ${topicLabels[d.topic]||d.topic}`,q));
    if(!q){const picked=state.dialogues.filter(d=>ids.has(d.id)),rest=state.dialogues.filter(d=>!ids.has(d.id)).slice(0,14);rows=[...picked,...rest];}
    return rows.slice(0,30).map(d=>`<label class="v16-dialogue-check"><input type="checkbox" data-v16-dialogue-allocation="${esc(d.id)}" ${ids.has(d.id)?'checked':''}><span><b>${esc(d.id.replace('dialogue-','Dialogue '))}</b>${esc(d.title)}</span></label>`).join('')||'<div class="studio-search-hint">No matching dialogues.</div>';
  }

  function renderVocabList(){
    const rows=searchVocabRecords();
    return `<div class="v16-library-search"><label class="search"><span>⌕</span><input id="v16VocabSearch" type="search" placeholder="Search word, Hindi, example, dialogue or topic" value="${esc(state.v16Studio.vocabQuery)}"></label><select id="v16VocabFilter"><option value="all" ${state.v16Studio.vocabFilter==='all'?'selected':''}>All vocabulary</option><option value="core" ${state.v16Studio.vocabFilter==='core'?'selected':''}>Core Vocabulary</option><option value="general" ${state.v16Studio.vocabFilter==='general'?'selected':''}>General Vocabs</option><option value="dialogue" ${state.v16Studio.vocabFilter==='dialogue'?'selected':''}>Dialogue Vocabs</option><option value="review" ${state.v16Studio.vocabFilter==='review'?'selected':''}>Owner edited</option></select><button class="primary compact" data-action="v16-new-vocab">+ New vocab</button></div><div id="v16VocabSummary" class="v16-result-summary">${rows.length.toLocaleString()} matching records · showing first ${Math.min(rows.length,80)}</div><div id="v16VocabList" class="v16-record-list">${rows.slice(0,80).map(x=>`<button data-action="v16-select-vocab" data-id="${esc(x.id)}" class="${state.v16Studio.selectedVocabId===x.id?'active':''}"><span><b>${esc(x.english)}</b><em>${esc(x.hindi)}</em></span><small>${esc(allocLabel(x,'vocab'))}</small></button>`).join('')||'<div class="empty"><p>No vocabulary matches.</p></div>'}</div>`;
  }

  function renderPhraseList(){
    const rows=searchPhraseRecords();
    return `<div class="v16-library-search"><label class="search"><span>⌕</span><input id="v16PhraseSearch" type="search" placeholder="Search phrase, Hindi, example, dialogue or topic" value="${esc(state.v16Studio.phraseQuery)}"></label><select id="v16PhraseFilter"><option value="all" ${state.v16Studio.phraseFilter==='all'?'selected':''}>All phrases</option><option value="dialogue" ${state.v16Studio.phraseFilter==='dialogue'?'selected':''}>Dialogue phrases</option><option value="review" ${state.v16Studio.phraseFilter==='review'?'selected':''}>Owner edited</option></select><button class="primary compact" data-action="v16-new-phrase">+ New phrase</button></div><div id="v16PhraseSummary" class="v16-result-summary">${rows.length.toLocaleString()} matching records · showing first ${Math.min(rows.length,80)}</div><div id="v16PhraseList" class="v16-record-list">${rows.slice(0,80).map(x=>`<button data-action="v16-select-phrase" data-id="${esc(x.id)}" class="${state.v16Studio.selectedPhraseId===x.id?'active':''}"><span><b>${esc(x.english)}</b><em>${esc(x.hindi)}</em></span><small>${esc(allocLabel(x,'phrase'))}</small></button>`).join('')||'<div class="empty"><p>No phrase matches.</p></div>'}</div>`;
  }

  function uniqueText(values=[]){
    const seen=new Set(),out=[];
    values.flat().forEach(value=>{
      const text=String(value||'').trim();if(!text)return;
      const key=normaliseSearchText(text);if(seen.has(key))return;
      seen.add(key);out.push(text);
    });
    return out;
  }

  function mergeSearchResults(kind,currentId,query=''){
    const rows=kind==='vocab'?[...vocabCatalog().values()]:[...phraseCatalog().values()];
    const current=rows.find(x=>x.id===currentId);const q=String(query||'').trim();
    let filtered=rows.filter(x=>x.id!==currentId&&!x.archived&&!isMergedAway(kind,x.id));
    if(q){
      filtered=filtered.filter(x=>searchMatches(`${x.id} ${x.english||''} ${x.hindi||''} ${(x.acceptedHindi||[]).join(' ')} ${x.topic||''}`,q));
    }else if(current){
      const en=normaliseSearchText(current.english||''),hi=normaliseSearchText(current.hindi||'');
      filtered=filtered.filter(x=>{
        const xen=normaliseSearchText(x.english||''),xhi=normaliseSearchText(x.hindi||'');
        return (en&&xen===en)||(hi&&xhi===hi)||(en&&xen&&(en.includes(xen)||xen.includes(en))&&Math.min(en.length,xen.length)>=5);
      });
    }else filtered=[];
    return filtered.slice(0,12);
  }

  function strongestStatus(a,b){
    const rank={new:0,again:1,learning:2,known:3};
    const aa=a||'new',bb=b||'new';return (rank[bb]??0)>(rank[aa]??0)?bb:aa;
  }
  function earliestIso(...values){
    const valid=values.flat().filter(Boolean).filter(x=>Number.isFinite(Date.parse(x)));if(!valid.length)return '';
    return valid.sort((a,b)=>Date.parse(a)-Date.parse(b))[0];
  }
  function latestIso(...values){
    const valid=values.flat().filter(Boolean).filter(x=>Number.isFinite(Date.parse(x)));if(!valid.length)return '';
    return valid.sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  }
  function mergeRecallRecord(a,b,type,targetId){
    if(!a&&!b)return null;if(!a)return {...clone(b),id:targetId,type,updatedAt:nowIso()};if(!b)return {...clone(a),id:targetId,type,updatedAt:nowIso()};
    const completed=[...new Set([...(a.completedStages||[]),...(b.completedStages||[])])];
    const score=r=>(r?.completedStages?.length||0)*10+({"":5,'4w':4,'2w':3,'1w':2,'1d':1}[r?.stage||'']||0);
    const base=score(a)>=score(b)?a:b;
    return {...clone(base),type,id:targetId,completedStages:completed,anchorAt:earliestIso(a.anchorAt,b.anchorAt)||base.anchorAt||'',lastActionAt:latestIso(a.lastActionAt,b.lastActionAt)||base.lastActionAt||'',dueAt:earliestIso(a.dueAt,b.dueAt)||base.dueAt||'',updatedAt:nowIso()};
  }

  function progressReferences(kind,id){
    const refs=[];
    const statuses=getJSON(storageKeys.vocabStatus,{})||{};if(Object.prototype.hasOwnProperty.call(statuses,id))refs.push('learning status');
    const resume=getJSON(storageKeys.vocabResume,{})||{};if(resume.id===id)refs.push('resume position');
    const recall=getJSON(storageKeys.recallProgress,{})||{};const type=kind==='phrase'?'phrase':'word';if(recall[`${type}:${id}`])refs.push('spaced recall');
    if(kind==='phrase'){
      const stats=getJSON(storageKeys.phraseStats,{})||{};if(stats[id])refs.push('phrase practice');
    }else{
      const all=getJSON(storageKeys.dialogueVocabProgress,{})||{};
      if(Object.values(all).some(row=>(row?.visitedIds||[]).includes(id)||row?.lastId===id))refs.push('dialogue vocabulary progress');
    }
    return refs;
  }

  function migrateProgress(kind,fromId,toId){
    if(!fromId||!toId||fromId===toId)return;
    const statuses=getJSON(storageKeys.vocabStatus,{})||{};
    if(Object.prototype.hasOwnProperty.call(statuses,fromId)||Object.prototype.hasOwnProperty.call(statuses,toId)){
      statuses[toId]=strongestStatus(statuses[toId],statuses[fromId]);delete statuses[fromId];setJSON(storageKeys.vocabStatus,statuses);
    }
    const resume=getJSON(storageKeys.vocabResume,{})||{};if(resume.id===fromId){resume.id=toId;setJSON(storageKeys.vocabResume,resume);}
    const type=kind==='phrase'?'phrase':'word',recall=getJSON(storageKeys.recallProgress,{})||{},fromKey=`${type}:${fromId}`,toKey=`${type}:${toId}`;
    if(recall[fromKey]||recall[toKey]){const merged=mergeRecallRecord(recall[toKey],recall[fromKey],type,toId);if(merged)recall[toKey]=merged;delete recall[fromKey];setJSON(storageKeys.recallProgress,recall);}
    if(kind==='phrase'){
      const stats=getJSON(storageKeys.phraseStats,{})||{},a=stats[toId]||{},b=stats[fromId]||{};
      if(stats[fromId]||stats[toId]){
        stats[toId]={practiceCount:(Number(a.practiceCount)||0)+(Number(b.practiceCount)||0),completed:Boolean(a.completed||b.completed),firstCompletedAt:earliestIso(a.firstCompletedAt,b.firstCompletedAt),lastPractisedAt:latestIso(a.lastPractisedAt,b.lastPractisedAt)};
        delete stats[fromId];setJSON(storageKeys.phraseStats,stats);
      }
    }else{
      const all=getJSON(storageKeys.dialogueVocabProgress,{})||{};let changed=false;
      Object.values(all).forEach(row=>{
        if(!row||typeof row!=='object')return;
        if(Array.isArray(row.visitedIds)&&row.visitedIds.includes(fromId)){row.visitedIds=[...new Set(row.visitedIds.map(x=>x===fromId?toId:x))];changed=true;}
        if(row.lastId===fromId){row.lastId=toId;changed=true;}
        if(changed)row.updatedAt=nowIso();
      });
      if(changed)setJSON(storageKeys.dialogueVocabProgress,all);
    }
    if(Array.isArray(state.vocabPlayer?.queue)&&state.vocabPlayer.queue.includes(fromId)){
      const current=state.vocabPlayer.queue[state.vocabPlayer.index];state.vocabPlayer.queue=[...new Set(state.vocabPlayer.queue.map(x=>x===fromId?toId:x))];
      if(current===fromId)state.vocabPlayer.index=Math.max(0,state.vocabPlayer.queue.indexOf(toId));
    }
  }

  function migrateAllMergeAliases(){
    const vocab=mergedAliases('vocab'),phrases=mergedAliases('phrase');
    Object.keys(vocab).forEach(from=>{const to=resolveMergedId('vocab',from);if(to&&to!==from)migrateProgress('vocab',from,to);});
    Object.keys(phrases).forEach(from=>{const to=resolveMergedId('phrase',from);if(to&&to!==from)migrateProgress('phrase',from,to);});
  }

  function combineRecords(kind,keep,remove){
    const isV=kind==='vocab';const allocations=isV?{
      core:Boolean(keep.allocations?.core||remove.allocations?.core),general:Boolean(keep.allocations?.general||remove.allocations?.general),dialogues:[...new Set([...(keep.allocations?.dialogues||[]),...(remove.allocations?.dialogues||[])])].sort()
    }:{main:(keep.allocations?.main!==false)||(remove.allocations?.main!==false),dialogues:[...new Set([...(keep.allocations?.dialogues||[]),...(remove.allocations?.dialogues||[])])].sort()};
    const secondaryHindi=remove.hindi&&normaliseSearchText(remove.hindi)!==normaliseSearchText(keep.hindi)?[remove.hindi]:[];
    const altExamples=[...(keep.alternateExamples||[]),...(remove.alternateExamples||[])];
    if((remove.exampleEnglish||remove.exampleHindi)&&(remove.exampleEnglish!==keep.exampleEnglish||remove.exampleHindi!==keep.exampleHindi))altExamples.push({english:remove.exampleEnglish||'',hindi:remove.exampleHindi||'',sourceId:remove.id});
    return {...clone(keep),allocations,acceptedHindi:uniqueText([keep.acceptedHindi||[],secondaryHindi,remove.acceptedHindi||[]]),acceptedEnglish:uniqueText([keep.acceptedEnglish||[],remove.english&&normaliseSearchText(remove.english)!==normaliseSearchText(keep.english)?[remove.english]:[],remove.acceptedEnglish||[]]),exampleEnglish:keep.exampleEnglish||remove.exampleEnglish||'',exampleHindi:keep.exampleHindi||remove.exampleHindi||'',alternateExamples:altExamples,notes:uniqueText([keep.notes,remove.notes]).join('\n'),mergedFrom:[...new Set([...(keep.mergedFrom||[]),remove.id,...(remove.mergedFrom||[])])],reviewStatus:'reviewed',archived:false,mergedInto:'',source:'owner-v17',updatedAt:nowIso()};
  }

  function mergeRecords(kind,currentId,candidateId,keepId){
    if(!currentId||!candidateId||currentId===candidateId)return false;
    const isV=kind==='vocab',catalog=isV?vocabCatalog():phraseCatalog();
    const currentDraft=isV?state.v16Studio.vocabDraft:state.v16Studio.phraseDraft;
    const current=currentDraft?.id===currentId?clone(currentDraft):clone(catalog.get(currentId));
    const candidate=clone(catalog.get(candidateId));if(!current||!candidate){showToast('Could not load both records');return false;}
    const resolvedKeep=keepId===candidateId?candidateId:currentId,keep=resolvedKeep===currentId?current:candidate,remove=resolvedKeep===currentId?candidate:current;
    const warning=normaliseSearchText(current.english)!==normaliseSearchText(candidate.english)?' These English terms are different; merge only if one is genuinely a duplicate, not just a synonym or different sense.':'';
    if(!confirm(`Merge “${remove.english}” into “${keep.english}”? Allocations and learner progress will be preserved.${warning}`))return false;
    const local=getLocalOwner(),bucket=isV?local.vocabulary:local.phrases,mergeBucket=isV?local.merges.vocabulary:local.merges.phrases;
    const combined=combineRecords(kind,keep,remove);bucket[keep.id]=combined;
    bucket[remove.id]={...clone(remove),reviewStatus:'reviewed',archived:true,mergedInto:keep.id,source:'owner-v17',updatedAt:nowIso()};
    Object.keys(mergeBucket).forEach(id=>{if(mergeBucket[id]===remove.id)mergeBucket[id]=keep.id;});mergeBucket[remove.id]=keep.id;
    saveLocalOwner(local);migrateProgress(kind,remove.id,keep.id);applyOwnerContent();
    if(isV){state.v16Studio.selectedVocabId=keep.id;state.v16Studio.vocabDraft=makeVocabDraft(keep.id);}else{state.v16Studio.selectedPhraseId=keep.id;state.v16Studio.phraseDraft=makePhraseDraft(keep.id);}
    state.v16Studio.mergePanel=false;state.v16Studio.mergeCandidateId='';state.v16Studio.mergeSearch='';state.v16Studio.dirty=false;
    showToast(`Merged safely into “${keep.english}”. Existing progress was migrated.`);return true;
  }

  function isLocalMergeTarget(kind,id){
    const local=getLocalOwner(),map=kind==='vocab'?local.merges?.vocabulary:local.merges?.phrases;
    return Object.values(map||{}).includes(id);
  }

  function canHardDeleteDraft(kind,record){
    if(!record?.id)return false;const isV=kind==='vocab',local=getLocalOwner(),published=state.v16Published;
    const saved=(isV?local.vocabulary:local.phrases)[record.id];if(!saved||saved.reviewStatus!=='draft')return false;
    if((isV?published.vocabulary:published.phrases)[record.id])return false;
    if(record.mergedInto||isMergedAway(kind,record.id)||isLocalMergeTarget(kind,record.id))return false;
    return progressReferences(kind,record.id).length===0;
  }

  function hardDeleteDraft(kind){
    const isV=kind==='vocab',d=isV?state.v16Studio.vocabDraft:state.v16Studio.phraseDraft;if(!canHardDeleteDraft(kind,d)){showToast('Permanent delete is only available for unused, unpublished drafts');return;}
    if(!confirm(`Permanently delete this unused draft ${isV?'vocabulary item':'phrase'}?`))return;
    const local=getLocalOwner(),bucket=isV?local.vocabulary:local.phrases;delete bucket[d.id];saveLocalOwner(local);applyOwnerContent();
    if(isV){state.v16Studio.selectedVocabId='';state.v16Studio.vocabDraft=null;}else{state.v16Studio.selectedPhraseId='';state.v16Studio.phraseDraft=null;}
    state.v16Studio.dirty=false;render();showToast('Unused draft permanently deleted');
  }

  function renderMergePanel(kind,d){
    const open=state.v16Studio.mergePanel;if(!open)return '';
    const results=mergeSearchResults(kind,d.id,state.v16Studio.mergeSearch),candidateId=state.v16Studio.mergeCandidateId,candidate=(kind==='vocab'?vocabCatalog():phraseCatalog()).get(candidateId);
    return `<section class="v17-merge-panel"><header><div><small>SAFE DUPLICATE CLEANUP</small><h4>Merge this ${kind==='vocab'?'vocabulary record':'phrase'}</h4><p>The record you remove becomes an alias of the record you keep. Allocations, status, recall and other learner progress are migrated instead of deleted.</p></div><button data-action="v17-close-merge" class="secondary compact">Close</button></header><label class="search"><span>⌕</span><input id="v17MergeSearch" placeholder="Search another record to merge…" value="${esc(state.v16Studio.mergeSearch||'')}"></label><div id="v17MergeResults" class="v17-merge-results">${results.map(x=>`<button data-action="v17-choose-merge" data-id="${esc(x.id)}" class="${candidateId===x.id?'active':''}"><span><b>${esc(x.english)}</b><em>${esc(x.hindi)}</em></span><small>${esc(allocLabel(x,kind))}</small></button>`).join('')||'<p>No likely duplicate found. Search by English or Hindi.</p>'}</div><div id="v17MergeCandidateArea">${candidate?`<div class="v17-merge-compare"><article><small>CURRENT RECORD</small><b>${esc(d.english)}</b><span>${esc(d.hindi)}</span><em>${esc(d.id)}</em></article><article><small>SELECTED RECORD</small><b>${esc(candidate.english)}</b><span>${esc(candidate.hindi)}</span><em>${esc(candidate.id)}</em></article></div><div class="v17-merge-actions"><button class="primary" data-action="v17-merge-keep-current" data-id="${esc(candidate.id)}">Keep current as main</button><button class="secondary" data-action="v17-merge-keep-candidate" data-id="${esc(candidate.id)}">Keep selected as main</button></div><small class="v17-merge-note">If the words have different meanings or are useful synonyms rather than duplicates, keep them separate.</small>`:''}</div></section>`;
  }

  function duplicateMatches(record,kind){
    const rows=kind==='vocab'?[...vocabCatalog().values()]:[...phraseCatalog().values()];
    const target=normaliseSearchText(record.english||'');if(!target)return [];
    return rows.filter(x=>x.id!==record.id&&normaliseSearchText(x.english||'')===target).slice(0,8);
  }

  function renderVocabEditor(){
    ensureSelectedVocab();const d=state.v16Studio.vocabDraft,dupes=duplicateMatches(d,'vocab'),canDelete=canHardDeleteDraft('vocab',d);
    const mergedNotice=d.mergedInto?`<div class="v17-merged-notice"><b>This record has been merged.</b> Its old ID remains as a compatibility alias to <code>${esc(d.mergedInto)}</code>, so existing learner progress is not lost.</div>`:'';
    return `<section class="v16-editor"><header><div><small>VOCABULARY RECORD</small><h3>${d.english?esc(d.english):'New vocabulary'}</h3></div>${statusBadge(d.reviewStatus)} </header>${mergedNotice}${dupes.length&&!d.mergedInto?`<div class="v16-duplicate-warning"><b>Possible duplicate found.</b> ${dupes.map(x=>`${esc(x.english)} → ${esc(x.hindi)}`).join(' · ')}. Use Safe Merge only for true duplicates; keep synonyms or different senses separate.</div>`:''}<div class="v16-form-grid"><label>English word / term<input id="v16VocabEnglish" value="${esc(d.english||'')}" ${d.mergedInto?'disabled':''}></label><label>Hindi meaning<input id="v16VocabHindi" value="${esc(d.hindi||'')}" ${d.mergedInto?'disabled':''}></label><label>Topic<select id="v16VocabTopic" ${d.mergedInto?'disabled':''}>${topicSelect(d.topic||'community')}</select></label><label>Stable ID<input value="${esc(d.id)}" disabled></label><label class="wide">Alternate Hindi meanings / synonyms <span>one per line</span><textarea id="v16VocabAlternatives" rows="3" ${d.mergedInto?'disabled':''}>${esc((d.acceptedHindi||[]).join('\n'))}</textarea></label><label class="wide">English example<textarea id="v16VocabExampleEn" rows="2" ${d.mergedInto?'disabled':''}>${esc(d.exampleEnglish||'')}</textarea></label><label class="wide">Hindi example<textarea id="v16VocabExampleHi" rows="2" ${d.mergedInto?'disabled':''}>${esc(d.exampleHindi||'')}</textarea></label><label class="wide">Owner notes<textarea id="v16VocabNotes" rows="2" ${d.mergedInto?'disabled':''}>${esc(d.notes||'')}</textarea></label></div>${d.mergedInto?'':`<section class="v16-allocations"><h4>Allocate this vocabulary</h4><div class="v16-primary-alloc"><label><input id="v16VocabCore" type="checkbox" ${d.allocations?.core?'checked':''}> Core Vocabulary</label><label><input id="v16VocabGeneral" type="checkbox" ${d.allocations?.general?'checked':''}> General Vocabs</label></div><div class="v16-selected-alloc"><b>Dialogue allocations:</b> ${(d.allocations?.dialogues||[]).length?(d.allocations.dialogues||[]).map(id=>`<span>${esc(dialogueName(id))}</span>`).join(''):'<em>None</em>'}</div><label class="search v16-allocation-search"><span>⌕</span><input id="v16VocabDialogueSearch" placeholder="Find Dialogue 23, dentist, health…" value="${esc(state.v16Studio.vocabAllocSearch||'')}"></label><div id="v16VocabDialogueOptions" class="v16-dialogue-options">${allocationOptions(d.allocations?.dialogues||[],state.v16Studio.vocabAllocSearch)}</div></section>${renderMergePanel('vocab',d)}<footer class="v16-editor-actions v17-editor-actions">${button(d.archived?'Restore item':'Archive item','v16-toggle-vocab-archive',d.archived?'secondary':'danger')}${canDelete?button('Delete unused draft','v17-delete-vocab-draft','danger'):''}${button(state.v16Studio.mergePanel?'Hide Merge':'Safe Merge…','v17-toggle-vocab-merge','secondary')}${button('Revert local change','v16-revert-vocab','secondary')}${button('Save Draft (not live)','v16-save-vocab-draft','secondary')}${button('Save & Apply','v16-save-vocab-reviewed','primary')}</footer><small class="v17-save-help">Save & Apply makes the change active on this device. Use the Publish tab when you want the reviewed change committed to GitHub for the deployed app.</small>`}</section>`;
  }

  function renderPhraseEditor(){
    ensureSelectedPhrase();const d=state.v16Studio.phraseDraft,dupes=duplicateMatches(d,'phrase'),canDelete=canHardDeleteDraft('phrase',d);
    const mergedNotice=d.mergedInto?`<div class="v17-merged-notice"><b>This phrase has been merged.</b> Its old ID remains as a compatibility alias to <code>${esc(d.mergedInto)}</code>, preserving existing progress.</div>`:'';
    return `<section class="v16-editor"><header><div><small>PHRASE RECORD</small><h3>${d.english?esc(d.english):'New phrase'}</h3></div>${statusBadge(d.reviewStatus)}</header>${mergedNotice}${dupes.length&&!d.mergedInto?`<div class="v16-duplicate-warning"><b>Possible duplicate found.</b> ${dupes.map(x=>`${esc(x.english)} → ${esc(x.hindi)}`).join(' · ')}. Merge only true duplicates, not useful alternative phrases.</div>`:''}<div class="v16-form-grid"><label>English phrase<input id="v16PhraseEnglish" value="${esc(d.english||'')}" ${d.mergedInto?'disabled':''}></label><label>Hindi meaning<input id="v16PhraseHindi" value="${esc(d.hindi||'')}" ${d.mergedInto?'disabled':''}></label><label>Topic<select id="v16PhraseTopic" ${d.mergedInto?'disabled':''}>${topicSelect(d.topic||'community')}</select></label><label>Stable ID<input value="${esc(d.id)}" disabled></label><label class="wide">Alternate Hindi meanings <span>one per line</span><textarea id="v16PhraseAlternatives" rows="3" ${d.mergedInto?'disabled':''}>${esc((d.acceptedHindi||[]).join('\n'))}</textarea></label><label class="wide">English example<textarea id="v16PhraseExampleEn" rows="2" ${d.mergedInto?'disabled':''}>${esc(d.exampleEnglish||'')}</textarea></label><label class="wide">Hindi example<textarea id="v16PhraseExampleHi" rows="2" ${d.mergedInto?'disabled':''}>${esc(d.exampleHindi||'')}</textarea></label><label class="wide">Owner notes<textarea id="v16PhraseNotes" rows="2" ${d.mergedInto?'disabled':''}>${esc(d.notes||'')}</textarea></label></div>${d.mergedInto?'':`<section class="v16-allocations"><h4>Allocate this phrase</h4><div class="v16-primary-alloc"><label><input id="v16PhraseMain" type="checkbox" ${d.allocations?.main!==false?'checked':''}> Main Phrases library</label></div><div class="v16-selected-alloc"><b>Dialogue allocations:</b> ${(d.allocations?.dialogues||[]).length?(d.allocations.dialogues||[]).map(id=>`<span>${esc(dialogueName(id))}</span>`).join(''):'<em>None</em>'}</div><label class="search v16-allocation-search"><span>⌕</span><input id="v16PhraseDialogueSearch" placeholder="Find Dialogue 67, tenancy, medical…" value="${esc(state.v16Studio.phraseAllocSearch||'')}"></label><div id="v16PhraseDialogueOptions" class="v16-dialogue-options">${allocationOptions(d.allocations?.dialogues||[],state.v16Studio.phraseAllocSearch)}</div></section>${renderMergePanel('phrase',d)}<footer class="v16-editor-actions v17-editor-actions">${button(d.archived?'Restore phrase':'Archive phrase','v16-toggle-phrase-archive',d.archived?'secondary':'danger')}${canDelete?button('Delete unused draft','v17-delete-phrase-draft','danger'):''}${button(state.v16Studio.mergePanel?'Hide Merge':'Safe Merge…','v17-toggle-phrase-merge','secondary')}${button('Revert local change','v16-revert-phrase','secondary')}${button('Save Draft (not live)','v16-save-phrase-draft','secondary')}${button('Save & Apply','v16-save-phrase-reviewed','primary')}</footer><small class="v17-save-help">Save & Apply makes the change active on this device. Use the Publish tab when you want the reviewed change committed to GitHub.</small>`}</section>`;
  }

  function countsForPublish(){
    const local=getLocalOwner(),dialogs=getDialogueOverrides();
    const merges=Object.keys(local.merges?.vocabulary||{}).length+Object.keys(local.merges?.phrases||{}).length;
    return {vocab:Object.keys(local.vocabulary||{}).length,phrases:Object.keys(local.phrases||{}).length,dialogs:Object.keys(dialogs||{}).length,merges,drafts:[...Object.values(local.vocabulary||{}),...Object.values(local.phrases||{})].filter(x=>x.reviewStatus==='draft').length,reviewed:[...Object.values(local.vocabulary||{}),...Object.values(local.phrases||{})].filter(x=>x.reviewStatus==='reviewed').length};
  }

  function publishPayload(){
    const local=getLocalOwner(),published=state.v16Published;
    const vocabulary={...(published.vocabulary||{})},phrases={...(published.phrases||{})};
    Object.entries(local.vocabulary||{}).forEach(([id,r])=>{if(r.reviewStatus==='draft')return;vocabulary[id]={...clone(r),reviewStatus:'published',publishedAt:nowIso()};});
    Object.entries(local.phrases||{}).forEach(([id,r])=>{if(r.reviewStatus==='draft')return;phrases[id]={...clone(r),reviewStatus:'published',publishedAt:nowIso()};});
    const merges={vocabulary:{...(published.merges?.vocabulary||{}),...(local.merges?.vocabulary||{})},phrases:{...(published.merges?.phrases||{}),...(local.merges?.phrases||{})}};
    return {schemaVersion:'1.1',contentVersion:'17.0.0-owner',language:state.selectedLanguage||'hi',updatedAt:nowIso(),vocabulary,phrases,dialogues:clone(getDialogueOverrides()),merges};
  }

  function validatePayload(payload){
    const errors=[],warnings=[];
    const check=(records,label)=>Object.values(records||{}).forEach(r=>{
      if(!r.id)errors.push(`${label}: missing stable ID`);
      if(!String(r.english||'').trim())errors.push(`${label} ${r.id||'?'}: English is empty`);
      if(!String(r.hindi||'').trim())errors.push(`${label} ${r.id||'?'}: Hindi is empty`);
      (r.allocations?.dialogues||[]).forEach(id=>{if(!state.dialogues.some(d=>d.id===id))errors.push(`${label} ${r.id}: dialogue allocation ${id} does not exist`);});
      if(!r.exampleEnglish&&!r.exampleHindi)warnings.push(`${label} ${r.id}: no example yet`);
    });
    check(payload.vocabulary,'Vocabulary');check(payload.phrases,'Phrase');
    const checkMerges=(kind,map,label)=>{const catalog=kind==='vocab'?baseVocabCatalog():basePhraseCatalog();Object.keys(kind==='vocab'?payload.vocabulary||{}:payload.phrases||{}).forEach(id=>catalog.set(id,{}));Object.entries(map||{}).forEach(([from,to])=>{if(!from||!to||from===to)errors.push(`${label} merge ${from||'?'}: invalid target`);if(!catalog.has(to))errors.push(`${label} merge ${from}: target ${to} does not exist`);const seen=new Set([from]);let cur=to;while((map||{})[cur]){if(seen.has(cur)){errors.push(`${label} merge ${from}: alias cycle detected`);break;}seen.add(cur);cur=map[cur];}});};
    checkMerges('vocab',payload.merges?.vocabulary,'Vocabulary');checkMerges('phrase',payload.merges?.phrases,'Phrase');
    Object.entries(payload.dialogues||{}).forEach(([id,d])=>{if(!state.dialogues.some(x=>x.id===id))warnings.push(`Dialogue ${id}: override does not match a loaded dialogue`);if(!d?.segments?.length)errors.push(`Dialogue ${id}: has no segments`);});
    return {errors,warnings};
  }

  function reviewRows(){
    const local=getLocalOwner(),rows=[];
    Object.values(local.vocabulary||{}).forEach(r=>rows.push({type:'Vocabulary',id:r.id,title:r.english,detail:`${r.hindi} · ${allocLabel(r,'vocab')} · ${r.reviewStatus}`}));
    Object.values(local.phrases||{}).forEach(r=>rows.push({type:'Phrase',id:r.id,title:r.english,detail:`${r.hindi} · ${allocLabel(r,'phrase')} · ${r.reviewStatus}`}));
    Object.values(getDialogueOverrides()).forEach(r=>rows.push({type:'Dialogue',id:r.id,title:r.title,detail:`${r.segments?.length||0} segments · owner override`}));
    Object.entries(local.merges?.vocabulary||{}).forEach(([from,to])=>rows.push({type:'Vocab merge',id:from,title:from,detail:`Merged safely into ${to}`}));
    Object.entries(local.merges?.phrases||{}).forEach(([from,to])=>rows.push({type:'Phrase merge',id:from,title:from,detail:`Merged safely into ${to}`}));
    return rows;
  }

  function renderPublish(){
    const c=countsForPublish(),payload=publishPayload(),validation=validatePayload(payload),g=state.v16Github;
    return `<div class="v16-publish"><section class="v16-publish-summary"><div><strong>${c.vocab}</strong><span>vocabulary edits</span></div><div><strong>${c.phrases}</strong><span>phrase edits</span></div><div><strong>${c.dialogs}</strong><span>dialogue edits</span></div><div><strong>${c.merges}</strong><span>safe merges</span></div><div><strong>${c.drafts}</strong><span>drafts not published</span></div></section><div class="${validation.errors.length?'v16-validation bad':'v16-validation good'}"><b>${validation.errors.length?'Publishing blocked':'Validation passed'}</b><span>${validation.errors.length?`${validation.errors.length} error(s) must be fixed.`:`${validation.warnings.length} warning(s); drafts remain local until reviewed.`}</span></div>${validation.errors.length?`<ul class="v16-validation-list">${validation.errors.slice(0,20).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<div class="v16-publish-actions">${button('Export full backup','v16-export-backup','secondary')}${button('Import backup','v16-import-trigger','secondary')}<input id="v16ImportFile" type="file" accept="application/json,.json" hidden>${button(state.v16Studio.publishReview?'Hide changes':'Review changes','v16-toggle-review','secondary')}</div>${state.v16Studio.publishReview?`<div class="v16-change-review">${reviewRows().map(r=>`<article><b>${esc(r.type)}</b><span>${esc(r.title||r.id)}</span><small>${esc(r.detail)}</small></article>`).join('')||'<p>No local changes yet.</p>'}</div>`:''}<section class="v16-github"><header><div><small>OPTIONAL OWNER PUBLISHING</small><h3>Publish content update to GitHub</h3><p>Only the small backward-compatible <code>content/owner-content-v16.json</code> layer is updated; V17 adds merge aliases inside it so existing deployments and owner edits remain compatible. Your token is kept in memory for this session only and is never saved to localStorage or exported.</p></div><span>GitHub REST</span></header><div class="v16-github-grid"><label>Repository owner<input id="v16GithubOwner" placeholder="your-github-name" value="${esc(g.owner||'')}"></label><label>Repository<input id="v16GithubRepo" placeholder="APS-NAATI-CCL" value="${esc(g.repo||'')}"></label><label>Branch<input id="v16GithubBranch" value="${esc(g.branch||'main')}"></label><label>Content path<input id="v16GithubPath" value="content/owner-content-v16.json" disabled></label><label class="wide">Commit message<input id="v16GithubMessage" value="${esc(g.message||`APS content update ${new Date().toISOString().slice(0,10)}`)}"></label><label class="wide">Fine-grained GitHub token <span>Contents: write for this repository only</span><input id="v16GithubToken" type="password" autocomplete="off" placeholder="github_pat_…" value="${esc(g.token||'')}"></label></div>${g.status?`<div class="v16-github-status">${esc(g.status)}</div>`:''}<div class="v16-github-actions">${button('Test GitHub connection','v16-github-test','secondary',g.busy?'disabled':'')}${button(g.busy?'Publishing…':'Publish to GitHub','v16-github-publish','primary',`${g.busy||validation.errors.length?'disabled':''}`)}</div><small class="v16-security-note">For a future multi-admin production system, move GitHub authorization behind a dedicated backend/GitHub App. V17 intentionally does not embed credentials in the public app.</small></section></div>`;
  }

  function renderStudio(){
    const tab=state.v16Studio.tab||'dialogues';
    const tabs=[['dialogues','Dialogues'],['vocabulary','Vocabulary'],['phrases','Phrases'],['publish','Publish']];
    let body='';
    if(tab==='dialogues')body=`<div class="v16-dialogue-panel"><div class="v16-dialogue-hero"><small>DIALOGUE CONTENT</small><h3>Edit dialogue lines, sample answers and missing segments</h3><p>The proven V15 dialogue editor is preserved. It includes dialogue search, segment add/delete/reorder, sample alternatives, meaning points and critical details.</p>${button('Open Dialogue Editor →','v16-open-dialogue-editor','primary')}</div><div class="v16-dialogue-links"><div><b>${Object.keys(getDialogueOverrides()).length}</b><span>dialogue overrides saved on this device</span></div><p>Dialogue edits are included automatically in V17 Export Backup and GitHub Publish.</p></div></div>`;
    else if(tab==='vocabulary'){ensureSelectedVocab();body=`<div class="v16-library-layout"><aside>${renderVocabList()}</aside>${renderVocabEditor()}</div>`;}
    else if(tab==='phrases'){ensureSelectedPhrase();body=`<div class="v16-library-layout"><aside>${renderPhraseList()}</aside>${renderPhraseEditor()}</div>`;}
    else body=renderPublish();
    return `<div class="modal-backdrop content-studio-backdrop"><div class="modal content-studio-modal v16-studio-modal"><button class="modal-close" data-action="v16-close-studio">×</button><div class="studio-heading"><div><small>OWNER / EDITOR TOOL · V17</small><h2>Content Library Studio</h2><p>Manage dialogues, vocabulary, phrases, examples, allocations, safe duplicate merges and publishing without changing the learner account system or resetting progress.</p></div><span>Stable IDs + safe merge aliases</span></div><nav class="v16-studio-tabs">${tabs.map(([id,label])=>`<button data-action="v16-studio-tab" data-id="${id}" class="${tab===id?'active':''}">${label}</button>`).join('')}</nav>${body}</div></div>`;
  }

  function exampleSettingToggles(){
    return `<div class="v16-example-settings"><label class="toggle"><input id="v16ShowExamples" type="checkbox" ${state.vocabSettings.showExamples!==false?'checked':''}><span>Show examples when available</span></label><label class="toggle"><input id="v16SpeakExamples" type="checkbox" ${state.vocabSettings.speakExamples!==false?'checked':''}><span>Speak examples when available</span></label><small>Display and speech are independent: examples can be hidden while still spoken, or visible without being spoken.</small></div>`;
  }

  const v15RenderModal=renderModal;
  renderModal=function v16RenderModal(){
    if(state.modal?.type==='content-library-studio')return renderStudio();
    let html=v15RenderModal();
    if(!html)return html;
    if(['vocab-settings','app-settings'].includes(state.modal?.type)){
      html=html.replace(/<label class="toggle"><input id="vocabExamples"[^>]*><span>Speak examples when available<\/span><\/label>/g,exampleSettingToggles());
    }
    if(state.modal?.type==='app-settings'){
      const start=html.indexOf('<div class="voice-settings-section content-studio-settings">');
      const end=html.indexOf('<div class="settings-actions">',start);
      const insert=`<div class="voice-settings-section content-studio-settings v16-settings-card"><h3>Content reliability & editing</h3><p>Manage dialogues, vocabulary, phrases, examples, dialogue allocations and GitHub publishing from one owner tool.</p><div class="content-studio-setting-actions">${button('Open Content Library Studio','open-content-library-studio','secondary')}${button('Export owner content backup','v16-export-backup','secondary')}</div><small>V17 keeps stable content IDs so spelling/meaning corrections do not reset existing learner progress.</small></div>`;
      if(start>=0&&end>start)html=html.slice(0,start)+insert+html.slice(end);
      else html=html.replace('<div class="settings-actions">',`${insert}<div class="settings-actions">`);
    }
    return html;
  };

  function captureVocabForm(){
    const d=state.v16Studio.vocabDraft;if(!d)return;
    const val=id=>document.querySelector(id)?.value;
    if(val('#v16VocabEnglish')!==undefined)d.english=val('#v16VocabEnglish').trim();
    if(val('#v16VocabHindi')!==undefined)d.hindi=val('#v16VocabHindi').trim();
    if(val('#v16VocabAlternatives')!==undefined)d.acceptedHindi=val('#v16VocabAlternatives').split('\n').map(x=>x.trim()).filter(Boolean);
    if(val('#v16VocabExampleEn')!==undefined)d.exampleEnglish=val('#v16VocabExampleEn').trim();
    if(val('#v16VocabExampleHi')!==undefined)d.exampleHindi=val('#v16VocabExampleHi').trim();
    if(val('#v16VocabNotes')!==undefined)d.notes=val('#v16VocabNotes').trim();
    if(val('#v16VocabTopic')!==undefined)d.topic=val('#v16VocabTopic');
    const core=document.querySelector('#v16VocabCore'),gen=document.querySelector('#v16VocabGeneral');
    if(core)d.allocations.core=core.checked;if(gen)d.allocations.general=gen.checked;
  }
  function capturePhraseForm(){
    const d=state.v16Studio.phraseDraft;if(!d)return;
    const val=id=>document.querySelector(id)?.value;
    if(val('#v16PhraseEnglish')!==undefined)d.english=val('#v16PhraseEnglish').trim();
    if(val('#v16PhraseHindi')!==undefined)d.hindi=val('#v16PhraseHindi').trim();
    if(val('#v16PhraseAlternatives')!==undefined)d.acceptedHindi=val('#v16PhraseAlternatives').split('\n').map(x=>x.trim()).filter(Boolean);
    if(val('#v16PhraseExampleEn')!==undefined)d.exampleEnglish=val('#v16PhraseExampleEn').trim();
    if(val('#v16PhraseExampleHi')!==undefined)d.exampleHindi=val('#v16PhraseExampleHi').trim();
    if(val('#v16PhraseNotes')!==undefined)d.notes=val('#v16PhraseNotes').trim();
    if(val('#v16PhraseTopic')!==undefined)d.topic=val('#v16PhraseTopic');
    const main=document.querySelector('#v16PhraseMain');if(main)d.allocations.main=main.checked;
  }

  function saveRecord(kind,status){
    const isV=kind==='vocab';if(isV)captureVocabForm();else capturePhraseForm();
    const d=isV?state.v16Studio.vocabDraft:state.v16Studio.phraseDraft;
    if(!d?.english?.trim()||!d?.hindi?.trim()){showToast('English and Hindi are both required');return false;}
    if(!isV&&d.allocations.main===false&&!d.allocations.dialogues?.length){if(!confirm('This phrase is not allocated anywhere. Save it anyway?'))return false;}
    if(isV&&!d.allocations.core&&!d.allocations.general&&!d.allocations.dialogues?.length){if(!confirm('This vocabulary item is not allocated anywhere. Save it anyway?'))return false;}
    const dupes=duplicateMatches(d,isV?'vocab':'phrase');
    if(dupes.length&&d.reviewStatus==='draft'&&status==='reviewed'&&!confirm(`A similar ${isV?'vocabulary term':'phrase'} already exists. Mark this as a separate reviewed sense anyway?`))return false;
    d.reviewStatus=status;d.updatedAt=nowIso();d.source='owner-v17';
    const local=getLocalOwner();(isV?local.vocabulary:local.phrases)[d.id]=clone(d);saveLocalOwner(local);applyOwnerContent();
    if(isV){state.v16Studio.selectedVocabId=d.id;state.v16Studio.vocabDraft=makeVocabDraft(d.id);}else{state.v16Studio.selectedPhraseId=d.id;state.v16Studio.phraseDraft=makePhraseDraft(d.id);}
    state.v16Studio.dirty=false;showToast(status==='reviewed'?'Saved & applied on this device. Publish from the Publish tab when ready.':'Draft saved locally; it is not live yet.');return true;
  }

  function revertRecord(kind){
    const isV=kind==='vocab',d=isV?state.v16Studio.vocabDraft:state.v16Studio.phraseDraft;if(!d)return;
    const local=getLocalOwner(),bucket=isV?local.vocabulary:local.phrases;if(!bucket[d.id]){showToast('No local change exists for this item');return;}
    if(isLocalMergeTarget(isV?'vocab':'phrase',d.id)){showToast('This item is the main record for a safe merge. Edit it directly instead of reverting the merge target.');return;}
    if(!confirm('Remove the local edit and return to the published/packaged version?'))return;
    delete bucket[d.id];saveLocalOwner(local);applyOwnerContent();
    if(isV)state.v16Studio.vocabDraft=makeVocabDraft(d.id);else state.v16Studio.phraseDraft=makePhraseDraft(d.id);render();showToast('Local change reverted');
  }

  function toggleArchive(kind){
    const isV=kind==='vocab';if(isV)captureVocabForm();else capturePhraseForm();const d=isV?state.v16Studio.vocabDraft:state.v16Studio.phraseDraft;if(!d)return;
    const next=!d.archived;if(next&&!confirm(`Archive this ${isV?'vocabulary item':'phrase'}? Existing learner progress remains stored under its stable ID.`))return;
    d.archived=next;d.reviewStatus='reviewed';d.updatedAt=nowIso();const local=getLocalOwner();(isV?local.vocabulary:local.phrases)[d.id]=clone(d);saveLocalOwner(local);applyOwnerContent();state.v16Studio.dirty=false;render();showToast(next?'Archived locally':'Restored locally');
  }

  function exportBackup(){
    const payload={schemaVersion:'aps-content-library-backup-v17',exportedAt:nowIso(),language:state.selectedLanguage||'hi',localOwnerContent:getLocalOwner(),dialogueOverrides:getDialogueOverrides(),githubConfig:{owner:state.v16Github.owner||'',repo:state.v16Github.repo||'',branch:state.v16Github.branch||'main',path:state.v16Github.path||'content/owner-content-v16.json'}};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`APS_NAATI_Content_Backup_V17_${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Owner content backup exported');
  }

  async function importBackup(file){
    const data=JSON.parse(await file.text());if(!['aps-content-library-backup-v16','aps-content-library-backup-v17'].includes(data.schemaVersion))throw new Error('This is not a compatible V16/V17 Content Library backup.');
    if(!confirm('Import this V16/V17 backup and replace local owner edits on this device?'))return;
    saveLocalOwner(safeOwner(data.localOwnerContent||emptyOwner()));setJSON(v15DialogueKey(),data.dialogueOverrides||{});
    if(data.githubConfig){state.v16Github={...state.v16Github,...data.githubConfig,token:''};setJSON(GITHUB_CONFIG_KEY,data.githubConfig);}
    applyOwnerContent();state.v16Studio.vocabDraft=null;state.v16Studio.phraseDraft=null;render();showToast('V17 owner content backup restored');
  }

  function captureGithubForm(){
    const v=id=>document.querySelector(id)?.value?.trim();
    state.v16Github.owner=(v('#v16GithubOwner') ?? state.v16Github.owner ?? '');
    state.v16Github.repo=(v('#v16GithubRepo') ?? state.v16Github.repo ?? '');
    state.v16Github.branch=(v('#v16GithubBranch') ?? state.v16Github.branch ?? 'main');
    state.v16Github.path='content/owner-content-v16.json';
    state.v16Github.message=(v('#v16GithubMessage') ?? state.v16Github.message ?? `APS content update ${new Date().toISOString().slice(0,10)}`);
    state.v16Github.token=document.querySelector('#v16GithubToken')?.value||state.v16Github.token||'';
    setJSON(GITHUB_CONFIG_KEY,{owner:state.v16Github.owner,repo:state.v16Github.repo,branch:state.v16Github.branch,path:state.v16Github.path,message:state.v16Github.message});
  }
  function githubHeaders(){return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${state.v16Github.token}`,'X-GitHub-Api-Version':API_VERSION};}
  function githubUrl(){const g=state.v16Github;return `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${g.path.split('/').map(encodeURIComponent).join('/')}`;}
  function utf8Base64(text){const bytes=new TextEncoder().encode(text);let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary);}

  async function testGithub(){
    captureGithubForm();const g=state.v16Github;if(!g.owner||!g.repo||!g.token){showToast('Enter repository owner, repository and token first');return;}
    g.busy=true;g.status='Testing connection…';render();
    try{const r=await fetch(`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}`,{headers:githubHeaders()});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.message||`GitHub HTTP ${r.status}`);}const repo=await r.json();g.status=`Connected to ${repo.full_name}. Token is available for this session.`;}
    catch(error){g.status=`Connection failed: ${error.message}`;}
    finally{g.busy=false;render();}
  }

  async function publishGithub(){
    captureGithubForm();const g=state.v16Github,payload=publishPayload(),validation=validatePayload(payload);
    if(validation.errors.length){showToast('Fix validation errors before publishing');return;}
    if(!g.owner||!g.repo||!g.branch||!g.path||!g.message||!g.token){showToast('Complete all GitHub publishing fields');return;}
    if(!confirm(`Publish reviewed content to ${g.owner}/${g.repo} on branch ${g.branch}? Draft vocabulary/phrases will stay local.`))return;
    g.busy=true;g.status='Checking current GitHub content…';render();
    try{
      let sha='';const getUrl=`${githubUrl()}?ref=${encodeURIComponent(g.branch)}`;const existing=await fetch(getUrl,{headers:githubHeaders()});
      if(existing.ok){sha=(await existing.json()).sha||'';}else if(existing.status!==404){const e=await existing.json().catch(()=>({}));throw new Error(e.message||`GitHub read failed (${existing.status})`);}
      g.status='Publishing content update…';render();
      const body={message:g.message,content:utf8Base64(JSON.stringify(payload,null,2)),branch:g.branch};if(sha)body.sha=sha;
      const put=await fetch(githubUrl(),{method:'PUT',headers:{...githubHeaders(),'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await put.json().catch(()=>({}));if(!put.ok)throw new Error(result.message||`GitHub publish failed (${put.status})`);
      state.v16Published=safeOwner(payload);g.lastCommit=result.commit?.sha||'';g.status=`Published successfully${g.lastCommit?` · commit ${g.lastCommit.slice(0,7)}`:''}. GitHub Pages may take a short time to refresh.`;
      const local=getLocalOwner();Object.values(local.vocabulary||{}).forEach(r=>{if(r.reviewStatus==='reviewed'){r.reviewStatus='published';r.publishedAt=nowIso();}});Object.values(local.phrases||{}).forEach(r=>{if(r.reviewStatus==='reviewed'){r.reviewStatus='published';r.publishedAt=nowIso();}});saveLocalOwner(local);applyOwnerContent();
    }catch(error){g.status=`Publish failed: ${error.message}`;}
    finally{g.busy=false;render();}
  }

  // Capture phase lets V17 return from the preserved V15 dialogue editor into the V17 studio.
  app.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
    if(a==='close-modal'&&state.modal?.type==='content-studio'&&state.v16ReturnToStudio){event.preventDefault();event.stopImmediatePropagation();state.v16ReturnToStudio=false;state.modal={type:'content-library-studio'};state.v16Studio.tab='dialogues';render();}
    else if(a==='toggle-recall-reveal'&&(state.vocabSettings.hideEnglish||state.vocabSettings.hideHindi||state.vocabSettings.showExamples===false)){event.preventDefault();event.stopImmediatePropagation();state.vocabPlayer.revealCurrent=!state.vocabPlayer.revealCurrent;render();}
  },true);

  app.addEventListener('click',async event=>{
    const el=event.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
    if(a==='open-content-library-studio'){event.preventDefault();state.modal={type:'content-library-studio'};render();}
    else if(a==='v16-close-studio'){event.preventDefault();state.v16Github.token='';state.modal=null;render();}
    else if(a==='v16-studio-tab'){event.preventDefault();if(state.v16Studio.tab==='vocabulary')captureVocabForm();if(state.v16Studio.tab==='phrases')capturePhraseForm();state.v16Studio.tab=el.dataset.id;state.v16Studio.mergePanel=false;state.v16Studio.mergeCandidateId='';state.v16Studio.mergeSearch='';render();}
    else if(a==='v16-open-dialogue-editor'){event.preventDefault();state.v16ReturnToStudio=true;state.modal={type:'content-studio'};render();}
    else if(a==='v16-new-vocab'){event.preventDefault();captureVocabForm();state.v16Studio.selectedVocabId='';state.v16Studio.vocabDraft=makeVocabDraft();state.v16Studio.mergePanel=false;state.v16Studio.mergeCandidateId='';state.v16Studio.mergeSearch='';render();}
    else if(a==='v16-select-vocab'){event.preventDefault();captureVocabForm();state.v16Studio.selectedVocabId=el.dataset.id;state.v16Studio.vocabDraft=makeVocabDraft(el.dataset.id);state.v16Studio.mergePanel=false;state.v16Studio.mergeCandidateId='';state.v16Studio.mergeSearch='';render();}
    else if(a==='v16-save-vocab-draft'){event.preventDefault();if(saveRecord('vocab','draft'))render();}
    else if(a==='v16-save-vocab-reviewed'){event.preventDefault();if(saveRecord('vocab','reviewed'))render();}
    else if(a==='v16-revert-vocab'){event.preventDefault();revertRecord('vocab');}
    else if(a==='v16-toggle-vocab-archive'){event.preventDefault();toggleArchive('vocab');}
    else if(a==='v16-new-phrase'){event.preventDefault();capturePhraseForm();state.v16Studio.selectedPhraseId='';state.v16Studio.phraseDraft=makePhraseDraft();state.v16Studio.mergePanel=false;state.v16Studio.mergeCandidateId='';state.v16Studio.mergeSearch='';render();}
    else if(a==='v16-select-phrase'){event.preventDefault();capturePhraseForm();state.v16Studio.selectedPhraseId=el.dataset.id;state.v16Studio.phraseDraft=makePhraseDraft(el.dataset.id);state.v16Studio.mergePanel=false;state.v16Studio.mergeCandidateId='';state.v16Studio.mergeSearch='';render();}
    else if(a==='v16-save-phrase-draft'){event.preventDefault();if(saveRecord('phrase','draft'))render();}
    else if(a==='v16-save-phrase-reviewed'){event.preventDefault();if(saveRecord('phrase','reviewed'))render();}
    else if(a==='v16-revert-phrase'){event.preventDefault();revertRecord('phrase');}
    else if(a==='v16-toggle-phrase-archive'){event.preventDefault();toggleArchive('phrase');}
    else if(a==='v17-toggle-vocab-merge'){event.preventDefault();captureVocabForm();state.v16Studio.mergePanel=!state.v16Studio.mergePanel;state.v16Studio.mergeCandidateId='';state.v16Studio.mergeSearch='';render();}
    else if(a==='v17-toggle-phrase-merge'){event.preventDefault();capturePhraseForm();state.v16Studio.mergePanel=!state.v16Studio.mergePanel;state.v16Studio.mergeCandidateId='';state.v16Studio.mergeSearch='';render();}
    else if(a==='v17-close-merge'){event.preventDefault();state.v16Studio.mergePanel=false;state.v16Studio.mergeCandidateId='';state.v16Studio.mergeSearch='';render();}
    else if(a==='v17-choose-merge'){event.preventDefault();if(state.v16Studio.tab==='vocabulary')captureVocabForm();else capturePhraseForm();state.v16Studio.mergeCandidateId=el.dataset.id;render();}
    else if(a==='v17-merge-keep-current'){event.preventDefault();const kind=state.v16Studio.tab==='vocabulary'?'vocab':'phrase';if(kind==='vocab')captureVocabForm();else capturePhraseForm();const current=kind==='vocab'?state.v16Studio.vocabDraft?.id:state.v16Studio.phraseDraft?.id;if(mergeRecords(kind,current,el.dataset.id,current))render();}
    else if(a==='v17-merge-keep-candidate'){event.preventDefault();const kind=state.v16Studio.tab==='vocabulary'?'vocab':'phrase';if(kind==='vocab')captureVocabForm();else capturePhraseForm();const current=kind==='vocab'?state.v16Studio.vocabDraft?.id:state.v16Studio.phraseDraft?.id;if(mergeRecords(kind,current,el.dataset.id,el.dataset.id))render();}
    else if(a==='v17-delete-vocab-draft'){event.preventDefault();hardDeleteDraft('vocab');}
    else if(a==='v17-delete-phrase-draft'){event.preventDefault();hardDeleteDraft('phrase');}
    else if(a==='v16-toggle-review'){event.preventDefault();captureGithubForm();state.v16Studio.publishReview=!state.v16Studio.publishReview;render();}
    else if(a==='v16-export-backup'){event.preventDefault();exportBackup();}
    else if(a==='v16-import-trigger'){event.preventDefault();document.querySelector('#v16ImportFile')?.click();}
    else if(a==='v16-github-test'){event.preventDefault();await testGithub();}
    else if(a==='v16-github-publish'){event.preventDefault();await publishGithub();}
    else if(a==='toggle-hide-example'){event.preventDefault();state.vocabSettings.showExamples=state.vocabSettings.showExamples===false;state.vocabPlayer.revealCurrent=false;saveVocabSettings();render();}
  });

  app.addEventListener('input',event=>{
    const t=event.target;
    if(t.id==='v16VocabSearch'){state.v16Studio.vocabQuery=t.value;const rows=searchVocabRecords(),list=document.querySelector('#v16VocabList'),summary=document.querySelector('#v16VocabSummary');if(summary)summary.textContent=`${rows.length.toLocaleString()} matching records · showing first ${Math.min(rows.length,80)}`;if(list)list.innerHTML=rows.slice(0,80).map(x=>`<button data-action="v16-select-vocab" data-id="${esc(x.id)}" class="${state.v16Studio.selectedVocabId===x.id?'active':''}"><span><b>${esc(x.english)}</b><em>${esc(x.hindi)}</em></span><small>${esc(allocLabel(x,'vocab'))}</small></button>`).join('')||'<div class="empty"><p>No vocabulary matches.</p></div>';}
    else if(t.id==='v16PhraseSearch'){state.v16Studio.phraseQuery=t.value;const rows=searchPhraseRecords(),list=document.querySelector('#v16PhraseList'),summary=document.querySelector('#v16PhraseSummary');if(summary)summary.textContent=`${rows.length.toLocaleString()} matching records · showing first ${Math.min(rows.length,80)}`;if(list)list.innerHTML=rows.slice(0,80).map(x=>`<button data-action="v16-select-phrase" data-id="${esc(x.id)}" class="${state.v16Studio.selectedPhraseId===x.id?'active':''}"><span><b>${esc(x.english)}</b><em>${esc(x.hindi)}</em></span><small>${esc(allocLabel(x,'phrase'))}</small></button>`).join('')||'<div class="empty"><p>No phrase matches.</p></div>';}
    else if(t.id==='v16VocabDialogueSearch'){captureVocabForm();state.v16Studio.vocabAllocSearch=t.value;const box=document.querySelector('#v16VocabDialogueOptions');if(box)box.innerHTML=allocationOptions(state.v16Studio.vocabDraft.allocations?.dialogues||[],t.value);}
    else if(t.id==='v16PhraseDialogueSearch'){capturePhraseForm();state.v16Studio.phraseAllocSearch=t.value;const box=document.querySelector('#v16PhraseDialogueOptions');if(box)box.innerHTML=allocationOptions(state.v16Studio.phraseDraft.allocations?.dialogues||[],t.value);}
    else if(t.id==='v17MergeSearch'){
      if(state.v16Studio.tab==='vocabulary')captureVocabForm();else capturePhraseForm();
      state.v16Studio.mergeSearch=t.value;state.v16Studio.mergeCandidateId='';
      const kind=state.v16Studio.tab==='vocabulary'?'vocab':'phrase',d=kind==='vocab'?state.v16Studio.vocabDraft:state.v16Studio.phraseDraft;
      const rows=mergeSearchResults(kind,d?.id,t.value),box=document.querySelector('#v17MergeResults'),area=document.querySelector('#v17MergeCandidateArea');
      if(box)box.innerHTML=rows.map(x=>`<button data-action="v17-choose-merge" data-id="${esc(x.id)}"><span><b>${esc(x.english)}</b><em>${esc(x.hindi)}</em></span><small>${esc(allocLabel(x,kind))}</small></button>`).join('')||'<p>No likely duplicate found. Search by English or Hindi.</p>';
      if(area)area.innerHTML='';
    }
    else if(/^v16(Vocab|Phrase)(English|Hindi|Alternatives|ExampleEn|ExampleHi|Notes)$/.test(t.id)){state.v16Studio.dirty=true;}
  });

  app.addEventListener('change',async event=>{
    const t=event.target;
    if(t.id==='v16VocabFilter'){captureVocabForm();state.v16Studio.vocabFilter=t.value;render();}
    else if(t.id==='v16PhraseFilter'){capturePhraseForm();state.v16Studio.phraseFilter=t.value;render();}
    else if(t.dataset.v16DialogueAllocation){
      const d=state.v16Studio.tab==='vocabulary'?state.v16Studio.vocabDraft:state.v16Studio.phraseDraft;if(!d)return;const set=new Set(d.allocations?.dialogues||[]);if(t.checked)set.add(t.dataset.v16DialogueAllocation);else set.delete(t.dataset.v16DialogueAllocation);d.allocations.dialogues=[...set].sort();state.v16Studio.dirty=true;
      const summary=t.closest('.v16-allocations')?.querySelector('.v16-selected-alloc');if(summary)summary.innerHTML=`<b>Dialogue allocations:</b> ${d.allocations.dialogues.length?d.allocations.dialogues.map(id=>`<span>${esc(dialogueName(id))}</span>`).join(''):'<em>None</em>'}`;
    }
    else if(['v16VocabCore','v16VocabGeneral','v16PhraseMain','v16VocabTopic','v16PhraseTopic'].includes(t.id)){state.v16Studio.dirty=true;if(state.v16Studio.tab==='vocabulary')captureVocabForm();else capturePhraseForm();}
    else if(t.id==='v16ShowExamples'){state.vocabSettings.showExamples=t.checked;state.vocabPlayer.revealCurrent=false;saveVocabSettings();if(state.overlay==='vocab-player')render();}
    else if(t.id==='v16SpeakExamples'){state.vocabSettings.speakExamples=t.checked;state.vocabSettings.examples=t.checked;saveVocabSettings();}
    else if(t.id==='v16ImportFile'&&t.files?.[0]){try{await importBackup(t.files[0]);}catch(error){showToast(error.message||'Could not import V17 backup');}t.value='';}
    else if(['v16GithubOwner','v16GithubRepo','v16GithubBranch','v16GithubPath','v16GithubMessage'].includes(t.id)){captureGithubForm();}
  });

  async function initialise(){
    if(!state.ready||!state.selectedLanguage)return false;
    if(state.selectedLanguage==='hi'&&(!(state.dialogueVocabMeta?.itemCount>0)||!(state.generalVocab?.length>0)))return false;
    if(!state.v16Base.captured){captureBase();await loadPublishedOwner();applyOwnerContent();initialiseExampleSettings();render();console.info(`${VERSION} loaded: safe merge aliases, unified owner content library, GitHub publishing, and independent example recall controls`);}
    return true;
  }
  const timer=setInterval(async()=>{if(await initialise())clearInterval(timer);},80);
  setTimeout(async()=>{if(!state.v16Base.captured)await initialise();},1800);
})();
