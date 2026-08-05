'use strict';

(() => {
  const HOTFIX_VERSION = 'aps-naati-study-hotfix-v2';
  const BUILD_VERSION = 'github-study-ready-2026-08-05-v2';
  const VERSION_URL = './version.json';
  const CACHE_PREFIX = 'aps-naati-study-ready-';
  const SEARCH_LIMIT = 80;
  let playbackGeneration = 0;
  let searchIndex = [];
  let searchSignature = '';
  let searchInputTimer = 0;

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function safeText(value) {
    return String(value == null ? '' : value);
  }

  function normalise(value) {
    return safeText(value)
      .normalize('NFKC')
      .toLocaleLowerCase('en-AU')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(value) {
    return normalise(value).split(' ').filter(Boolean);
  }

  function matchesQuery(haystack, query) {
    const normalisedHaystack = normalise(haystack);
    const normalisedQuery = normalise(query);
    if (!normalisedQuery) return true;
    if (normalisedHaystack.includes(normalisedQuery)) return true;
    const queryTokens = tokens(normalisedQuery);
    return queryTokens.every(token => normalisedHaystack.includes(token));
  }

  function escapeHtml(value) {
    return safeText(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[character]);
  }

  function currentSignature() {
    try {
      return [
        state.selectedLanguage || '',
        state.dialogues?.length || 0,
        state.vocab?.length || 0,
        state.phrases?.length || 0
      ].join(':');
    } catch {
      return 'unavailable';
    }
  }

  function buildSearchIndex() {
    const signature = currentSignature();
    if (signature === searchSignature && searchIndex.length) return searchIndex;

    const records = [];

    for (const dialogue of state.dialogues || []) {
      const segmentText = (dialogue.segments || [])
        .flatMap(segment => [
          segment.source,
          segment.model,
          segment.sampleAnswer,
          ...(segment.acceptedAlternatives || []),
          ...(segment.comparisonPoints || [])
        ])
        .filter(Boolean)
        .join(' ');

      records.push({
        kind: 'dialogue',
        id: dialogue.id,
        title: dialogue.title || dialogue.id,
        subtitle: topicLabels?.[dialogue.topic] || dialogue.topic || 'Dialogue',
        searchText: [
          dialogue.id,
          dialogue.title,
          dialogue.situation,
          dialogue.topic,
          segmentText
        ].filter(Boolean).join(' ')
      });
    }

    for (const item of state.vocab || []) {
      records.push({
        kind: 'word',
        id: item.id,
        title: item.english || item.id,
        subtitle: item.hindi || '',
        searchText: [
          item.id,
          item.english,
          item.hindi,
          item.topic,
          item.exampleEnglish,
          item.exampleHindi,
          ...(item.synonyms || []),
          ...(item.acceptedHindi || [])
        ].filter(Boolean).join(' ')
      });
    }

    for (const item of state.phrases || []) {
      records.push({
        kind: 'phrase',
        id: item.id,
        title: item.english || item.phraseEnglish || item.id,
        subtitle: item.hindi || item.phraseHindi || '',
        searchText: [
          item.id,
          item.english,
          item.hindi,
          item.phraseEnglish,
          item.phraseHindi,
          item.topic,
          item.exampleEnglish,
          item.exampleHindi
        ].filter(Boolean).join(' ')
      });
    }

    searchIndex = records;
    searchSignature = signature;
    return searchIndex;
  }

  function searchAll(query) {
    const q = normalise(query);
    if (!q) return [];

    return buildSearchIndex()
      .filter(record => matchesQuery(record.searchText, q))
      .sort((left, right) => {
        const leftTitle = normalise(left.title);
        const rightTitle = normalise(right.title);
        const leftExact = leftTitle === q ? 0 : leftTitle.startsWith(q) ? 1 : 2;
        const rightExact = rightTitle === q ? 0 : rightTitle.startsWith(q) ? 1 : 2;
        return leftExact - rightExact || leftTitle.localeCompare(rightTitle);
      })
      .slice(0, SEARCH_LIMIT);
  }

  function ensureSearchShell() {
    let shell = qs('#apsStudySearchShell');
    if (shell) return shell;

    shell = document.createElement('section');
    shell.id = 'apsStudySearchShell';
    shell.className = 'aps-study-search-shell';
    shell.innerHTML = `
      <button
        id="apsStudySearchToggle"
        class="aps-study-search-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="apsStudySearchPanel"
      >⌕ Search all Hindi material</button>
      <div id="apsStudySearchPanel" class="aps-study-search-panel" hidden>
        <div class="aps-study-search-heading">
          <strong>Search all Hindi material</strong>
          <button id="apsStudySearchClose" type="button" aria-label="Close search">×</button>
        </div>
        <label class="aps-study-search-label">
          <span>Dialogue, topic, English, Hindi, vocabulary or phrase</span>
          <input
            id="apsStudySearchInput"
            type="search"
            inputmode="search"
            autocomplete="off"
            placeholder="Try: appointment, tenancy, गर्भावस्था..."
          >
        </label>
        <div id="apsStudySearchSummary" class="aps-study-search-summary">
          Enter at least one word.
        </div>
        <div id="apsStudySearchResults" class="aps-study-search-results"></div>
      </div>
    `;
    document.body.append(shell);

    qs('#apsStudySearchToggle', shell).addEventListener('click', () => {
      const panel = qs('#apsStudySearchPanel', shell);
      const toggle = qs('#apsStudySearchToggle', shell);
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) {
        setTimeout(() => qs('#apsStudySearchInput', shell)?.focus(), 0);
      }
    });

    qs('#apsStudySearchClose', shell).addEventListener('click', () => {
      const panel = qs('#apsStudySearchPanel', shell);
      panel.hidden = true;
      qs('#apsStudySearchToggle', shell)
        .setAttribute('aria-expanded', 'false');
    });

    qs('#apsStudySearchInput', shell).addEventListener('input', event => {
      renderSearchResults(event.target.value);
    });

    qs('#apsStudySearchResults', shell).addEventListener('click', event => {
      const button = event.target.closest('[data-aps-search-kind]');
      if (!button) return;
      openSearchResult(
        button.dataset.apsSearchKind,
        button.dataset.apsSearchId
      );
    });

    return shell;
  }

  function renderSearchResults(query) {
    const shell = ensureSearchShell();
    const summary = qs('#apsStudySearchSummary', shell);
    const resultsHost = qs('#apsStudySearchResults', shell);
    const results = searchAll(query);

    if (!normalise(query)) {
      summary.textContent = 'Enter at least one word.';
      resultsHost.innerHTML = '';
      return;
    }

    summary.textContent = results.length
      ? `${results.length}${results.length === SEARCH_LIMIT ? '+' : ''} matching results`
      : 'No matching Hindi material found.';

    resultsHost.innerHTML = results.map(record => `
      <button
        type="button"
        class="aps-study-search-result"
        data-aps-search-kind="${escapeHtml(record.kind)}"
        data-aps-search-id="${escapeHtml(record.id)}"
      >
        <span class="aps-study-search-kind">${escapeHtml(record.kind)}</span>
        <strong>${escapeHtml(record.title)}</strong>
        <small>${escapeHtml(record.subtitle)}</small>
      </button>
    `).join('');
  }

  function closeSearchPanel() {
    const shell = qs('#apsStudySearchShell');
    if (!shell) return;
    qs('#apsStudySearchPanel', shell).hidden = true;
    qs('#apsStudySearchToggle', shell).setAttribute('aria-expanded', 'false');
  }

  function openSearchResult(kind, id) {
    try {
      if (kind === 'dialogue') {
        closeSearchPanel();
        openDialogue(id, 'learning');
        return;
      }

      const collection = kind === 'word' ? state.vocab : state.phrases;
      const item = (collection || []).find(candidate => candidate.id === id);
      if (!item) return;

      state.overlay = null;
      state.tab = 'learn';
      state.learn.type = kind === 'word' ? 'words' : 'phrases';
      state.learn.topic = 'all';
      state.learn.status = 'all';
      state.learn.completion = 'all';
      state.learn.query = item.english || item.phraseEnglish || '';
      state.learn.page = 1;
      closeSearchPanel();
      render();
    } catch (error) {
      console.error(`${HOTFIX_VERSION}: could not open search result`, error);
      showToast?.('That search result could not be opened.');
    }
  }

  function restoreSearchFocus(snapshot) {
    requestAnimationFrame(() => {
      const candidates = qsa('input[type="search"]')
        .filter(input => input.id !== 'apsStudySearchInput');
      const input = candidates.find(candidate =>
        (snapshot.id && candidate.id === snapshot.id) ||
        (snapshot.name && candidate.name === snapshot.name) ||
        (
          snapshot.placeholder &&
          candidate.placeholder === snapshot.placeholder
        )
      );
      if (!input) return;
      input.focus();
      try {
        input.setSelectionRange(snapshot.start, snapshot.end);
      } catch {
        // Some search inputs do not expose selection ranges.
      }
    });
  }

  function repairExistingSearch(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type !== 'search') return;
    if (input.id === 'languageSearch' || input.id === 'apsStudySearchInput') {
      return;
    }

    let target = null;
    if (state.tab === 'practice') target = state.practice;
    if (state.tab === 'learn') target = state.learn;
    if (!target) return;

    const value = input.value;
    const snapshot = {
      id: input.id,
      name: input.name,
      placeholder: input.placeholder,
      start: input.selectionStart ?? value.length,
      end: input.selectionEnd ?? value.length
    };

    window.clearTimeout(searchInputTimer);
    searchInputTimer = window.setTimeout(() => {
      target.query = value;
      if (target === state.learn) target.page = 1;
      render();
      restoreSearchFocus(snapshot);
    }, 90);
  }

  function activeSegments() {
    return getActiveSegments();
  }

  function activeSegment() {
    return activeSegments()?.[state.segmentIndex] || null;
  }

  function stopRecognitionWithoutSaving() {
    const recognition = state.speechRecognition;
    state.speechRecognition = null;
    if (!recognition) return;
    try {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.abort();
    } catch {
      // Recognition may already be stopped.
    }
  }

  function stopRecorderWithoutSaving() {
    const recorder = state.recorder;
    state.recorder = null;

    if (recorder) {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // Recorder may already be inactive.
      }
    }

    try {
      state.stream?.getTracks().forEach(track => track.stop());
    } catch {
      // No active stream.
    }

    state.stream = null;
    state.chunks = [];
    state.recording = false;
    state.recordingStartedAt = 0;
    state.speechStartedAt = 0;
    state.countdown = 0;
  }

  function abortCurrentStage() {
    playbackGeneration += 1;
    window.clearInterval(state.timer);
    state.timer = null;
    speechSynthesis.cancel();
    stopRecognitionWithoutSaving();
    stopRecorderWithoutSaving();
    state.playerStatus = 'ready';
  }

  function startAutomaticRecordingCountdown() {
    if (state.dialogueSettings.gap === 'manual') return;
    state.countdown = Number(state.dialogueSettings.gap);
    window.clearInterval(state.timer);
    state.timer = window.setInterval(() => {
      state.countdown -= 1;
      render();
      if (state.countdown <= 0) {
        window.clearInterval(state.timer);
        state.timer = null;
        finishRecording();
      }
    }, 1000);
  }

  async function skipListeningAndRecord() {
    if (!state.dialogue || state.dialogueMode === 'mock') {
      showToast?.('Skip controls are disabled in Mock Test mode.');
      return;
    }
    if (state.recording) {
      showToast?.('Recording is already in progress.');
      return;
    }

    abortCurrentStage();
    clearResponseMedia();
    const segment = activeSegment();
    if (!segment) return;

    state.playerStatus = 'preparing-recording';
    render();
    const ok = await ensureMicrophone();
    if (!ok) {
      state.playerStatus = 'ready';
      render();
      return;
    }

    beginRecording(segment);
    startAutomaticRecordingCountdown();
    showToast?.('Listening skipped. Record your interpretation now.');
  }

  function skippedAssessment() {
    return {
      status: 'skipped',
      coverage: 0,
      deduction: 0,
      captured: [],
      review: [
        'Recording was skipped by the learner. No practice score was generated.'
      ],
      critical: [],
      units: [],
      strengths: [],
      advice: [
        'Replay this segment and record an answer when you want a scored attempt.'
      ]
    };
  }

  function moveAfterSkippedRecording() {
    const segments = activeSegments();
    const index = state.segmentIndex;
    const segment = segments[index];
    if (!segment) return;

    state.responses[index] = {
      segmentId: segment.id,
      skipped: true,
      skipType: 'recording',
      transcript: '',
      transcriptStatus: 'skipped',
      recordingId: '',
      recordingUrl: '',
      recordingStatus: 'skipped',
      recordingMime: '',
      recordingSize: 0,
      showTranscript: false,
      startDelay: 0,
      duration: 0,
      assessment: skippedAssessment()
    };
    state.completed.add(segment.id);

    if (index < segments.length - 1) {
      state.segmentIndex = index + 1;
      state.playerStatus = 'ready';
      state.feedback = null;
      clearResponseMedia();
      render();
      showToast?.('Recording skipped. Moved to the next segment.');
      return;
    }

    state.playerStatus = 'complete';
    state.feedback = null;
    clearResponseMedia();
    render();
    showToast?.(
      'Listening practice complete. Skipped recordings were not scored.'
    );
  }

  function skipRecordingAndContinue() {
    if (!state.dialogue || state.dialogueMode === 'mock') {
      showToast?.('Skip controls are disabled in Mock Test mode.');
      return;
    }
    abortCurrentStage();
    moveAfterSkippedRecording();
  }

  function installPlaybackGuard() {
    if (typeof playDialogueSegment !== 'function') return;

    playDialogueSegment = async function guardedPlayDialogueSegment(
      repeat = false
    ) {
      const segment = activeSegment();
      if (
        !segment ||
        state.playerStatus === 'playing' ||
        state.recording
      ) return;

      const generation = ++playbackGeneration;
      if (repeat) state.repeats += 1;

      clearResponseMedia();
      state.playerStatus = 'playing';
      render();
      speechSynthesis.cancel();

      await speak(
        segment.source,
        segment.sourceLanguage,
        state.dialogueSettings.rate,
        null,
        segment.speaker || 'general'
      );

      if (generation !== playbackGeneration) return;
      await chime();
      if (generation !== playbackGeneration) return;

      state.playerStatus = 'ready';
      const ok = await ensureMicrophone();
      if (!ok || generation !== playbackGeneration) return;

      beginRecording(segment);
      startAutomaticRecordingCountdown();
    };
  }

  function installSkippedScoreGuard() {
    if (typeof assessAndSaveDialogue !== 'function') return;
    const originalAssessAndSaveDialogue = assessAndSaveDialogue;

    assessAndSaveDialogue = function guardedAssessAndSaveDialogue() {
      const skipped = (state.responses || [])
        .filter(response => response?.skipped);

      if (skipped.length) {
        showToast?.(
          `${skipped.length} recording${skipped.length === 1 ? '' : 's'} ` +
          'were skipped. Skipped answers are not scored. Record them before ' +
          'creating a result.'
        );
        return;
      }

      return originalAssessAndSaveDialogue();
    };
  }

  function ensureSkipBar() {
    let bar = qs('#apsDialogueSkipBar');

    const visible = Boolean(
      state.dialogue &&
      state.overlay === 'dialogue' &&
      state.dialogueMode !== 'mock'
    );

    if (!visible) {
      bar?.remove();
      return;
    }

    if (!bar) {
      bar = document.createElement('section');
      bar.id = 'apsDialogueSkipBar';
      bar.className = 'aps-dialogue-skip-bar';
      bar.innerHTML = `
        <div class="aps-dialogue-skip-title">Flexible segment controls</div>
        <div class="aps-dialogue-skip-actions">
          <button
            id="apsSkipListening"
            class="aps-skip-listening"
            type="button"
          >Skip listening → Record now</button>
          <button
            id="apsSkipRecording"
            class="aps-skip-recording"
            type="button"
          >Skip recording → Next segment</button>
        </div>
        <small>Skipped recordings are saved as skipped and never receive a score.</small>
      `;
      document.body.append(bar);

      qs('#apsSkipListening', bar).addEventListener(
        'click',
        skipListeningAndRecord
      );
      qs('#apsSkipRecording', bar).addEventListener(
        'click',
        skipRecordingAndContinue
      );
    }

    const listeningButton = qs('#apsSkipListening', bar);
    const recordingButton = qs('#apsSkipRecording', bar);
    const segments = activeSegments();
    const isLast = state.segmentIndex >= segments.length - 1;

    listeningButton.disabled = Boolean(state.recording);
    listeningButton.textContent = state.playerStatus === 'playing'
      ? 'Stop audio → Record now'
      : state.recording
        ? 'Recording in progress'
        : 'Skip listening → Record now';

    recordingButton.textContent = isLast
      ? 'Skip recording → Finish'
      : 'Skip recording → Next segment';
  }

  function versionParts(value) {
    const parts = safeText(value).match(/\d+/g) || [];
    return parts.map(part => Number(part));
  }

  function isNewerVersion(latest, current) {
    const left = versionParts(latest);
    const right = versionParts(current);
    const length = Math.max(left.length, right.length);

    for (let index = 0; index < length; index += 1) {
      const leftValue = left[index] || 0;
      const rightValue = right[index] || 0;
      if (leftValue > rightValue) return true;
      if (leftValue < rightValue) return false;
    }

    return safeText(latest) !== safeText(current);
  }

  function setUpdateStatus(message, tone = 'neutral') {
    const status = qs('#apsUpdateStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  async function fetchLatestVersion() {
    const separator = VERSION_URL.includes('?') ? '&' : '?';
    const response = await fetch(
      `${VERSION_URL}${separator}t=${Date.now()}`,
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Version check failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || !payload.version) {
      throw new Error('The online version file is invalid.');
    }
    return payload;
  }

  async function waitForControllerChange(timeoutMs = 5000) {
    if (!('serviceWorker' in navigator)) return;

    await new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          finish
        );
        resolve();
      };

      navigator.serviceWorker.addEventListener(
        'controllerchange',
        finish,
        { once: true }
      );
      window.setTimeout(finish, timeoutMs);
    });
  }

  async function clearOnlyAppCaches() {
    if (!('caches' in window)) return [];
    const keys = await caches.keys();
    const appKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    await Promise.all(appKeys.map(key => caches.delete(key)));
    return appKeys;
  }

  async function activateLatestServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.update();

      const worker =
        registration.waiting ||
        registration.installing ||
        registration.active;

      worker?.postMessage?.({ type: 'SKIP_WAITING' });
    }

    await waitForControllerChange();
  }

  function reloadForVersion(version) {
    const url = new URL(window.location.href);
    url.searchParams.set('aps_updated', safeText(version));
    url.searchParams.set('t', String(Date.now()));
    window.location.replace(url.toString());
  }

  async function checkAndUpdateLatestVersion() {
    const button = qs('#apsCheckUpdateButton');
    if (button) button.disabled = true;

    try {
      setUpdateStatus('Checking GitHub for the latest version…');
      const latest = await fetchLatestVersion();
      const latestVersion = safeText(latest.version);

      localStorage.setItem(
        'aps-naati-last-version-check',
        JSON.stringify({
          checkedAt: new Date().toISOString(),
          currentVersion: BUILD_VERSION,
          latestVersion
        })
      );

      if (!isNewerVersion(latestVersion, BUILD_VERSION)) {
        setUpdateStatus(
          `You already have the latest version (${BUILD_VERSION}).`,
          'success'
        );
        return;
      }

      const notes = Array.isArray(latest.releaseNotes)
        ? latest.releaseNotes.filter(Boolean).join(' • ')
        : safeText(latest.releaseNotes);

      setUpdateStatus(
        `Updating ${BUILD_VERSION} → ${latestVersion}` +
        (notes ? ` — ${notes}` : '')
      );

      await clearOnlyAppCaches();
      await activateLatestServiceWorker();

      sessionStorage.setItem(
        'aps-naati-update-complete',
        JSON.stringify({
          version: latestVersion,
          updatedAt: new Date().toISOString()
        })
      );

      setUpdateStatus(
        'Latest files downloaded. Reloading now…',
        'success'
      );
      window.setTimeout(
        () => reloadForVersion(latestVersion),
        500
      );
    } catch (error) {
      console.error(`${HOTFIX_VERSION}: update check failed`, error);
      setUpdateStatus(
        'Update could not be completed. Check the internet connection and try again.',
        'error'
      );
      if (button) button.disabled = false;
    }
  }

  function visibleSettingsContainer() {
    const candidates = qsa(
      '[role="dialog"], .modal, .overlay, .sheet, .settings-panel, aside, main'
    ).filter(element => element.offsetParent !== null);

    return [...candidates].reverse().find(element => {
      const text = safeText(element.textContent).slice(0, 500);
      return /\bsettings\b/i.test(text);
    }) || document.body;
  }

  function settingsAreOpen() {
    try {
      if (state.overlay === 'settings' || state.tab === 'settings') {
        return true;
      }
    } catch {
      // Fall back to visible settings-heading detection.
    }

    return qsa(
      '[role="dialog"], .modal, .overlay, .sheet, .settings-panel, aside'
    ).some(element => (
      element.offsetParent !== null &&
      /\bsettings\b/i.test(safeText(element.textContent).slice(0, 350))
    ));
  }

  function ensureUpdateCard() {
    let card = qs('#apsUpdateCard');

    if (!settingsAreOpen()) {
      card?.remove();
      return;
    }

    const target = visibleSettingsContainer();

    if (!card) {
      card = document.createElement('section');
      card.id = 'apsUpdateCard';
      card.className = 'aps-update-card';
      card.innerHTML = `
        <div class="aps-update-heading">
          <strong>App version</strong>
          <span>${escapeHtml(BUILD_VERSION)}</span>
        </div>
        <p>
          Check GitHub and install the newest files without deleting
          vocabulary progress, dialogue attempts, recordings or other web data.
        </p>
        <button id="apsCheckUpdateButton" type="button">
          Check & update latest version
        </button>
        <div
          id="apsUpdateStatus"
          class="aps-update-status"
          role="status"
          aria-live="polite"
        >Your saved practice data will be preserved.</div>
      `;
      qs('#apsCheckUpdateButton', card).addEventListener(
        'click',
        checkAndUpdateLatestVersion
      );
    }

    if (card.parentElement !== target) {
      target.append(card);
    }

    try {
      const completed = JSON.parse(
        sessionStorage.getItem('aps-naati-update-complete') || 'null'
      );
      if (completed?.version === BUILD_VERSION) {
        setUpdateStatus(
          `Updated successfully to ${BUILD_VERSION}.`,
          'success'
        );
        sessionStorage.removeItem('aps-naati-update-complete');
      }
    } catch {
      // Ignore malformed session status.
    }
  }

  function syncFloatingTools() {
    let ready = false;
    try {
      ready = Boolean(
        state.ready &&
        state.selectedLanguage &&
        state.auth?.initialized
      );
    } catch {
      ready = false;
    }

    const searchShell = qs('#apsStudySearchShell');
    if (ready) {
      ensureSearchShell().hidden = false;
    } else if (searchShell) {
      searchShell.hidden = true;
    }

    try {
      ensureSkipBar();
    } catch (error) {
      console.error(`${HOTFIX_VERSION}: skip-bar sync failed`, error);
    }

    try {
      ensureUpdateCard();
    } catch (error) {
      console.error(`${HOTFIX_VERSION}: update-card sync failed`, error);
    }
  }

  document.addEventListener('input', repairExistingSearch, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSearchPanel();
  });

  installPlaybackGuard();
  installSkippedScoreGuard();

  const observer = new MutationObserver(syncFloatingTools);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.setInterval(syncFloatingTools, 500);
  window.addEventListener('load', syncFloatingTools);
  syncFloatingTools();

  console.info(`${HOTFIX_VERSION} loaded`);
})();
