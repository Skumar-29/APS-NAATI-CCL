'use strict';

// V21.3 — Student-reported Recently Appeared topics.
// One signed-in user can maintain one current report per dialogue. Aggregate counts
// are fetched from protected Firebase Functions; no student identity is exposed.

const RECENT_DIALOGUE_ENDPOINTS=Object.freeze({
  report:'https://australia-southeast1-aps-naati-ccl-practice.cloudfunctions.net/reportRecentDialogue',
  stats:'https://australia-southeast1-aps-naati-ccl-practice.cloudfunctions.net/getRecentDialogueStats'
});
const RECENT_MOCK_PAIR=Object.freeze(['original-086','original-087']);

state.practice.library=state.practice.library||'all';
state.recentDialogues=state.recentDialogues||{
  preset:'30d',month:recentLocalDateKey(new Date()).slice(0,7),from:'',to:'',
  stats:{},myReports:{},loading:false,error:'',loadedKey:'',editingId:'',editingDate:'',savingId:''
};

function recentLocalDateKey(value=new Date()){
  const d=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(d.getTime()))return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function recentShiftDate(days){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return recentLocalDateKey(d);}
function recentMonday(){const d=new Date();d.setHours(12,0,0,0);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return recentLocalDateKey(d);}
function recentMonthBounds(month){
  const m=/^(\d{4})-(\d{2})$/.exec(String(month||''));if(!m)return ['', ''];
  const y=Number(m[1]),mo=Number(m[2]);if(mo<1||mo>12)return ['', ''];
  const first=new Date(y,mo-1,1,12),last=new Date(y,mo,0,12);return [recentLocalDateKey(first),recentLocalDateKey(last)];
}
function recentRange(){
  const r=state.recentDialogues,p=r.preset||'30d',today=recentShiftDate(0);
  if(p==='week')return [recentMonday(),today];
  if(p==='30d')return [recentShiftDate(-29),today];
  if(p==='month')return recentMonthBounds(r.month||today.slice(0,7));
  if(p==='custom')return [r.from||today,r.to||today];
  return [recentShiftDate(-29),today];
}
function recentRangeKey(){const [from,to]=recentRange();return `${from}|${to}`;}
function recentDateInRange(date){const [from,to]=recentRange(),d=String(date||'');return Boolean(d&&(!from||d>=from)&&(!to||d<=to));}
function recentSourceCount(dialogue){return dialogue?.recentSourceReported&&recentDateInRange(dialogue.recentReportedOn)?1:0;}
function recentStudentStat(dialogueId){return state.recentDialogues.stats?.[dialogueId]||{count:0,lastReportedOn:''};}
function recentTotalCount(dialogue){return Number(recentStudentStat(dialogue.id).count||0)+recentSourceCount(dialogue);}
function recentLastDate(dialogue){const dates=[recentStudentStat(dialogue.id).lastReportedOn,dialogue?.recentSourceReported?dialogue.recentReportedOn:''].filter(Boolean);return dates.sort().at(-1)||'';}
function recentMyReport(dialogueId){return state.recentDialogues.myReports?.[dialogueId]||null;}
function recentContentType(dialogue){return String(dialogue?.id||'').startsWith('original-')?'original':'verified';}
function recentIsVisible(dialogue){return recentTotalCount(dialogue)>0;}
function recentPrettyDate(value){if(!value)return '';const d=new Date(`${value}T12:00:00`);return Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):value;}
function recentCurrentUser(){try{return window.firebase?.auth?.()?.currentUser||null}catch{return null}}
async function recentIdToken(){
  try{const u=recentCurrentUser();if(u?.getIdToken)return await u.getIdToken();}catch{}
  try{return await getFirebaseIdToken()}catch{}
  return '';
}
async function recentJson(endpoint,body){
  const token=await recentIdToken();if(!token)throw new Error('Sign in is required to report or view student-reported recent topics.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body||{}),signal:controller.signal});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.message||data?.error||`Request failed (${res.status})`);return data;
  }finally{clearTimeout(timer)}
}
async function loadRecentDialogueStats({force=false}={}){
  const r=state.recentDialogues,[from,to]=recentRange(),key=`${from}|${to}`;
  if(r.loading||(!force&&r.loadedKey===key))return;
  if(!navigator.onLine){r.error='Recent student reports are unavailable offline.';return;}
  r.loading=true;r.error='';
  try{
    const data=await recentJson(RECENT_DIALOGUE_ENDPOINTS.stats,{from,to}),map={};
    (data.stats||[]).forEach(x=>{if(x?.dialogueId)map[x.dialogueId]=x;});
    r.stats=map;r.myReports=data.myReports||{};r.loadedKey=key;
  }catch(e){r.error=e?.message||'Recent reports are temporarily unavailable.';r.loadedKey=key;}
  finally{r.loading=false;if(state.tab==='practice')render();}
}
async function saveRecentDialogueReport(dialogueId,reported,reportedOn){
  const r=state.recentDialogues;if(r.savingId)return;
  r.savingId=dialogueId;r.error='';render();
  try{
    await recentJson(RECENT_DIALOGUE_ENDPOINTS.report,{dialogueId,reported,reportedOn});
    r.editingId='';r.editingDate='';r.loadedKey='';
    await loadRecentDialogueStats({force:true});
    showToast(reported?'Thanks — this topic was added to Recent.':'Your recent-topic report was removed.');
  }catch(e){r.error=e?.message||'Could not save the recent-topic report.';showToast(r.error);}
  finally{r.savingId='';render();}
}
function openRecentDateEditor(dialogueId){
  const r=state.recentDialogues;r.editingId=dialogueId;r.editingDate=recentShiftDate(0);render();
}
function recentFilterControls(){
  const r=state.recentDialogues;
  const libraryButtons=[['all','All'],['verified','Verified'],['original','Original'],['recent','🔥 Recent']]
    .map(([id,label])=>`<button type="button" data-recent-library="${id}" class="${state.practice.library===id?'active':''}">${label}</button>`).join('');
  const dateTools=state.practice.library==='recent'?`<div class="recent-date-tools"><label><span>Appeared</span><select id="recentPreset"><option value="week" ${r.preset==='week'?'selected':''}>This week</option><option value="30d" ${r.preset==='30d'?'selected':''}>Last 30 days</option><option value="month" ${r.preset==='month'?'selected':''}>Month</option><option value="custom" ${r.preset==='custom'?'selected':''}>Custom dates</option></select></label>${r.preset==='month'?`<label><span>Month</span><input id="recentMonth" type="month" value="${esc(r.month||recentShiftDate(0).slice(0,7))}"></label>`:''}${r.preset==='custom'?`<label><span>From</span><input id="recentFrom" type="date" value="${esc(r.from||recentShiftDate(-29))}"></label><label><span>To</span><input id="recentTo" type="date" value="${esc(r.to||recentShiftDate(0))}"></label>`:''}<button type="button" class="secondary compact" data-action="recent-refresh">↻ Refresh</button></div>`:'';
  return `<section class="recent-library-panel"><div class="recent-library-tabs" role="group" aria-label="Dialogue library filter">${libraryButtons}</div>${dateTools}${r.error?`<div class="recent-error">${esc(r.error)}</div>`:''}${r.loading?'<div class="recent-loading">Refreshing student reports…</div>':''}</section>`;
}
function recentCardBadge(dialogue){
  const total=recentTotalCount(dialogue),students=Number(recentStudentStat(dialogue.id).count||0),source=recentSourceCount(dialogue),last=recentLastDate(dialogue);
  if(!total&&!dialogue.recentSourceReported)return '';
  const pieces=[];
  if(students)pieces.push(`${students} student ${students===1?'report':'reports'}`);
  if(source)pieces.push('1 supplied candidate report');
  if(last)pieces.push(`last ${recentPrettyDate(last)}`);
  return `<div class="recent-badge">🔥 Recent${pieces.length?` · ${esc(pieces.join(' · '))}`:''}</div>`;
}
function recentReportControl(dialogue){
  const r=state.recentDialogues,mine=recentMyReport(dialogue.id),editing=r.editingId===dialogue.id,saving=r.savingId===dialogue.id;
  if(editing){
    return `<div class="recent-report-editor"><label><span>When did it appear in your test?</span><input type="date" data-recent-date="${esc(dialogue.id)}" max="${recentShiftDate(0)}" value="${esc(r.editingDate||recentShiftDate(0))}"></label><div><button type="button" class="primary compact" data-action="recent-confirm" data-id="${esc(dialogue.id)}" ${saving?'disabled':''}>${saving?'Saving…':'Confirm'}</button><button type="button" class="secondary compact" data-action="recent-cancel">Cancel</button></div><small>Report the topic you remember. Exact test wording may differ.</small></div>`;
  }
  if(mine){
    return `<button type="button" class="recent-report-button reported" data-action="recent-unreport" data-id="${esc(dialogue.id)}" ${saving?'disabled':''} title="Click again to remove your report">✓ Appeared in my test · ${esc(recentPrettyDate(mine.reportedOn))}</button>`;
  }
  return `<button type="button" class="recent-report-button" data-action="recent-report" data-id="${esc(dialogue.id)}" ${saving?'disabled':''}>🔥 Appeared in my test</button>`;
}

const baseFilteredDialoguesV213=filteredDialogues;
function recentReviewedContent(d){return /human-edited|bilingual-rebuilt|candidate-reported-source-reviewed|revalidated|clarity repair/i.test(String(d?.reviewStatus||''));}
filteredDialogues=function v213FilteredDialogues(){
  // The older base filter only knew the historical "human-edited" label. V21.3
  // has newer reviewed statuses, so let the base apply topic/search/progress first
  // and then apply the expanded reviewed/imported rule here.
  const requestedReview=state.practice.review||'all';
  if(requestedReview!=='all')state.practice.review='all';
  let list=baseFilteredDialoguesV213();
  state.practice.review=requestedReview;
  if(requestedReview==='reviewed')list=list.filter(recentReviewedContent);
  else if(requestedReview==='imported')list=list.filter(d=>!recentReviewedContent(d));
  const lib=state.practice.library||'all';
  if(lib==='verified')list=list.filter(d=>recentContentType(d)==='verified');
  else if(lib==='original')list=list.filter(d=>recentContentType(d)==='original');
  else if(lib==='recent')list=list.filter(recentIsVisible);
  if(lib==='recent')list.sort((a,b)=>recentTotalCount(b)-recentTotalCount(a)||String(recentLastDate(b)).localeCompare(String(recentLastDate(a)))||String(a.title).localeCompare(String(b.title)));
  return list;
};

practice=function v213Practice(){
  const list=filteredDialogues(),records=dialogueStatsMap(),totals=dialogueTotals();
  // Keep a default 30-day aggregate ready even in All/Verified/Original, so badges do not appear stale.
  if(!state.recentDialogues.loading&&!state.recentDialogues.loadedKey&&navigator.onLine)queueMicrotask(()=>loadRecentDialogueStats());
  const practiceModes=`<section class="v20-practice-modes v20-2-practice-modes"><button class="active" aria-current="page"><b>▶ Dialogue</b><span>Learn or practise</span></button><button data-action="v20-open-mock"><b>⏱ Mock Test</b><span>Two dialogues</span></button></section>`;
  return shell(`${header('Dialogue Practice','All supplied dialogues with learning, practice and review modes')}
  ${practiceModes}
  <div class="info">The source transcript is <b>off by default</b>. Your completed-dialogue history and practice counts are saved automatically on this device.</div>
  <section class="completion-summary"><div><strong>${totals.completed}</strong><span>completed dialogues</span></div><div><strong>${totals.remaining}</strong><span>remaining dialogues</span></div><div><strong>${totals.totalPractices}</strong><span>total dialogue practices</span></div></section>
  ${recentFilterControls()}
  <section class="dialogue-filter-panel"><div class="practice-search-row"><label class="search"><span aria-hidden="true">⌕</span><input id="practiceQuery" type="search" inputmode="search" autocomplete="off" aria-label="Search dialogue title, topic, English or ${esc(targetLanguageName())}" placeholder="Search title, topic, English or ${esc(targetLanguageName())}" value="${esc(state.practice.query)}"></label>${state.practice.query?button('Clear','clear-practice-search','secondary compact practice-clear'):''}</div><div class="practice-filter-row"><label><span>Topic</span><select id="practiceTopic">${topicOptions(state.practice.topic)}</select></label><label><span>Level</span><select id="practiceDifficulty"><option value="all">All levels</option>${['Foundation','Developing','Exam level'].map(x=>`<option value="${x}" ${state.practice.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>Content</span><select id="practiceReview"><option value="all">All content</option><option value="reviewed" ${state.practice.review==='reviewed'?'selected':''}>Reviewed content</option><option value="imported" ${state.practice.review==='imported'?'selected':''}>Imported library</option></select></label><label><span>Progress</span><select id="practiceCompletion"><option value="all" ${state.practice.completion==='all'?'selected':''}>All dialogues</option><option value="remaining" ${state.practice.completion==='remaining'?'selected':''}>Remaining</option><option value="completed" ${state.practice.completion==='completed'?'selected':''}>Completed</option></select></label></div></section>
  <div class="dialogue-count"><b>${list.length}</b> dialogues match the filters${state.practice.library==='recent'?` · ${esc(recentRange()[0])} to ${esc(recentRange()[1])}`:''}</div>
  <div class="dialogues">${list.map(d=>{const rr=records[d.id]||{practiceCount:0},done=rr.practiceCount>0,reviewed=recentReviewedContent(d);return `<article class="dialogue-card ${recentTotalCount(d)?'has-recent':''}"><div class="tags"><span>${topicLabels[d.topic]||'Community'}</span><em>${d.difficulty}</em><span class="library-tag">${recentContentType(d)==='original'?'Original':'Verified'}</span></div>${recentCardBadge(d)}<div class="dialogue-progress ${done?'done':'remaining'}"><b>${done?'✓ Completed':'○ Remaining'}</b><span>${done?`Practised ${rr.practiceCount} ${rr.practiceCount===1?'time':'times'}${rr.bestLow!==null?` · best ${rr.bestLow}–${rr.bestHigh}/45`:''}${rr.bestTimeSeconds?` · fastest ${formatElapsedTime(rr.bestTimeSeconds)}`:''}`:'Not practised yet'}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.situation)}</p><div class="content-quality ${reviewed?'reviewed':'imported'}">${reviewed?'✓ Reviewed bilingual content':'◇ Imported library content'}</div><div class="meta">${d.estimatedMinutes} min · ${d.segments.length} segments · Audio + recording${rr.lastPractisedAt?` · last ${new Date(rr.lastPractisedAt).toLocaleDateString()}`:''}</div>${recentReportControl(d)}<div class="actions">${button('Learning Mode','open-dialogue','secondary',`data-id="${d.id}" data-mode="learning"`)}${button(done?'Practise again →':'Practice →','open-dialogue','primary',`data-id="${d.id}" data-mode="practice"`)}</div></article>`;}).join('')||'<div class="empty wide-card"><h3>No dialogues match</h3><p>Change the library, date, topic, level, completion status or search.</p></div>'}</div>`);
};

const baseCurrentMockPairV213=currentMockPair;
currentMockPair=function v213CurrentMockPair(){
  // Original Source V18 intentionally excludes Original Source dialogues from normal
  // random mocks. The dedicated candidate-reported pair is the one explicit exception.
  if(Array.isArray(state.mockPair)&&state.mockPair.length===2&&RECENT_MOCK_PAIR.every((id,i)=>state.mockPair[i]===id)){
    const pair=state.mockPair.map(id=>state.dialogues.find(d=>d.id===id)).filter(Boolean);
    if(pair.length===2)return pair;
  }
  return baseCurrentMockPairV213();
};
function isRecentMockPair(){return Array.isArray(state.mockPair)&&state.mockPair.length===2&&RECENT_MOCK_PAIR.every((id,i)=>state.mockPair[i]===id);}
mock=function v213Mock(){
  const pair=currentMockPair();
  const practiceModes=`<section class="v20-practice-modes v20-2-practice-modes"><button data-action="tab" data-id="practice"><b>▶ Dialogue</b><span>Learn or practise</span></button><button class="active" aria-current="page"><b>⏱ Mock Test</b><span>Two dialogues</span></button></section>`;
  return shell(`${header('Mock Test','Two-dialogue realistic practice')}
  ${practiceModes}
  <section class="recent-mock-callout"><div><small>RECENTLY REPORTED MOCK PAIR</small><h3>Senior Position + New GP Registration</h3><p>These two supplied candidate-reported topics can be practised together as a dedicated two-dialogue mock. Exact real-test wording may differ.</p></div><button type="button" class="${isRecentMockPair()?'primary':'secondary'}" data-action="use-recent-mock">${isRecentMockPair()?'✓ Recent pair selected':'Use recent pair'}</button></section>
  <section class="mock"><div class="lock">🔒</div><small>LOCKED TEST-STYLE SETTINGS</small><h2>Complete two dialogues before feedback</h2><p>Normal speed, hidden source transcripts, one penalty-free repeat per dialogue and separate estimates out of 45.</p><div class="mock-pair">${pair.map((d,i)=>`<div><b>Dialogue ${i+1}</b><span>${esc(d?.title||'')}</span><small>${topicLabels[d?.topic]||''}${RECENT_MOCK_PAIR.includes(d?.id)?' · recent reported topic':''}</small></div>`).join('')}</div><ul><li>Estimated result applies 63/90 overall</li><li>Each dialogue must also reach 29/45</li><li>No feedback appears until both dialogues finish</li></ul><div class="actions centered">${button('Choose another pair','shuffle-mock','secondary')}${button('Start full mock →','start-mock','primary')}</div></section>
  <div class="warning">Scores are NAATI-aligned practice estimates, not official examiner marks. Recent labels are candidate/student reports, not official NAATI topic predictions.</div>`);
};

app.addEventListener('click',async event=>{
  const el=event.target.closest('[data-recent-library],[data-action^="recent-"],[data-action="use-recent-mock"]');if(!el)return;
  if(el.dataset.recentLibrary){state.practice.library=el.dataset.recentLibrary;state.practice.query='';if(state.practice.library==='recent')await loadRecentDialogueStats({force:true});render();return;}
  const action=el.dataset.action,id=el.dataset.id;
  if(action==='recent-refresh'){state.recentDialogues.loadedKey='';await loadRecentDialogueStats({force:true});return;}
  if(action==='recent-report'){if(!recentCurrentUser()){showToast('Please sign in before reporting a recently appeared topic.');return;}openRecentDateEditor(id);return;}
  if(action==='recent-cancel'){state.recentDialogues.editingId='';state.recentDialogues.editingDate='';render();return;}
  if(action==='recent-confirm'){
    const date=state.recentDialogues.editingDate||recentShiftDate(0);if(!date){showToast('Choose the date the topic appeared.');return;}await saveRecentDialogueReport(id,true,date);return;
  }
  if(action==='recent-unreport'){await saveRecentDialogueReport(id,false,null);return;}
  if(action==='use-recent-mock'){state.mockPair=[...RECENT_MOCK_PAIR];render();return;}
});

app.addEventListener('change',async event=>{
  const t=event.target;if(!t)return;
  if(t.id==='recentPreset'){state.recentDialogues.preset=t.value;state.recentDialogues.loadedKey='';await loadRecentDialogueStats({force:true});render();}
  else if(t.id==='recentMonth'){state.recentDialogues.month=t.value;state.recentDialogues.loadedKey='';await loadRecentDialogueStats({force:true});render();}
  else if(t.id==='recentFrom'){state.recentDialogues.from=t.value;state.recentDialogues.loadedKey='';await loadRecentDialogueStats({force:true});render();}
  else if(t.id==='recentTo'){state.recentDialogues.to=t.value;state.recentDialogues.loadedKey='';await loadRecentDialogueStats({force:true});render();}
  else if(t.matches('[data-recent-date]')){state.recentDialogues.editingDate=t.value;}
});
