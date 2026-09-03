(function(){
'use strict';
const VERSION='Original Source V18.1';
state.practiceLibrary=state.practiceLibrary||'verified';
const isOriginal=d=>String(d?.id||'').startsWith('original-')||d?.library==='original-source';
const verifiedList=()=>state.dialogues.filter(d=>!isOriginal(d));
const originalList=()=>state.dialogues.filter(isOriginal);
const basePractice=practice;
practice=function(){
  const all=state.dialogues;
  const selected=state.practiceLibrary==='original'?originalList():verifiedList();
  state.dialogues=selected;
  let html=basePractice();
  state.dialogues=all;
  const tabs=`<section class="v18-library-tabs" aria-label="Dialogue library"><button data-action="v18-library" data-library="verified" class="${state.practiceLibrary==='verified'?'active':''}"><b>Verified Practice</b><span>${verifiedList().length} dialogues</span></button><button data-action="v18-library" data-library="original" class="${state.practiceLibrary==='original'?'active':''}"><b>Original Source</b><span>${originalList().length} dialogues</span></button></section>`;
  html=html.replace('</header>','</header>'+tabs);
  html=html.replace(/◇ Imported from your library · bilingual review recommended/g,'✓ Original Source · language corrected');
  return html;
};
const baseMock=currentMockPair;
currentMockPair=function(){
  if(state.mockPair){const valid=state.mockPair.every(id=>{const d=state.dialogues.find(x=>x.id===id);return d&&!isOriginal(d)});if(!valid)state.mockPair=null;}
  const all=state.dialogues;state.dialogues=verifiedList();const pair=baseMock();state.dialogues=all;return pair;
};
const baseProgress=progress;
progress=function(){
 const html=baseProgress(); const rec=dialogueStatsMap();
 const calc=list=>({done:list.filter(d=>(rec[d.id]?.practiceCount||0)>0).length,total:list.length});
 const a=calc(verifiedList()),b=calc(originalList());
 const box=`<section class="v18-progress-libraries"><div><strong>${a.done}/${a.total}</strong><span>Verified Practice</span></div><div><strong>${b.done}/${b.total}</strong><span>Original Source</span></div></section>`;
 return html.replace('<section class="stats progress-stats">',box+'<section class="stats progress-stats">');
};
document.addEventListener('click',e=>{const el=e.target.closest('[data-action="v18-library"]');if(!el)return;e.preventDefault();state.practiceLibrary=el.dataset.library==='original'?'original':'verified';state.practice.query='';state.practice.topic='all';state.practice.difficulty='all';state.practice.review=state.practiceLibrary==='original'?'all':'study';state.practice.completion='all';render();},true);
console.info(`${VERSION} loaded: ${verifiedList().length} Verified Practice + ${originalList().length} Original Source dialogues.`);
})();
