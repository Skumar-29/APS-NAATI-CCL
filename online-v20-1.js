'use strict';
/* APS V20.1 — compact practice workspace
   UI-only refinement on top of V20 online semantic assessment.
   V20.3.2.1 starts online assessment on demand when Review is opened. */
(function(){
const VERSION='APS V20.1';
if(typeof state==='undefined'||typeof recordingPanel!=='function'||typeof render!=='function')return;

const baseRecordingPanelV201=recordingPanel;
const baseRenderV201=render;

function responseTranscript(response){
  return String(response?.cloudTranscript||response?.transcript||response?.browserTranscript||'').trim();
}
function responseDuration(response){
  const d=Number(response?.duration||0);
  return d?`${Math.floor(d/60)}:${String(Math.round(d%60)).padStart(2,'0')}`:'—';
}
function completedRecordingPanel(response,seg){
  const transcript=responseTranscript(response);
  const sample=seg.sampleAnswer||seg.model||'';
  const compareReady=Boolean(response.recordingUrl||response.recordingId||transcript);
  const transcriptLabel=response.cloudTranscript?'CLOUD TRANSCRIPT':transcript?'BROWSER TRANSCRIPT':'SAVED AUDIO';
  const duration=responseDuration(response);
  const skipControl=`<button class="aps-inline-skip aps-inline-skip-recording" data-action="skip-recording" type="button" aria-label="Skip this response and continue" title="Skip this response and continue">Skip</button>`;
  const reviewButton=button(response.showTranscript?'Hide review':'Review','toggle-response-transcript','secondary',compareReady?'':'disabled');

  return `<section class="recording-panel complete v201-response-panel">${skipControl}
    <div class="v201-response-toolbar">
      <div class="v201-response-title"><h3>Response recorded</h3><span class="recording-verified">✓ Saved · ${duration}</span></div>
      <div class="record-actions v201-record-actions">${reviewButton}${button('Record again','record-again','secondary')}</div>
    </div>

    ${(response.onlineAssessmentStatus==='processing'||response.onlineAssessmentStatus==='preparing')&&!response.showTranscript?`<div class="v20-assessment-processing v201-processing" role="status" aria-live="polite"><i class="v20-assessment-spinner" aria-hidden="true"></i><div><b>${response.onlineAssessmentStatus==='preparing'?'Preparing online assessment…':'Assessing your interpretation…'}</b><span>Online feedback is loading. You can keep using the page.</span></div></div>`:''}

    <div class="v201-response-grid ${response.showTranscript?'with-sample':'single'}">
      <article class="v201-response-card">
        <div class="v201-card-head"><small>${transcriptLabel}</small><span>Check against your audio</span></div>
        <p>${esc(transcript||'Automatic transcript unavailable — replay your saved recording and compare manually.')}</p>
        ${response.recordingUrl
          ?`<audio controls preload="metadata" src="${esc(response.recordingUrl)}" data-recording-id="${esc(response.recordingId||'')}"></audio>`
          :'<p class="recording-failure">Recording unavailable. Please record again.</p>'}
      </article>

      ${response.showTranscript?`<article class="v201-sample-card">
        <div class="v201-card-head"><small>SAMPLE INTERPRETATION</small><button class="v201-icon-button" data-action="play-sample-answer" type="button" aria-label="Play sample answer" title="Play sample answer">▶</button></div>
        <p>${esc(sample)}</p>
        <em>Example only — equivalent meaning, natural synonyms and accurate paraphrasing can also be correct.</em>
      </article>`:''}
    </div>

    ${response.showTranscript?`<div class="answer-review v201-answer-review">${comparisonPanel(seg,response)}</div>`:''}
  </section>`;
}

recordingPanel=function v201RecordingPanel(response,seg){
  const isMock=state.dialogueMode==='mock';
  if(isMock||state.micError||state.recording||state.recordingError||!response){
    return baseRecordingPanelV201(response,seg);
  }
  return completedRecordingPanel(response,seg);
};

function iconButton(el,icon,label){
  if(!el)return;
  el.textContent=icon;
  el.setAttribute('aria-label',label);
  el.setAttribute('title',label);
  el.classList.add('v201-top-icon');
}
function shortButton(selector,html,label){
  const el=document.querySelector(selector);if(!el)return;
  el.innerHTML=html;el.setAttribute('title',label);el.setAttribute('aria-label',label);
}
function enhanceDialogueWorkspace(){
  const screen=document.querySelector('.dialogue-screen');if(!screen)return;
  screen.classList.add('v201-dialogue-screen');

  iconButton(screen.querySelector('[data-action="global-search"]'),'🔍','Search');
  iconButton(screen.querySelector('[data-action="app-settings"]'),'⚙','Settings');
  iconButton(screen.querySelector('[data-action="my-quick-open"]'),'＋','Add My Vocab');

  const transcript=screen.querySelector('[data-action="toggle-source-transcript"]');
  if(transcript){
    const on=transcript.classList.contains('on');
    transcript.textContent='▤';
    transcript.setAttribute('aria-label',`Source transcript ${on?'on':'off'}`);
    transcript.setAttribute('title',`Source transcript ${on?'on':'off'} · click to ${on?'hide':'show'}`);
    transcript.classList.add('v201-transcript-icon');
  }

  const play=screen.querySelector('[data-action="play-dialogue-segment"]');
  if(play){
    const label=state.playerStatus==='playing'?'Playing':state.responses?.[state.segmentIndex]?'Replay':'Play';
    play.innerHTML=`▶ <span>${label}</span>`;play.title=label==='Replay'?'Play source again':'Play source';
  }
  const repeat=screen.querySelector('[data-action="repeat-dialogue-segment"]');
  if(repeat){repeat.innerHTML='↻ <span>Repeat</span>';repeat.title=`Repeat source · used ${state.repeats||0}`;}
  const review=screen.querySelector('[data-action="toggle-response-transcript"]');
  if(review){const showing=Boolean(state.responses?.[state.segmentIndex]?.showTranscript);review.innerHTML=showing?'▴ <span>Hide</span>':'⇄ <span>Review</span>';review.title=showing?'Hide comparison':'Compare response with sample and feedback';}
  shortButton('.dialogue-screen [data-action="record-again"]','🎙 <span>Again</span>','Record again');
  shortButton('.dialogue-screen [data-action="dialogue-prev"]','‹ <span>Prev</span>','Previous segment');
  shortButton('.dialogue-screen [data-action="dialogue-next"]','<span>Next</span> ›','Next segment');
  shortButton('.dialogue-screen [data-action="finish-dialogue"]','✓ <span>Finish</span>','Finish dialogue');
  screen.querySelectorAll('[data-action="skip-listening"],[data-action="skip-recording"]').forEach(el=>{el.textContent='Skip';el.title='Skip';});
}

render=function v201Render(){
  const result=baseRenderV201();
  requestAnimationFrame(enhanceDialogueWorkspace);
  return result;
};
requestAnimationFrame(enhanceDialogueWorkspace);
window.APSOnlineV201={version:VERSION};
console.info(`${VERSION} loaded · compact practice workspace · response + sample side-by-side · icon-first controls.`);
})();
