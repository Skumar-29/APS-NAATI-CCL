'use strict';
(() => {
  const VERSION='original-source-v18';
  state.practiceLibrary=state.practiceLibrary||'verified';

  const isOriginal=d=>d?.library==='original-source';
  const libraryRows=()=>state.dialogues.filter(d=>state.practiceLibrary==='original'?isOriginal(d):!isOriginal(d));
  const isStudy=d=>String(d?.qualityTier||'').startsWith('study-ready')||/reviewed|rebuilt|revalidated|human-edited|owner/i.test(String(d?.reviewStatus||''));

  filteredDialogues=function v18FilteredDialogues(){
    const q=state.practice.query,records=dialogueStatsMap();
    return libraryRows().filter(d=>{
      const done=(records[d.id]?.practiceCount||0)>0;
      const completionOk=state.practice.completion==='all'||(state.practice.completion==='completed'?done:!done);
      const qualityOk=state.practiceLibrary==='original'||state.practice.review==='all'||isStudy(d);
      return qualityOk&&(state.practice.topic==='all'||d.topic===state.practice.topic)&&
        (state.practice.difficulty==='all'||d.difficulty===state.practice.difficulty)&&completionOk&&searchMatches(dialogueSearchText(d),q);
    });
  };

  practice=function v18Practice(){
    const list=filteredDialogues(),records=dialogueStatsMap(),base=libraryRows();
    const qualityBase=base.filter(d=>state.practiceLibrary==='original'||state.practice.review==='all'||isStudy(d));
    let completed=0,totalPractices=0;
    qualityBase.forEach(d=>{const n=records[d.id]?.practiceCount||0;if(n)completed++;totalPractices+=n;});
    const remaining=Math.max(0,qualityBase.length-completed);
    const original=state.practiceLibrary==='original';
    const info=original
      ? '<b>Original Source · 85 dialogues.</b> These preserve the original source scenarios, sequence, names, numbers and meaning. Hindi spelling/grammar and English/Hindi sample answers were reviewed for simple, natural practice language. This library is kept separate from the 105 verified practice dialogues and is not added to Mock Test automatically.'
      : '<b>Verified Practice · 105 dialogues.</b> This is the existing V17 library and remains unchanged. Learning Mode includes dialogue-specific vocabulary, and the player, recording, transcript, speed and response-gap controls work as before.';
    const tabs=`<section class="practice-library-switch" aria-label="Dialogue library"><button type="button" data-action="set-practice-library" data-id="verified" class="${original?'':'active'}"><strong>Verified Practice</strong><span>105 dialogues</span></button><button type="button" data-action="set-practice-library" data-id="original" class="${original?'active':''}"><strong>Original Source</strong><span>85 dialogues</span></button></section>`;
    const qualityFilter=original?'':`<label><span>Content quality</span><select id="practiceReview"><option value="study" ${state.practice.review==='study'?'selected':''}>Study-ready (recommended)</option><option value="all" ${state.practice.review==='all'?'selected':''}>All content</option></select></label>`;
    return shell(`${header(original?'Original Source':'Dialogue Practice',original?'Restored 85-dialogue source library':'Verified 105-dialogue practice library')}
      ${tabs}<div class="info">${info}</div>
      <section class="completion-summary"><div><strong>${completed}</strong><span>completed in this library</span></div><div><strong>${remaining}</strong><span>remaining in this library</span></div><div><strong>${totalPractices}</strong><span>practices in this library</span></div></section>
      <section class="dialogue-filter-panel"><div class="practice-search-row"><label class="search"><span aria-hidden="true">⌕</span><input id="practiceQuery" type="search" inputmode="search" autocomplete="off" aria-label="Search dialogue title, topic, English or Hindi" placeholder="Search title, topic, English or Hindi" value="${esc(state.practice.query)}"></label>${state.practice.query?button('Clear','clear-practice-search','secondary compact practice-clear'):''}</div><div class="practice-filter-row"><label><span>Topic</span><select id="practiceTopic">${topicOptions(state.practice.topic)}</select></label><label><span>Level</span><select id="practiceDifficulty"><option value="all">All levels</option>${['Foundation','Developing','Exam level'].map(x=>`<option value="${x}" ${state.practice.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></label>${qualityFilter}<label><span>Progress</span><select id="practiceCompletion"><option value="all" ${state.practice.completion==='all'?'selected':''}>All dialogues</option><option value="remaining" ${state.practice.completion==='remaining'?'selected':''}>Remaining</option><option value="completed" ${state.practice.completion==='completed'?'selected':''}>Completed</option></select></label></div></section>
      <div class="dialogue-count"><b>${list.length}</b> dialogues match the filters · ${original?'Original Source':'Verified Practice'}</div>
      <div class="dialogues">${list.map(d=>{const r=records[d.id]||{practiceCount:0};const done=r.practiceCount>0;const badge=original?'<div class="content-quality original-source-badge">Original Source · language reviewed</div>':'<div class="content-quality reviewed">✓ Verified Practice</div>';return `<article class="dialogue-card ${original?'original-source-card':''}"><div class="tags"><span>${topicLabels[d.topic]||'Community'}</span><em>${d.difficulty}</em></div><div class="dialogue-progress ${done?'done':'remaining'}"><b>${done?'✓ Completed':'○ Remaining'}</b><span>${done?`Practised ${r.practiceCount} ${r.practiceCount===1?'time':'times'}${r.bestLow!==null?` · best ${r.bestLow}–${r.bestHigh}/45`:''}`:'Not practised yet'}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.situation)}</p>${badge}<div class="meta">${d.estimatedMinutes||8} min · ${d.segments.length} segments · Audio + recording${r.lastPractisedAt?` · last ${new Date(r.lastPractisedAt).toLocaleDateString()}`:''}</div><div class="actions">${button('Learning Mode','open-dialogue-learning-hub','secondary',`data-id="${d.id}"`)}${button(done?'Practise again →':'Practice →','open-dialogue','primary',`data-id="${d.id}" data-mode="practice"`)}</div></article>`;}).join('')||'<div class="empty wide-card"><h3>No dialogues match</h3><p>Change the topic, level, progress or search filters.</p></div>'}</div>`);
  };

  progress=function v18Progress(){
    const attempts=getJSON(storageKeys.attempts,[]),mistakes=getJSON(storageKeys.mistakes,[]),finished=attempts.filter(x=>x.finished),last=finished.at(-1),records=dialogueStatsMap(),pt=phraseTotals();
    const verified=state.dialogues.filter(d=>!isOriginal(d)),originals=state.dialogues.filter(isOriginal);
    const totals=rows=>{let completed=0,practices=0;rows.forEach(d=>{const n=records[d.id]?.practiceCount||0;if(n)completed++;practices+=n;});return {completed,remaining:Math.max(0,rows.length-completed),practices};};
    const vt=totals(verified),ot=totals(originals);
    const completedRows=rows=>rows.filter(d=>(records[d.id]?.practiceCount||0)>0).sort((a,b)=>new Date(records[b.id].lastPractisedAt)-new Date(records[a.id].lastPractisedAt));
    const verifiedDone=completedRows(verified),originalDone=completedRows(originals);
    const recordList=rows=>rows.length?`<div class="completion-records">${rows.map(d=>{const r=records[d.id];return `<div><div><strong>${esc(d.title)}</strong><small>${topicLabels[d.topic]||'Community'} · last practised ${new Date(r.lastPractisedAt).toLocaleString()}</small></div><span class="record-count">${r.practiceCount}× practised</span>${r.bestLow!==null?`<em>Best ${r.bestLow}–${r.bestHigh}/45</em>`:''}<button data-action="open-dialogue" data-id="${d.id}" data-mode="practice">Practise again</button></div>`;}).join('')}</div>`:'<div class="empty">No dialogue in this library has been completed yet.</div>';
    const recentPhrases=state.phrases.map(x=>({...x,...phrasePracticeInfo(x.id)})).filter(x=>x.completed).sort((a,b)=>new Date(b.lastPractisedAt)-new Date(a.lastPractisedAt)).slice(0,12);
    return shell(`${header('Progress','Verified Practice and Original Source are tracked separately')}
      <section class="card"><small>VERIFIED PRACTICE · 105</small><h3>Your existing dialogue progress remains unchanged</h3><section class="stats progress-stats">${[[vt.completed,'verified completed'],[vt.remaining,'verified remaining'],[vt.practices,'verified practices']].map(([v,l])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</section></section>
      <section class="card"><small>ORIGINAL SOURCE · 85</small><h3>Separate progress for the restored source library</h3><section class="stats progress-stats">${[[ot.completed,'original completed'],[ot.remaining,'original remaining'],[ot.practices,'original practices']].map(([v,l])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</section></section>
      <section class="card"><small>VERIFIED COMPLETION RECORDS</small><h3>Completed Verified Practice dialogues</h3>${recordList(verifiedDone)}</section>
      <section class="card"><small>ORIGINAL SOURCE COMPLETION RECORDS</small><h3>Completed Original Source dialogues</h3>${recordList(originalDone)}</section>
      <section class="dashboard-grid"><article class="card"><small>RECENT DIALOGUE RESULTS</small><h3>Scores and improvement</h3>${finished.length?`<div class="attempts">${finished.slice(-8).reverse().map(a=>`<button data-action="open-saved-report" data-id="${a.id}"><strong>${esc(a.title)}</strong><span>${a.report?.low??'—'}–${a.report?.high??'—'} / 45</span><small>${new Date(a.finishedAt).toLocaleString()}</small></button>`).join('')}</div>`:'<div class="empty">Complete a practice dialogue to create your first report.</div>'}</article>
      <article class="card"><small>PHRASE COMPLETION RECORDS</small><h3>${pt.completed} completed · ${pt.remaining} remaining</h3>${recentPhrases.length?`<div class="phrase-records">${recentPhrases.map(x=>`<div><p><b>${esc(x.english)}</b><small>${esc(x.hindi)}</small></p><span>${x.practiceCount}×</span></div>`).join('')}</div><button class="secondary full-record-link" data-action="tab" data-id="learn">Open all phrases and filters →</button>`:'<p class="muted">Play a phrase to mark it completed and start its practice count.</p>'}</article></section>
      <section class="dashboard-grid"><article class="card"><small>MISTAKE NOTEBOOK</small><h3>${mistakes.filter(x=>!x.mastered).length} items need revision</h3>${mistakes.length?`<div class="mistake-list">${mistakes.slice(-6).reverse().map(m=>`<div><span class="result-dot ${m.status}"></span><p><b>${esc(m.dialogueTitle)} · Segment ${m.segmentNumber}</b><small>${esc(m.review?.slice(0,2).join(', ')||'Review meaning')}</small></p><button data-action="toggle-mastered" data-id="${m.id}">${m.mastered?'Restore':'Mastered'}</button></div>`).join('')}</div>`:'<p class="muted">Weak segments will be saved here automatically.</p>'}</article><article class="card"><small>LATEST ESTIMATE</small><h3>${last?.report?`${last.report.low}–${last.report.high}/45`:'No completed dialogue yet'}</h3><p class="muted">Your result history remains available after closing and reopening the app.</p></article></section>
      <section class="card"><small>PROGRESS BACKUP</small><h3>Backup all learning records</h3><p class="muted">The backup contains vocabulary statuses, phrase completion counts, settings, dialogue attempts, mistakes, dialogue-vocabulary progress and Lesson 0 progress.</p><div class="actions">${button('Backup progress','backup-progress','secondary')}${button('Restore progress','restore-progress','secondary')}</div><input id="restoreFile" type="file" accept="application/json" hidden></section>`);
  };

  document.addEventListener('click',event=>{
    const target=event.target.closest?.('[data-action="set-practice-library"]');
    if(!target)return;
    event.preventDefault();
    state.practiceLibrary=target.dataset.id==='original'?'original':'verified';
    state.practice.query='';
    state.practice.topic='all';
    state.practice.difficulty='all';
    state.practice.completion='all';
    if(state.practiceLibrary==='verified')state.practice.review='study';
    render();
  },true);

  console.info(`${VERSION}: separate Original Source library enabled`);
})();
