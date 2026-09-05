'use strict';
/* APS V21.2.1 — compact dialogue study controls
   - Online Assessment lives beside Speed/Gap in Learning/Practice.
   - Transcript toggle is clearly labelled instead of icon-only.
   - Local fallback states get a robust Retry online action.
   - Mock Test remains unchanged. */
(function(){
  const VERSION='APS V21.2.1 Practice Controls';
  if(typeof state==='undefined'||typeof render!=='function')return;

  const baseRenderV2121=render;

  function assessmentApi(){return window.APSOnlineV20||null;}
  function onlineEnabled(){
    const api=assessmentApi();
    try{return api?.onlineAssessmentEnabled?Boolean(api.onlineAssessmentEnabled()):true;}catch{return true;}
  }
  function currentResponse(){return state.responses?.[state.segmentIndex]||null;}
  function currentSegment(){
    try{return getActiveSegments?.()?.[state.segmentIndex]||null;}catch{return null;}
  }
  function toast(message){try{showToast?.(message);}catch{}}

  function switchMarkup(kind,label,on,action){
    const safeLabel=String(label||'');
    return `<div class="v2121-control v2121-${kind}">
      <span class="v2121-control-label">${safeLabel}</span>
      <button type="button" class="v2121-switch ${on?'is-on':'is-off'}" data-action="${action}" aria-pressed="${on?'true':'false'}" aria-label="${safeLabel} ${on?'on':'off'}" title="${safeLabel} ${on?'ON':'OFF'} · click to turn ${on?'off':'on'}">
        <span class="v2121-switch-track"><i aria-hidden="true"></i><b>${on?'ON':'OFF'}</b></span>
      </button>
    </div>`;
  }

  function enhanceControls(){
    const screen=document.querySelector('.dialogue-screen');
    if(!screen||state.dialogueMode==='mock')return;

    // Online Assessment is now a dialogue-player control rather than a hidden Settings option.
    document.querySelector('#apsOnlineAssessmentSettingsCard')?.remove();

    const controls=screen.querySelector('.dialogue-controls');
    if(!controls)return;

    const gapSelect=controls.querySelector('#dialogueGap');
    if(gapSelect?.parentElement?.tagName==='LABEL'){
      const label=gapSelect.parentElement;
      const textNode=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
      if(textNode)textNode.textContent='Gap';
      label.title='Response gap';
    }

    const transcriptButton=controls.querySelector('[data-action="toggle-source-transcript"]');
    const transcriptOn=Boolean(state.dialogueSettings?.showSourceTranscript);

    // Replace the V20.1 icon-only transcript control with a labelled compact switch.
    if(transcriptButton){
      let transcriptWrap=controls.querySelector('.v2121-transcript');
      if(!transcriptWrap){
        transcriptWrap=document.createElement('div');
        transcriptWrap.className='v2121-control v2121-transcript';
        transcriptButton.before(transcriptWrap);
        transcriptWrap.appendChild(transcriptButton);
      }
      if(!transcriptWrap.querySelector('.v2121-control-label')){
        const label=document.createElement('span');
        label.className='v2121-control-label';
        label.textContent='Transcript';
        transcriptWrap.prepend(label);
      }
      transcriptButton.className='transcript-toggle v2121-switch '+(transcriptOn?'is-on':'is-off');
      transcriptButton.setAttribute('aria-pressed',transcriptOn?'true':'false');
      transcriptButton.setAttribute('aria-label',`Transcript ${transcriptOn?'on':'off'}`);
      transcriptButton.setAttribute('title',`Transcript ${transcriptOn?'ON':'OFF'} · click to ${transcriptOn?'hide':'show'}`);
      transcriptButton.innerHTML=`<span class="v2121-switch-track"><i aria-hidden="true"></i><b>${transcriptOn?'ON':'OFF'}</b></span>`;
    }

    // Insert Online Assessment immediately before Transcript, alongside Speed and Gap.
    if(!controls.querySelector('.v2121-assessment')){
      const holder=document.createElement('div');
      holder.innerHTML=switchMarkup('assessment','Assessment',onlineEnabled(),'v2121-toggle-online-assessment');
      const control=holder.firstElementChild;
      const transcriptWrap=controls.querySelector('.v2121-transcript');
      controls.insertBefore(control,transcriptWrap||transcriptButton||null);
    }else{
      const btn=controls.querySelector('.v2121-assessment .v2121-switch');
      const on=onlineEnabled();
      if(btn){
        btn.classList.toggle('is-on',on);btn.classList.toggle('is-off',!on);
        btn.setAttribute('aria-pressed',on?'true':'false');
        btn.setAttribute('aria-label',`Assessment ${on?'on':'off'}`);
        btn.title=`Online assessment ${on?'ON':'OFF'} · click to turn ${on?'off':'on'}`;
        const status=btn.querySelector('b');if(status)status.textContent=on?'ON':'OFF';
      }
    }
  }

  function enhanceRetry(){
    if(state.dialogueMode==='mock')return;
    const response=currentResponse();
    if(!response||!response.showTranscript||response.onlineAssessment||!onlineEnabled())return;
    const status=String(response.onlineAssessmentStatus||'');
    if(!['failed','unavailable','offline'].includes(status))return;

    const feedback=document.querySelector('.dialogue-screen .v20-feedback');
    if(!feedback)return;

    // Upgrade the older retry action when it is already present.
    const existing=feedback.querySelector('[data-action="v20-retry-assessment"], [data-action="v2121-retry-online-assessment"]');
    if(existing){
      existing.dataset.action='v2121-retry-online-assessment';
      existing.textContent=navigator.onLine?'↻ Retry online':'Offline';
      existing.disabled=!navigator.onLine;
      existing.setAttribute('aria-label',navigator.onLine?'Retry online assessment':'Internet connection is offline');
      existing.title=navigator.onLine?'Retry online assessment now':'Reconnect to the internet to retry';
      return;
    }

    const pill=feedback.querySelector('.v20-source-pill.fallback');
    if(!pill)return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='v2121-retry-button';
    btn.dataset.action='v2121-retry-online-assessment';
    btn.textContent=navigator.onLine?'↻ Retry online':'Offline';
    btn.disabled=!navigator.onLine;
    btn.setAttribute('aria-label',navigator.onLine?'Retry online assessment':'Internet connection is offline');
    btn.title=navigator.onLine?'Retry online assessment now':'Reconnect to the internet to retry';
    pill.insertAdjacentElement('afterend',btn);
  }

  function enhanceSettings(){
    // The learner controls assessment from the dialogue player now. Avoid a duplicate toggle in Settings.
    document.querySelector('#apsOnlineAssessmentSettingsCard')?.remove();
  }

  function enhance(){
    enhanceSettings();
    enhanceControls();
    enhanceRetry();
  }

  render=function v2121Render(){
    const result=baseRenderV2121();
    requestAnimationFrame(enhance);
    return result;
  };

  document.addEventListener('click',async event=>{
    const el=event.target.closest?.('[data-action]');
    if(!el)return;
    const action=el.dataset.action;

    if(action==='v2121-toggle-online-assessment'){
      event.preventDefault();event.stopPropagation();
      const api=assessmentApi();
      if(!api?.setOnlineAssessmentEnabled)return toast('Online assessment control is unavailable.');
      const enabled=!onlineEnabled();
      api.setOnlineAssessmentEnabled(enabled);
      state.v20=state.v20||{};
      if(enabled)state.v20.disabledUntil=0;

      for(const response of state.responses||[]){
        if(!response||response.onlineAssessment)continue;
        if(enabled){
          if(['disabled','unavailable','offline'].includes(String(response.onlineAssessmentStatus||'')))response.onlineAssessmentStatus='ready';
        }else{
          response.onlineAssessmentStatus='disabled';
          response.onlineAssessmentError='';
        }
      }

      const response=currentResponse(),seg=currentSegment();
      toast(enabled?'Online assessment ON':'Online assessment OFF · local feedback only');
      render();

      // If Review is already open, turning ON is an explicit request to assess this response now.
      if(enabled&&response?.showTranscript&&!response.onlineAssessment&&seg&&api.requestAssessmentForReview){
        try{await api.requestAssessmentForReview(seg,response,{force:true});}catch{}
      }
      return;
    }

    if(action==='v2121-retry-online-assessment'){
      event.preventDefault();event.stopPropagation();
      if(!navigator.onLine)return toast('Internet connection is unavailable. Reconnect and try again.');
      const api=assessmentApi(),response=currentResponse(),seg=currentSegment();
      if(!api?.requestAssessmentForReview||!response||!seg)return toast('This response is not ready for online assessment.');
      if(!onlineEnabled())return toast('Turn Assessment ON at the top of the dialogue first.');
      state.v20=state.v20||{};state.v20.disabledUntil=0;
      response.onlineAssessmentError='';
      toast('Retrying online assessment…');
      try{await api.requestAssessmentForReview(seg,response,{force:true});}
      catch{toast('Online assessment is still unavailable. Your local feedback is preserved.');}
      return;
    }
  },true);

  window.addEventListener('online',()=>{if(document.querySelector('.dialogue-screen'))render();});
  window.addEventListener('offline',()=>{if(document.querySelector('.dialogue-screen'))render();});

  requestAnimationFrame(enhance);
  window.APSPracticeControlsV2121={version:VERSION,enhance};
  console.info(`${VERSION} loaded · compact Assessment/Transcript switches · retryable online fallback.`);
})();
