# APS NAATI CCL Practice V2.0.6 — Voice & Audio QA Report

**Validated:** 2 August 2026

## Release scope

- Global Voice & Audio settings available from the main app header.
- Separate English and Hindi learning voices.
- Separate English and Hindi voices for Dialogue Speaker 1 and Speaker 2.
- Voice preview, voice-list refresh and automatic-voice reset.
- Existing progress storage and recording database preserved.

## Automated validation

- PASS: app.js syntax
- PASS: scoring.js syntax
- PASS: Vocabulary count — 3000
- PASS: Phrase count — 551
- PASS: Dialogue count — 85
- PASS: Segment count — 1073
- PASS: Version metadata — 2.0.6
- PASS: Voice build metadata — friends-beta-v206-voice-settings
- PASS: Service worker cache
- PASS: Storage key apsFinalOnboarded
- PASS: Storage key apsFinalVocabStatus
- PASS: Storage key apsFinalVocabSettings
- PASS: Storage key apsFinalVocabResume
- PASS: Storage key apsFinalAttempts
- PASS: Storage key apsFinalLesson
- PASS: Storage key apsFinalMistakes
- PASS: Storage key apsFinalPhraseStats
- PASS: IndexedDB unchanged
- PASS: Voice feature data-action="app-settings"
- PASS: Voice feature id="voiceEn"
- PASS: Voice feature id="voiceHi"
- PASS: Voice feature dialogueVoiceEnS1
- PASS: Voice feature dialogueVoiceEnS2
- PASS: Voice feature dialogueVoiceHiS1
- PASS: Voice feature dialogueVoiceHiS2
- PASS: Voice feature data-action="preview-voice"
- PASS: Voice feature 'refresh-voices'
- PASS: Voice feature 'reset-voices'
- PASS: Speaker-aware dialogue playback
- PASS: Backup version
- PASS: Progress/voice VM integration test — PASS: voice settings render/save/fallback and existing progress keys are preserved
- PASS: Asset index.html
- PASS: Asset app.js
- PASS: Asset styles.css
- PASS: Asset scoring.js
- PASS: Asset manifest.webmanifest
- PASS: Asset sw.js
- PASS: Asset icon-192.png
- PASS: Asset icon-512.png
- PASS: Asset content/dialogues.json
- PASS: Asset content/starter_vocab.json
- PASS: Asset content/starter_phrases.json
- PASS: Asset content/exam_info.json
- PASS: Asset content/lesson0.json
- PASS: Asset version.json
- PASS: Asset .github/workflows/deploy-pages.yml
- PASS: Asset .nojekyll

## Progress preservation

V2.0.6 uses the same GitHub Pages origin, local-storage keys and IndexedDB database as V2.0.5. The update only adds new fields inside `apsFinalVocabSettings`. Vocabulary status, phrase counts, completed dialogue attempts, reports, Lesson 0 progress, mistakes and saved recordings are not cleared.

For maximum safety, make a progress backup before updating. Do not delete the installed web app or clear browser/site data until the update has been confirmed.

## Device note

The selectable voice list is supplied by the user’s current Mac, iPhone, Android device, Windows device and browser. Voice names and availability can therefore differ by device.
