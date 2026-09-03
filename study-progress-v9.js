'use strict';

(() => {
  const TRACKER_VERSION = 'aps-naati-practice-history-recall-v9';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const ACTIVE_TICK_SECONDS = 30;
  const ACTIVE_FLUSH_SECONDS = 300;
  const ACTIVE_IDLE_MS = 2 * 60 * 1000;

  const STAGES = [
    { id: '1d', label: '1 Day', days: 1 },
    { id: '1w', label: '1 Week', days: 7 },
    { id: '2w', label: '2 Weeks', days: 14 },
    { id: '4w', label: '4 Weeks', days: 28 },
  ];

  if (typeof setLanguageScopedStorageKeys === 'function') setLanguageScopedStorageKeys(typeof activeLanguageId === 'function' ? activeLanguageId() : 'hi');
  else {
    storageKeys.practiceDaily = 'apsPracticeDailyV9';
    storageKeys.recallProgress = 'apsRecallProgressV9';
    storageKeys.recallSettings = 'apsRecallSettingsV9';
  }

  const DEVICE_KEY = 'apsPracticeDeviceIdV9';
  const scopedTrackerKey = base => { const id = typeof activeLanguageId === 'function' ? activeLanguageId() : 'hi'; return id === 'hi' ? base : `${base}:${id}`; };
  const REMINDER_STATE_KEY = () => scopedTrackerKey('apsRecallReminderStateV9');
  const SEED_KEY = () => scopedTrackerKey('apsRecallSeededV9');

  const tracker = {
    lastActivityAt: Date.now(),
    pendingActiveSeconds: 0,
    userActivated: false,
    normalSeen: new Set(),
    segmentSeen: new Set(),
    activeRecallSession: null,
    activeDialogueRecall: null,
    lastProgressSignature: '',
    lastSettingsSignature: '',
    reminderTimer: 0,
  };

  const esc9 = value => safeText(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  function safeText(value) {
    return String(value == null ? '' : value);
  }

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function isoNow() { return new Date().toISOString(); }

  function localDayKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function localDateFromKey(key) {
    const [year, month, day] = safeText(key).split('-').map(Number);
    return new Date(year, Math.max(0, month - 1), day || 1, 12, 0, 0, 0);
  }

  function addDays(value, days) {
    const date = new Date(value);
    return new Date(date.getTime() + Number(days || 0) * DAY_MS).toISOString();
  }

  function formatDuration(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    if (minutes) return `${minutes}m`;
    return value ? '<1m' : '0m';
  }

  function relativeDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Not scheduled';
    const delta = date.getTime() - Date.now();
    const days = Math.ceil(Math.abs(delta) / DAY_MS);
    if (delta <= 0) return days <= 1 ? 'Due now' : `${days} days overdue`;
    if (days <= 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  }

  function deviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (id) return id;
    id = window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  }

  function practiceRows() {
    return safeParse(localStorage.getItem(storageKeys.practiceDaily), []) || [];
  }

  function writePracticeRows(rows) {
    const cutoff = Date.now() - 120 * DAY_MS;
    const kept = rows
      .filter(row => localDateFromKey(row?.date || '').getTime() >= cutoff)
      .sort((a, b) => safeText(a.date).localeCompare(safeText(b.date)))
      .slice(-500);
    localStorage.setItem(storageKeys.practiceDaily, JSON.stringify(kept));
  }

  function updateToday(mutator) {
    const rows = practiceRows();
    const date = localDayKey();
    const id = `${deviceId()}|${date}`;
    let row = rows.find(item => item.id === id);
    if (!row) {
      row = {
        id,
        deviceId: deviceId(),
        date,
        activeSeconds: 0,
        vocabulary: 0,
        phrases: 0,
        dialoguePractices: 0,
        segments: 0,
        recall: 0,
        scoreLowTotal: 0,
        scoreHighTotal: 0,
        scoreCount: 0,
        updatedAt: isoNow(),
      };
      rows.push(row);
    }
    mutator(row);
    row.updatedAt = isoNow();
    writePracticeRows(rows);
  }

  function flushActiveTime() {
    if (tracker.pendingActiveSeconds <= 0) return;
    const seconds = tracker.pendingActiveSeconds;
    tracker.pendingActiveSeconds = 0;
    updateToday(row => {
      row.activeSeconds = (Number(row.activeSeconds) || 0) + seconds;
    });
  }

  function appIsActivelyStudying() {
    try {
      return Boolean(
        state.vocabPlayer?.playing ||
        state.recording ||
        state.lesson?.playing ||
        state.playerStatus === 'playing'
      );
    } catch { return false; }
  }

  function activeTimeTick() {
    if (document.visibilityState !== 'visible') return;
    const recentlyActive = Date.now() - tracker.lastActivityAt <= ACTIVE_IDLE_MS;
    if (!recentlyActive && !appIsActivelyStudying()) return;
    tracker.pendingActiveSeconds += ACTIVE_TICK_SECONDS;
    if (tracker.pendingActiveSeconds >= ACTIVE_FLUSH_SECONDS) flushActiveTime();
  }

  function markActivity() {
    tracker.lastActivityAt = Date.now();
    tracker.userActivated = true;
  }

  function recordDailyPractice(kind) {
    updateToday(row => {
      if (kind === 'word') row.vocabulary = (Number(row.vocabulary) || 0) + 1;
      if (kind === 'phrase') row.phrases = (Number(row.phrases) || 0) + 1;
    });
  }

  function recordDailySegment() {
    updateToday(row => {
      row.segments = (Number(row.segments) || 0) + 1;
    });
  }

  function recordDailyRecall() {
    updateToday(row => {
      row.recall = (Number(row.recall) || 0) + 1;
    });
  }

  function recordDailyDialogueAttempt(attempt) {
    updateToday(row => {
      row.dialoguePractices = (Number(row.dialoguePractices) || 0) + 1;
      const low = Number(attempt?.report?.low);
      const high = Number(attempt?.report?.high);
      if (Number.isFinite(low) && Number.isFinite(high)) {
        row.scoreLowTotal = (Number(row.scoreLowTotal) || 0) + low;
        row.scoreHighTotal = (Number(row.scoreHighTotal) || 0) + high;
        row.scoreCount = (Number(row.scoreCount) || 0) + 1;
      }
    });
  }

  function recallSettings() {
    const saved = safeParse(localStorage.getItem(storageKeys.recallSettings), {}) || {};
    return {
      intervals: {
        '1d': saved.intervals?.['1d'] !== false,
        '1w': saved.intervals?.['1w'] !== false,
        '2w': saved.intervals?.['2w'] !== false,
        '4w': saved.intervals?.['4w'] !== false,
      },
      reminderEnabled: saved.reminderEnabled !== false,
      reminderTime: /^\d{2}:\d{2}$/.test(saved.reminderTime || '') ? saved.reminderTime : '19:00',
      sound: saved.sound !== false,
      browserNotifications: saved.browserNotifications === true,
      updatedAt: saved.updatedAt || '',
    };
  }

  function saveRecallSettings(next) {
    const settings = {
      ...recallSettings(),
      ...next,
      intervals: {
        ...recallSettings().intervals,
        ...(next?.intervals || {}),
      },
      updatedAt: isoNow(),
    };
    localStorage.setItem(storageKeys.recallSettings, JSON.stringify(settings));
    reconcileRecallSchedules();
    return settings;
  }

  function enabledStages() {
    const settings = recallSettings();
    return STAGES.filter(stage => settings.intervals[stage.id]);
  }

  function recallMap() {
    return safeParse(localStorage.getItem(storageKeys.recallProgress), {}) || {};
  }

  function writeRecallMap(map) {
    localStorage.setItem(storageKeys.recallProgress, JSON.stringify(map || {}));
  }

  function recallKey(type, id) { return `${type}:${id}`; }

  function firstEnabledStageAfter(stageId = '') {
    const currentIndex = STAGES.findIndex(stage => stage.id === stageId);
    const settings = recallSettings();
    for (let index = Math.max(0, currentIndex + 1); index < STAGES.length; index += 1) {
      if (settings.intervals[STAGES[index].id]) return STAGES[index];
    }
    return null;
  }

  function firstEnabledStage() {
    const settings = recallSettings();
    return STAGES.find(stage => settings.intervals[stage.id]) || null;
  }

  function scheduleAfterPractice(type, id, practisedAt = isoNow()) {
    if (!id) return;
    const first = firstEnabledStage();
    const map = recallMap();
    const key = recallKey(type, id);
    map[key] = {
      type,
      id,
      stage: first?.id || '',
      dueAt: first ? addDays(practisedAt, first.days) : '',
      anchorAt: practisedAt,
      lastActionAt: practisedAt,
      completedStages: [],
      updatedAt: isoNow(),
    };
    writeRecallMap(map);
  }

  function completeRecallStage(type, id, stageId, completedAt = isoNow()) {
    const map = recallMap();
    const key = recallKey(type, id);
    const record = map[key];
    if (!record) return false;

    const completed = new Set(record.completedStages || []);
    if (stageId) completed.add(stageId);
    const next = firstEnabledStageAfter(stageId || record.stage);
    map[key] = {
      ...record,
      stage: next?.id || '',
      dueAt: next ? addDays(completedAt, next.days) : '',
      lastActionAt: completedAt,
      completedStages: [...completed],
      updatedAt: isoNow(),
    };
    writeRecallMap(map);
    recordDailyRecall();
    return true;
  }

  function reconcileRecallSchedules() {
    const map = recallMap();
    const settings = recallSettings();
    let changed = false;

    for (const [key, record] of Object.entries(map)) {
      if (!record?.id || !record?.type) continue;
      if (record.stage && settings.intervals[record.stage]) continue;
      const completed = new Set(record.completedStages || []);
      const currentIndex = Math.max(-1, STAGES.findIndex(stage => stage.id === record.stage));
      let next = null;
      for (let index = currentIndex + 1; index < STAGES.length; index += 1) {
        const stage = STAGES[index];
        if (settings.intervals[stage.id] && !completed.has(stage.id)) {
          next = stage;
          break;
        }
      }
      if (!next && currentIndex < 0) {
        next = STAGES.find(stage => settings.intervals[stage.id] && !completed.has(stage.id)) || null;
      }
      map[key] = {
        ...record,
        stage: next?.id || '',
        dueAt: next ? addDays(record.lastActionAt || record.anchorAt || isoNow(), next.days) : '',
        updatedAt: isoNow(),
      };
      changed = true;
    }

    if (changed) writeRecallMap(map);
  }

  function dueRecords(type, stageId, { includeUpcoming = false } = {}) {
    const now = Date.now();
    return Object.values(recallMap())
      .filter(record => record?.type === type && record.stage === stageId && record.dueAt)
      .filter(record => includeUpcoming || Date.parse(record.dueAt) <= now)
      .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  }

  function scheduledCount(type, stageId) {
    return dueRecords(type, stageId, { includeUpcoming: true }).length;
  }

  function dueTotal() {
    return STAGES.reduce((total, stage) => total
      + dueRecords('word', stage.id).length
      + dueRecords('phrase', stage.id).length
      + dueRecords('dialogue', stage.id).length, 0);
  }

  function seedExistingTimedPractice() {
    if (localStorage.getItem(SEED_KEY()) === '1') return;
    const map = recallMap();
    const first = firstEnabledStage();
    if (first) {
      const phraseStats = getJSON(storageKeys.phraseStats, {});
      for (const [id, item] of Object.entries(phraseStats || {})) {
        if (!item?.lastPractisedAt || map[recallKey('phrase', id)]) continue;
        const at = item.lastPractisedAt;
        map[recallKey('phrase', id)] = {
          type: 'phrase', id, stage: first.id,
          dueAt: addDays(at, first.days), anchorAt: at, lastActionAt: at,
          completedStages: [], updatedAt: isoNow(),
        };
      }

      const stats = dialogueStatsMap();
      for (const [id, item] of Object.entries(stats || {})) {
        if (!item?.lastPractisedAt || map[recallKey('dialogue', id)]) continue;
        const at = item.lastPractisedAt;
        map[recallKey('dialogue', id)] = {
          type: 'dialogue', id, stage: first.id,
          dueAt: addDays(at, first.days), anchorAt: at, lastActionAt: at,
          completedStages: [], updatedAt: isoNow(),
        };
      }
    }
    writeRecallMap(map);
    localStorage.setItem(SEED_KEY(), '1');
  }

  function itemKind(id) {
    if (state.vocab?.some(item => item.id === id)) return 'word';
    if (state.phrases?.some(item => item.id === id)) return 'phrase';
    return '';
  }

  function recordNormalItemEncounter(id, explicitKind = '') {
    const type = explicitKind || itemKind(id);
    if (!type || !id) return;
    const key = `${type}:${id}`;
    if (tracker.normalSeen.has(key)) return;
    tracker.normalSeen.add(key);
    recordDailyPractice(type);
    scheduleAfterPractice(type, id);
  }

  function recordRecallItemEncounter(id, type) {
    const session = tracker.activeRecallSession;
    if (!session || session.type !== type || !session.ids.has(id)) return;
    const key = `recall:${type}:${id}`;
    if (session.seen.has(key)) return;
    session.seen.add(key);
    recordDailyPractice(type);
  }

  function currentVocabularyId() {
    return state.vocabPlayer?.queue?.[state.vocabPlayer.index] || '';
  }

  function recordCurrentVocabularyEncounter() {
    const id = currentVocabularyId();
    if (!id) return;
    const type = itemKind(id);
    if (!type) return;
    if (tracker.activeRecallSession) recordRecallItemEncounter(id, type);
    else recordNormalItemEncounter(id, type);
  }

  function completeCurrentRecallItem() {
    const session = tracker.activeRecallSession;
    const id = currentVocabularyId();
    if (!session || !id || !session.pending.has(id)) return false;
    recordRecallItemEncounter(id, session.type);
    completeRecallStage(session.type, id, session.stage);
    session.pending.delete(id);
    return true;
  }

  function orderedDueIds(type, stageId) {
    const due = new Set(dueRecords(type, stageId).map(record => record.id));
    const source = type === 'word' ? state.vocab : state.phrases;
    let ids = (source || []).map(item => item.id).filter(id => due.has(id));
    if (state.vocabSettings?.order === 'random' && typeof shufflePlaylistIds === 'function') {
      ids = shufflePlaylistIds(ids);
    }
    return ids;
  }

  function startRecallList(type, stageId) {
    const ids = orderedDueIds(type, stageId);
    if (!ids.length) {
      showToast?.('Nothing is due in this recall list.');
      return;
    }
    tracker.normalSeen.clear();
    tracker.activeRecallSession = {
      type,
      stage: stageId,
      ids: new Set(ids),
      pending: new Set(ids),
      seen: new Set(),
    };
    const stage = STAGES.find(item => item.id === stageId);
    const typeLabel = type === 'word' ? 'Vocabulary' : 'Phrases';
    Object.assign(state.vocabPlayer, {
      queue: ids,
      index: 0,
      playing: false,
      token: (state.vocabPlayer.token || 0) + 1,
      gapRemaining: 0,
      title: `${typeLabel} · ${stage?.label || ''} Recall`,
      revealCurrent: false,
    });
    state.modal = null;
    state.overlay = 'vocab-player';
    render();
  }

  function startDialogueRecall(id, stageId) {
    const record = recallMap()[recallKey('dialogue', id)];
    if (!record || record.stage !== stageId || Date.parse(record.dueAt || '') > Date.now()) {
      showToast?.('This dialogue is no longer due in that recall list.');
      return;
    }
    tracker.activeDialogueRecall = { id, stage: stageId };
    tracker.segmentSeen.clear();
    originalOpenDialogue(id, 'practice');
  }

  function recordSegmentPractice(segmentId) {
    if (!segmentId) return;
    const sessionKey = `${state.dialogue?.id || ''}:${segmentId}`;
    if (tracker.segmentSeen.has(sessionKey)) return;
    tracker.segmentSeen.add(sessionKey);
    recordDailySegment();
  }

  function aggregateDays() {
    flushActiveTime();
    const map = new Map();
    for (const row of practiceRows()) {
      if (!row?.date) continue;
      const day = map.get(row.date) || {
        date: row.date,
        activeSeconds: 0,
        vocabulary: 0,
        phrases: 0,
        dialoguePractices: 0,
        segments: 0,
        recall: 0,
        scoreLowTotal: 0,
        scoreHighTotal: 0,
        scoreCount: 0,
      };
      for (const key of ['activeSeconds','vocabulary','phrases','dialoguePractices','segments','recall','scoreLowTotal','scoreHighTotal','scoreCount']) {
        day[key] += Number(row[key]) || 0;
      }
      map.set(row.date, day);
    }
    return map;
  }

  function lastNDays(count = 7) {
    const map = aggregateDays();
    const rows = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let offset = 0; offset < count; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const key = localDayKey(date);
      rows.push(map.get(key) || {
        date: key, activeSeconds: 0, vocabulary: 0, phrases: 0,
        dialoguePractices: 0, segments: 0, recall: 0,
        scoreLowTotal: 0, scoreHighTotal: 0, scoreCount: 0,
      });
    }
    return rows;
  }

  function dayHasPractice(day) {
    return (Number(day.activeSeconds) || 0) >= 60
      || (Number(day.vocabulary) || 0) > 0
      || (Number(day.phrases) || 0) > 0
      || (Number(day.dialoguePractices) || 0) > 0
      || (Number(day.segments) || 0) > 0
      || (Number(day.recall) || 0) > 0;
  }

  function studyStreak() {
    const map = aggregateDays();
    let streak = 0;
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    for (let index = 0; index < 365; index += 1) {
      const key = localDayKey(date);
      const day = map.get(key);
      if (!day || !dayHasPractice(day)) break;
      streak += 1;
      date.setDate(date.getDate() - 1);
    }
    return streak;
  }

  function avgScore(day) {
    if (!Number(day.scoreCount)) return '—';
    const low = Math.round(day.scoreLowTotal / day.scoreCount);
    const high = Math.round(day.scoreHighTotal / day.scoreCount);
    return `${low}–${high}/45`;
  }

  function stageCards(type) {
    const settings = recallSettings();
    return STAGES.map(stage => {
      const enabled = settings.intervals[stage.id];
      const due = enabled ? dueRecords(type, stage.id).length : 0;
      const scheduled = enabled ? scheduledCount(type, stage.id) : 0;
      return `<article class="aps-recall-stage ${enabled ? '' : 'is-off'}">
        <div><small>${esc9(stage.label.toUpperCase())} RECALL</small><strong>${enabled ? due : 'Off'}</strong><span>${enabled ? `${due} due · ${scheduled} scheduled` : 'Disabled in Settings'}</span></div>
        <button type="button" data-study-action="start-recall" data-study-type="${type}" data-study-stage="${stage.id}" ${!enabled || !due ? 'disabled' : ''}>${due ? 'Start' : 'Nothing due'}</button>
      </article>`;
    }).join('');
  }

  function dialogueRecallLists() {
    const settings = recallSettings();
    const records = recallMap();
    return STAGES.map(stage => {
      if (!settings.intervals[stage.id]) {
        return `<section class="aps-dialogue-recall-group is-off"><header><div><small>${stage.label.toUpperCase()} RECALL</small><h4>Dialogue recall</h4></div><span>Off</span></header></section>`;
      }
      const due = dueRecords('dialogue', stage.id);
      const rows = due.map(record => {
        const dialogue = state.dialogues.find(item => item.id === record.id);
        if (!dialogue) return '';
        return `<article class="aps-dialogue-recall-item"><div><strong>${esc9(dialogue.title)}</strong><small>${esc9(topicLabels[dialogue.topic] || 'Community')} · ${esc9(relativeDate(record.dueAt))}</small></div><button type="button" data-study-action="start-dialogue-recall" data-dialogue-id="${esc9(dialogue.id)}" data-study-stage="${stage.id}">Start</button></article>`;
      }).join('');
      const scheduled = scheduledCount('dialogue', stage.id);
      return `<section class="aps-dialogue-recall-group"><header><div><small>${stage.label.toUpperCase()} RECALL</small><h4>Dialogue recall</h4></div><span>${due.length} due · ${scheduled} scheduled</span></header>${rows || '<p class="aps-study-muted">No dialogue is due in this stage.</p>'}</section>`;
    }).join('');
  }

  function progressPanelHtml() {
    const seven = lastNDays(7);
    const today = seven[0];
    const totals = seven.reduce((sum, day) => {
      for (const key of ['activeSeconds','vocabulary','phrases','dialoguePractices','segments','recall','scoreLowTotal','scoreHighTotal','scoreCount']) {
        sum[key] += Number(day[key]) || 0;
      }
      return sum;
    }, { activeSeconds:0,vocabulary:0,phrases:0,dialoguePractices:0,segments:0,recall:0,scoreLowTotal:0,scoreHighTotal:0,scoreCount:0 });
    const rows = seven.map((day, index) => `<tr>
      <td><strong>${index === 0 ? 'Today' : localDateFromKey(day.date).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}</strong></td>
      <td>${formatDuration(day.activeSeconds)}</td>
      <td>${day.dialoguePractices}</td>
      <td>${day.segments}</td>
      <td>${day.vocabulary}</td>
      <td>${day.phrases}</td>
      <td>${day.recall}</td>
      <td>${avgScore(day)}</td>
    </tr>`).join('');

    return `<section id="apsPracticeHistoryRecall" class="aps-practice-history-recall">
      <div class="aps-study-section-heading"><div><small>DAILY PRACTICE</small><h2>Today and your last 7 days</h2><p>Practice time and learning activity are recorded day by day and can sync with your signed-in account.</p></div><span class="aps-streak">🔥 ${studyStreak()} day streak</span></div>
      <section class="aps-study-summary-grid">
        <article><small>TODAY</small><strong>${formatDuration(today.activeSeconds)}</strong><span>study time</span></article>
        <article><small>TODAY</small><strong>${today.vocabulary + today.phrases}</strong><span>vocabulary + phrase practices</span></article>
        <article><small>TODAY</small><strong>${today.segments}</strong><span>segments practised</span></article>
        <article><small>LAST 7 DAYS</small><strong>${formatDuration(totals.activeSeconds)}</strong><span>study time</span></article>
        <article><small>LAST 7 DAYS</small><strong>${totals.dialoguePractices}</strong><span>dialogue practices</span></article>
        <article><small>LAST 7 DAYS</small><strong>${totals.recall}</strong><span>recall items completed</span></article>
      </section>
      <div class="aps-practice-table-wrap"><table class="aps-practice-table"><thead><tr><th>Day</th><th>Time</th><th>Dialogues</th><th>Segments</th><th>Vocabulary</th><th>Phrases</th><th>Recall</th><th>Avg score</th></tr></thead><tbody>${rows}</tbody></table></div>

      <div class="aps-study-section-heading aps-recall-heading"><div><small>SPACED RECALL</small><h2>Recall due</h2><p>Each enabled stage has its own list. Completing a recall stage schedules the next enabled stage.</p></div><span class="aps-due-total">${dueTotal()} due now</span></div>
      <div class="aps-recall-library-grid">
        <section class="aps-recall-library"><header><div><small>VOCABULARY</small><h3>Vocabulary recall</h3></div><span>${state.vocab.length.toLocaleString()} items</span></header><div class="aps-recall-stage-grid">${stageCards('word')}</div></section>
        <section class="aps-recall-library"><header><div><small>PHRASES</small><h3>Phrase recall</h3></div><span>${state.phrases.length.toLocaleString()} items</span></header><div class="aps-recall-stage-grid">${stageCards('phrase')}</div></section>
      </div>
      <section class="aps-recall-library aps-dialogue-recall-library"><header><div><small>DIALOGUES</small><h3>Dialogue recall</h3><p>Dialogues stay as complete dialogues. Start directly from the due list.</p></div><span>${state.dialogues.length} dialogues</span></header><div class="aps-dialogue-recall-groups">${dialogueRecallLists()}</div></section>
      <p class="aps-study-footnote">Vocabulary recall scheduling begins as you practise in v9. Existing phrase and dialogue timestamps are imported when available.</p>
    </section>`;
  }

  function progressSignature() {
    if (state.tab !== 'progress' || state.overlay) return '';
    return [
      localStorage.getItem(storageKeys.practiceDaily) || '',
      localStorage.getItem(storageKeys.recallProgress) || '',
      localStorage.getItem(storageKeys.recallSettings) || '',
      state.vocab?.length || 0,
      state.phrases?.length || 0,
      state.dialogues?.length || 0,
    ].join('|');
  }

  function ensureProgressPanel() {
    if (state.tab !== 'progress' || state.overlay) return;
    const page = document.querySelector('main.page');
    if (!page) return;
    flushActiveTime();
    const signature = progressSignature();
    const existing = document.querySelector('#apsPracticeHistoryRecall');
    if (existing && signature === tracker.lastProgressSignature) return;
    existing?.remove();
    const host = document.createElement('div');
    host.innerHTML = progressPanelHtml();
    const panel = host.firstElementChild;
    const firstExistingCard = page.querySelector('.progress-stats');
    if (firstExistingCard?.nextSibling) page.insertBefore(panel, firstExistingCard.nextSibling);
    else page.append(panel);
    tracker.lastProgressSignature = signature;
  }

  function settingsCardHtml() {
    const settings = recallSettings();
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    return `<section id="apsRecallSettingsCard" class="aps-recall-settings-card">
      <div class="aps-recall-settings-head"><div><small>STUDY REMINDERS</small><h3>Recall schedule</h3></div><span>${dueTotal()} due</span></div>
      <p>Choose the recall stages you want. Vocabulary and phrases get separate lists; dialogues stay as complete dialogue recalls.</p>
      <div class="aps-recall-setting-grid">
        ${STAGES.map(stage => `<label class="aps-recall-check"><input type="checkbox" data-recall-stage="${stage.id}" ${settings.intervals[stage.id] ? 'checked' : ''}><span><b>${stage.label}</b><small>Recall stage</small></span></label>`).join('')}
      </div>
      <div class="aps-reminder-row">
        <label><span>Daily reminder</span><input id="apsRecallReminderEnabled" type="checkbox" ${settings.reminderEnabled ? 'checked' : ''}></label>
        <label><span>Reminder time</span><input id="apsRecallReminderTime" type="time" value="${esc9(settings.reminderTime)}" ${settings.reminderEnabled ? '' : 'disabled'}></label>
        <label><span>Sound</span><input id="apsRecallReminderSound" type="checkbox" ${settings.sound ? 'checked' : ''}></label>
      </div>
      <div class="aps-reminder-actions">
        <button type="button" data-study-action="notification-permission" class="secondary">${permission === 'granted' ? 'Notifications enabled' : permission === 'denied' ? 'Notifications blocked' : 'Enable notifications'}</button>
        <button type="button" data-study-action="test-reminder" class="secondary">▶ Test reminder</button>
      </div>
      <p class="aps-reminder-note">The GitHub version can play a sound and show a browser notification while the app is open. Fully scheduled alerts while the app is closed require background push support.</p>
    </section>`;
  }

  function ensureSettingsCard() {
    const modal = document.querySelector('.app-settings-modal');
    if (!modal) return;
    const signature = localStorage.getItem(storageKeys.recallSettings) || '';
    const existing = document.querySelector('#apsRecallSettingsCard');
    if (existing && signature === tracker.lastSettingsSignature) return;
    existing?.remove();
    const holder = document.createElement('div');
    holder.innerHTML = settingsCardHtml();
    const card = holder.firstElementChild;
    const actions = modal.querySelector('.settings-actions');
    if (actions) modal.insertBefore(card, actions);
    else modal.append(card);
    tracker.lastSettingsSignature = signature;
  }

  async function playReminderChime() {
    if (!recallSettings().sound || !tracker.userActivated) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
      gain.connect(ctx.destination);
      for (const [offset, frequency] of [[0, 660], [0.22, 880]]) {
        const oscillator = ctx.createOscillator();
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(ctx.currentTime + offset);
        oscillator.stop(ctx.currentTime + offset + 0.28);
      }
      window.setTimeout(() => ctx.close().catch(() => {}), 900);
    } catch {}
  }

  async function showReminderNotification(body) {
    const settings = recallSettings();
    if (!settings.browserNotifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration?.showNotification) {
        await registration.showNotification('APS NAATI Recall', {
          body,
          tag: `aps-naati-recall-${localDayKey()}`,
          icon: './icon-192.png',
          badge: './icon-192.png',
        });
      } else {
        new Notification('APS NAATI Recall', { body, icon: './icon-192.png' });
      }
    } catch {}
  }

  async function testReminder() {
    tracker.userActivated = true;
    await playReminderChime();
    if (recallSettings().browserNotifications && Notification.permission === 'granted') {
      await showReminderNotification('Test successful — your recall reminder is ready.');
    }
    showToast?.('Reminder sound tested');
  }

  async function requestNotifications() {
    if (!('Notification' in window)) {
      showToast?.('Browser notifications are not supported on this device.');
      return;
    }
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    saveRecallSettings({ browserNotifications: permission === 'granted' });
    tracker.lastSettingsSignature = '';
    ensureSettingsCard();
    showToast?.(permission === 'granted' ? 'Notifications enabled' : 'Notification permission was not granted');
  }

  async function reminderCheck({ force = false } = {}) {
    const settings = recallSettings();
    if (!settings.reminderEnabled && !force) return;
    const due = dueTotal();
    if (!due && !force) return;
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (!force && current < settings.reminderTime) return;
    const stateValue = safeParse(localStorage.getItem(REMINDER_STATE_KEY()), {}) || {};
    if (!force && stateValue.lastNotifiedDate === localDayKey()) return;
    if (!force) localStorage.setItem(REMINDER_STATE_KEY(), JSON.stringify({ lastNotifiedDate: localDayKey(), updatedAt: isoNow() }));
    const body = force ? 'Test successful — your recall reminder is ready.' : `${due} recall item${due === 1 ? '' : 's'} are due today.`;
    await playReminderChime();
    await showReminderNotification(body);
    if (!force) showToast?.(body);
  }

  function handleStudyAction(button) {
    const action = button.dataset.studyAction;
    if (action === 'start-recall') {
      startRecallList(button.dataset.studyType, button.dataset.studyStage);
      return true;
    }
    if (action === 'start-dialogue-recall') {
      startDialogueRecall(button.dataset.dialogueId, button.dataset.studyStage);
      return true;
    }
    if (action === 'notification-permission') {
      requestNotifications();
      return true;
    }
    if (action === 'test-reminder') {
      testReminder();
      return true;
    }
    return false;
  }

  function bindSettingsChanges(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.matches('[data-recall-stage]')) {
      const id = target.dataset.recallStage;
      saveRecallSettings({ intervals: { [id]: target.checked } });
      tracker.lastSettingsSignature = '';
      tracker.lastProgressSignature = '';
      ensureSettingsCard();
      ensureProgressPanel();
      return;
    }
    if (target.id === 'apsRecallReminderEnabled') {
      saveRecallSettings({ reminderEnabled: target.checked });
      tracker.lastSettingsSignature = '';
      ensureSettingsCard();
      return;
    }
    if (target.id === 'apsRecallReminderTime') {
      saveRecallSettings({ reminderTime: target.value || '19:00' });
      return;
    }
    if (target.id === 'apsRecallReminderSound') {
      saveRecallSettings({ sound: target.checked });
    }
  }

  const originalSetItemStatus = setItemStatus;
  setItemStatus = function trackedSetItemStatus(id, status) {
    if (tracker.activeRecallSession) recordRecallItemEncounter(id, itemKind(id));
    else recordNormalItemEncounter(id);
    return originalSetItemStatus(id, status);
  };

  const originalStartVocabularyPlaylist = startVocabularyPlaylist;
  startVocabularyPlaylist = function trackedStartVocabularyPlaylist(...args) {
    tracker.normalSeen.clear();
    tracker.activeRecallSession = null;
    return originalStartVocabularyPlaylist(...args);
  };

  const originalSpeakVocabItem = speakVocabItem;
  speakVocabItem = async function trackedSpeakVocabItem(...args) {
    recordCurrentVocabularyEncounter();
    return originalSpeakVocabItem(...args);
  };

  const originalMoveVocab = moveVocab;
  moveVocab = function trackedMoveVocab(delta, rerender = true) {
    if (Number(delta) > 0) {
      if (tracker.activeRecallSession) {
        completeCurrentRecallItem();
        if (tracker.activeRecallSession && tracker.activeRecallSession.pending.size === 0) {
          state.vocabPlayer.playing = false;
          state.vocabPlayer.token += 1;
          speechSynthesis.cancel();
          const finished = tracker.activeRecallSession;
          tracker.activeRecallSession = null;
          if (rerender) render();
          window.setTimeout(() => showToast?.(`${finished.type === 'word' ? 'Vocabulary' : 'Phrase'} recall list complete`), 0);
          return;
        }
      } else {
        recordCurrentVocabularyEncounter();
      }
    }
    return originalMoveVocab(delta, rerender);
  };

  const originalStepVocab = stepVocab;
  stepVocab = async function trackedStepVocab(delta) {
    if (Number(delta) > 0 && tracker.activeRecallSession) {
      const currentId = currentVocabularyId();
      if (tracker.activeRecallSession.pending.has(currentId) && tracker.activeRecallSession.pending.size === 1) {
        completeCurrentRecallItem();
        const finished = tracker.activeRecallSession;
        tracker.activeRecallSession = null;
        state.vocabPlayer.playing = false;
        state.vocabPlayer.token += 1;
        speechSynthesis.cancel();
        state.overlay = null;
        state.tab = 'progress';
        render();
        window.setTimeout(() => showToast?.(`${finished.type === 'word' ? 'Vocabulary' : 'Phrase'} recall list complete`), 0);
        return;
      }
    }
    return originalStepVocab(delta);
  };

  const originalOpenDialogue = openDialogue;
  openDialogue = function trackedOpenDialogue(...args) {
    tracker.activeDialogueRecall = null;
    tracker.segmentSeen.clear();
    return originalOpenDialogue(...args);
  };

  const originalFinishRecording = finishRecording;
  finishRecording = async function trackedFinishRecording(...args) {
    const index = state.segmentIndex;
    const segment = getActiveSegments?.()?.[index];
    const result = await originalFinishRecording(...args);
    if (segment && state.responses?.[index]) recordSegmentPractice(segment.id);
    return result;
  };

  const originalAssessAndSaveDialogue = assessAndSaveDialogue;
  assessAndSaveDialogue = function trackedAssessAndSaveDialogue(...args) {
    const before = getJSON(storageKeys.attempts, []).length;
    const dialogueId = state.dialogue?.id || '';
    const result = originalAssessAndSaveDialogue(...args);
    const attempts = getJSON(storageKeys.attempts, []);
    if (attempts.length > before) {
      const attempt = attempts.at(-1);
      recordDailyDialogueAttempt(attempt);
      for (const response of attempt?.responses || []) {
        if (response?.segmentId) recordSegmentPractice(response.segmentId);
      }
      if (tracker.activeDialogueRecall?.id === dialogueId) {
        completeRecallStage('dialogue', dialogueId, tracker.activeDialogueRecall.stage);
        tracker.activeDialogueRecall = null;
      } else {
        scheduleAfterPractice('dialogue', dialogueId, attempt?.finishedAt || isoNow());
      }
    }
    return result;
  };

  function patchSkipControls() {
    const controls = window.APSStudyControls;
    if (!controls || controls.__apsV9Tracked) return;
    const originalSkipRecording = controls.skipRecordingAndContinue;
    if (typeof originalSkipRecording === 'function') {
      controls.skipRecordingAndContinue = (...args) => {
        const segment = getActiveSegments?.()?.[state.segmentIndex];
        if (segment) recordSegmentPractice(segment.id);
        return originalSkipRecording(...args);
      };
    }
    controls.__apsV9Tracked = true;
  }

  const originalBackupProgress = backupProgress;
  backupProgress = function trackedBackupProgress() {
    flushActiveTime();
    const data = {
      version: '2.0.9-v9',
      createdAt: new Date().toISOString(),
      vocabStatus: getJSON(storageKeys.vocabStatus, {}),
      vocabSettings: state.vocabSettings,
      vocabResume: getJSON(storageKeys.vocabResume, {}),
      phraseStats: getJSON(storageKeys.phraseStats, {}),
      dialogueVocabProgress: getJSON(storageKeys.dialogueVocabProgress, {}),
      myVocabs: getJSON(storageKeys.myVocabs, { schemaVersion: 1, items: {} }),
      attempts: getJSON(storageKeys.attempts, []),
      lesson: getJSON(storageKeys.lesson, {}),
      mistakes: getJSON(storageKeys.mistakes, []),
      practiceDaily: practiceRows(),
      recallProgress: recallMap(),
      recallSettings: recallSettings(),
      account: { signedIn: Boolean(state.auth.user), provider: authProviderLabel() },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `APS_NAATI_Progress_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const originalRestoreProgress = restoreProgress;
  restoreProgress = async function trackedRestoreProgress(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data.version) throw new Error('Invalid backup');
      setJSON(storageKeys.vocabStatus, data.vocabStatus || {});
      setJSON(storageKeys.vocabSettings, data.vocabSettings || {});
      setJSON(storageKeys.vocabResume, data.vocabResume || {});
      setJSON(storageKeys.phraseStats, data.phraseStats || {});
      if (data.dialogueVocabProgress && storageKeys.dialogueVocabProgress) setJSON(storageKeys.dialogueVocabProgress, data.dialogueVocabProgress);
      if (data.myVocabs && storageKeys.myVocabs) setJSON(storageKeys.myVocabs, data.myVocabs);
      setJSON(storageKeys.attempts, data.attempts || []);
      setJSON(storageKeys.lesson, data.lesson || {});
      setJSON(storageKeys.mistakes, data.mistakes || []);
      if (Array.isArray(data.practiceDaily)) localStorage.setItem(storageKeys.practiceDaily, JSON.stringify(data.practiceDaily));
      if (data.recallProgress && typeof data.recallProgress === 'object') localStorage.setItem(storageKeys.recallProgress, JSON.stringify(data.recallProgress));
      if (data.recallSettings && typeof data.recallSettings === 'object') localStorage.setItem(storageKeys.recallSettings, JSON.stringify(data.recallSettings));
      Object.assign(state.vocabSettings, data.vocabSettings || {});
      normaliseVocabSettings(data.vocabSettings || {});
      saveVocabSettings();
      tracker.lastProgressSignature = '';
      tracker.lastSettingsSignature = '';
      showToast('Progress restored');
    } catch {
      showToast('This backup could not be restored');
    }
  };

  document.addEventListener('pointerdown', markActivity, true);
  document.addEventListener('keydown', markActivity, true);
  document.addEventListener('input', markActivity, true);

  document.addEventListener('click', event => {
    markActivity();
    const studyButton = event.target.closest('[data-study-action]');
    if (studyButton && handleStudyAction(studyButton)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    if (action === 'speak-item' || action === 'reveal') {
      const id = actionButton.dataset.id;
      const type = actionButton.dataset.type === 'phrases' || state.learn?.type === 'phrases' ? 'phrase' : 'word';
      recordNormalItemEncounter(id, type);
    }
    if (action === 'toggle-recall-reveal') recordCurrentVocabularyEncounter();
  }, true);

  document.addEventListener('change', bindSettingsChanges, true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushActiveTime();
    else {
      markActivity();
      reminderCheck();
    }
  });


  window.addEventListener('aps-language-changed', () => {
    flushActiveTime();
    if (typeof setLanguageScopedStorageKeys === 'function') setLanguageScopedStorageKeys(typeof activeLanguageId === 'function' ? activeLanguageId() : 'hi');
    tracker.normalSeen.clear();
    tracker.segmentSeen.clear();
    tracker.activeRecallSession = null;
    tracker.activeDialogueRecall = null;
    tracker.lastProgressSignature = '';
    tracker.lastSettingsSignature = '';
    window.setTimeout(() => { seedExistingTimedPractice(); reconcileRecallSchedules(); reminderCheck(); }, 50);
  });

  window.addEventListener('pagehide', flushActiveTime);
  window.addEventListener('beforeunload', flushActiveTime);

  const observer = new MutationObserver(() => {
    patchSkipControls();
    ensureProgressPanel();
    ensureSettingsCard();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(activeTimeTick, ACTIVE_TICK_SECONDS * 1000);
  tracker.reminderTimer = window.setInterval(() => reminderCheck(), 60 * 1000);

  window.setTimeout(() => {
    seedExistingTimedPractice();
    reconcileRecallSchedules();
    patchSkipControls();
    ensureProgressPanel();
    ensureSettingsCard();
    reminderCheck();
  }, 900);

  window.APSStudyProgressV9 = {
    version: TRACKER_VERSION,
    stages: STAGES.map(stage => ({ ...stage })),
    getSettings: recallSettings,
    saveSettings: saveRecallSettings,
    scheduleAfterPractice,
    completeRecallStage,
    dueRecords,
    dueTotal,
    getLast7Days: () => lastNDays(7),
    startRecallList,
    startDialogueRecall,
    flushActiveTime,
    testReminder,
    qaRecordPractice(type, id, date = isoNow()) {
      scheduleAfterPractice(type, id, date);
      recordDailyPractice(type);
    },
  };

  console.info(`${TRACKER_VERSION} loaded`);
})();
