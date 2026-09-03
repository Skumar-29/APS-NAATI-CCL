'use strict';
(() => {
  const VERSION='APS UI V20.2';
  const TAB_KEY='apsV20_2SettingsTab';
  const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();

  function hideTechnicalNotes(){
    qsa('.info,.status-note,.reliability-banner').forEach(el=>{
      const t=text(el);
      if(/V\d+|study-ready library|Core CCL Vocabulary|Reviewed General Vocabs|source-reference terms|Learning status remains|source transcript is off by default|packaged dialogues remain|player controls.*unchanged/i.test(t)) el.classList.add('v20-2-hidden-note');
    });
  }

  function compactHeader(){
    const h=qs('.app-header'); if(!h)return;
    const title=text(qs('h1',h)); const sub=qs('.header-copy p',h);
    const map={
      'Dialogue Practice':'', 'Learn':'', 'Review':'', 'Progress':'',
      'APS NAATI CCL Practice':`English ↔ ${typeof targetLanguageName==='function'?targetLanguageName():'Hindi'} preparation`
    };
    if(sub && Object.prototype.hasOwnProperty.call(map,title) && sub.textContent!==map[title]) sub.textContent=map[title];
    const search=qs('.header-search',h), settings=qs('.header-settings',h);
    if(search){search.title='Search';search.setAttribute('aria-label','Search');}
    if(settings){settings.title='Settings';settings.setAttribute('aria-label','Settings');}
  }

  function compactPractice(){
    const modes=qs('.v20-2-practice-modes');
    if(modes && !modes.dataset.v202){
      modes.dataset.v202='1';
      const btns=qsa('button',modes);
      if(btns[0]){btns[0].title='Dialogue Practice';}
      if(btns[1]){btns[1].title='Mock Test';}
    }
    const sum=qs('.completion-summary');
    if(sum && qs('.dialogue-filter-panel') && !sum.dataset.v202){
      sum.dataset.v202='1';
      const labels=qsa('span',sum); ['Completed','Remaining','Attempts'].forEach((x,i)=>{if(labels[i])labels[i].textContent=x;});
    }
  }

  function compactLearningHub(){
    const hub=qs('.dialogue-learning-hub'); if(!hub || hub.dataset.v202)return;
    hub.dataset.v202='1';
    qsa('.learning-choice',hub).forEach(card=>{
      const ul=qs('ul',card); if(ul)ul.remove();
    });
  }

  function categoryForSettings(el){
    if(el.classList.contains('account-settings-card'))return 'account';
    if(el.id==='apsCloudSyncCard')return 'sync';
    if(el.classList.contains('language-settings-section'))return 'language';
    if(el.id==='apsRecallSettingsCard'||el.id==='apsOnlineAssessmentSettingsCard')return 'study';
    if(el.classList.contains('content-studio-settings')||el.id==='apsUpdateCard'||el.classList.contains('voice-settings-help'))return 'advanced';
    if(el.classList.contains('voice-settings-section')){
      const t=text(qs('h3',el));
      if(/timing|playback/i.test(t))return 'study';
      return 'audio';
    }
    return '';
  }

  function activateSettingsTab(modal,tab){
    const available=new Set(qsa('[data-v202-panel]',modal).map(x=>x.dataset.v202Panel));
    if(!available.has(tab))tab=available.has('account')?'account':[...available][0]||'audio';
    modal.dataset.v202Active=tab;
    try{localStorage.setItem(TAB_KEY,tab);}catch{}
    qsa('.v20-2-settings-tabs button',modal).forEach(b=>b.classList.toggle('active',b.dataset.v202Tab===tab));
    qsa('[data-v202-panel]',modal).forEach(x=>x.classList.toggle('v20-2-panel-active',x.dataset.v202Panel===tab));
  }

  function organiseSettings(){
    const modal=qs('.app-settings-modal'); if(!modal)return;
    modal.classList.add('v20-2-settings');
    const heading=qs('.settings-heading',modal);
    if(heading){const sm=qs('small',heading),h2=qs('h2',heading),p=qs('p',heading),pill=heading.querySelector(':scope > span');if(sm&&sm.textContent!=='SETTINGS')sm.textContent='SETTINGS';if(h2&&h2.textContent!=='Settings')h2.textContent='Settings';if(p)p.remove();if(pill&&pill.title!=='Available device voices')pill.title='Available device voices';}

    // Classify current and asynchronously injected cards.
    [...modal.children].forEach(el=>{
      if(!(el instanceof HTMLElement)||el.classList.contains('settings-heading')||el.classList.contains('settings-actions')||el.classList.contains('modal-close')||el.classList.contains('v20-2-settings-tabs'))return;
      const cat=categoryForSettings(el); if(cat)el.dataset.v202Panel=cat;
    });
    qsa('#apsCloudSyncCard,#apsRecallSettingsCard,#apsOnlineAssessmentSettingsCard,#apsUpdateCard,.content-studio-settings,.voice-settings-help',modal).forEach(el=>{const cat=categoryForSettings(el);if(cat)el.dataset.v202Panel=cat;});

    // Shorten student-facing labels without removing controls.
    const account=qs('.account-settings-card',modal); if(account){const p=qs('p',account);if(p){const v=p.textContent.split('·')[0].trim();if(p.textContent!==v)p.textContent=v;}}
    const cloud=qs('#apsCloudSyncCard',modal); if(cloud){const small=qs('.aps-cloud-sync-head small',cloud);if(small&&small.textContent!=='SYNC')small.textContent='SYNC'; const h3=qs('h3',cloud);if(h3&&h3.textContent!=='Cloud sync')h3.textContent='Cloud sync';}
    const lang=qs('.language-settings-section h3',modal);if(lang&&lang.textContent!=='Language')lang.textContent='Language';
    qsa('.voice-settings-section h3',modal).forEach(h=>{if(h.textContent==='General learning voices')h.textContent='Learning voices';if(h.textContent==='Vocabulary and phrase timing')h.textContent='Vocabulary & phrase playback';if(h.textContent==='Dialogue speaker voices')h.textContent='Dialogue voices';});
    const recall=qs('#apsRecallSettingsCard',modal);if(recall){const sm=qs('small',recall);if(sm&&sm.textContent!=='STUDY')sm.textContent='STUDY';}
    const studio=qs('.content-studio-settings',modal);if(studio){const h=qs('h3',studio);if(h&&h.textContent!=='Owner tools')h.textContent='Owner tools';}

    let tabs=qs('.v20-2-settings-tabs',modal);
    if(!tabs){
      tabs=document.createElement('nav');tabs.className='v20-2-settings-tabs';tabs.setAttribute('aria-label','Settings sections');
      const defs=[['account','Account'],['sync','Sync'],['language','Language'],['audio','Audio'],['study','Study'],['advanced','Advanced']];
      tabs.innerHTML=defs.map(([id,label])=>`<button type="button" data-v202-tab="${id}">${label}</button>`).join('');
      if(heading?.nextSibling)modal.insertBefore(tabs,heading.nextSibling);else modal.prepend(tabs);
    }
    const existingTabs=qsa('.v20-2-settings-tabs button',modal);
    existingTabs.forEach(b=>{const id=b.dataset.v202Tab;b.hidden=!qs(`[data-v202-panel="${id}"]`,modal);});
    let active=modal.dataset.v202Active;try{active=active||localStorage.getItem(TAB_KEY);}catch{}
    activateSettingsTab(modal,active||'account');
  }

  function compactManageLanguages(){
    const modal=qs('.settings-modal:not(.app-settings-modal)');if(!modal)return;
    const h2=qs('h2',modal);if(text(h2)==='Manage preparation languages'){
      const p=qs(':scope > p',modal);if(p)p.remove();if(h2.textContent!=='Languages')h2.textContent='Languages';
    }
  }

  function cleanPage(){
    hideTechnicalNotes();compactHeader();compactPractice();compactLearningHub();organiseSettings();compactManageLanguages();
  }

  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-v202-tab]');if(tab){e.preventDefault();const modal=tab.closest('.app-settings-modal');if(modal)activateSettingsTab(modal,tab.dataset.v202Tab);}
  },true);

  if(typeof render==='function'){
    const base=render;
    render=function v20_2Render(){const out=base.apply(this,arguments);queueMicrotask(cleanPage);return out;};
  }
  const observer=new MutationObserver(()=>queueMicrotask(cleanPage));
  const appRoot=document.getElementById('app');if(appRoot)observer.observe(appRoot,{childList:true,subtree:true});
  setTimeout(cleanPage,0);
  console.info(`${VERSION} loaded`);
})();
