# APS NAATI CCL Practice V20.3.1 QA Report

**Result: 41/41 checks passed.**

## Purpose

Focused hotfix for the reported freeze after using Previous/Next inside a dialogue. The patch cancels stale asynchronous playback/pre-recording work before segment navigation and preserves saved response audio when revisiting completed segments.

## Checks

- ✅ Version is 20.3.1 — 20.3.1
- ✅ Safe dialogue navigation function installed
- ✅ Previous uses safe navigation
- ✅ Next uses safe navigation
- ✅ Playback cancellation exposed
- ✅ Active recording navigation protected
- ✅ Saved response audio detached from transient recorder
- ✅ Saved response audio can rehydrate
- ✅ Service worker cache bumped
- ✅ Unchanged content/packs/hi/dialogues.json
- ✅ Unchanged content/packs/hi/general-vocabulary.json
- ✅ Unchanged content/packs/hi/phrases.json
- ✅ Unchanged content/packs/hi/dialogue-vocabulary.json
- ✅ JavaScript syntax study-hotfix-v5.js
- ✅ JavaScript syntax online-v20-1.js
- ✅ JavaScript syntax online-v20.js
- ✅ JavaScript syntax reliability-v15.js
- ✅ JavaScript syntax cloud-sync-v11.js
- ✅ JavaScript syntax app.js
- ✅ JavaScript syntax ui-v20-2.js
- ✅ JavaScript syntax my-vocabs-v19-4.js
- ✅ JavaScript syntax original-source-v18.js
- ✅ JavaScript syntax content-library-v17.js
- ✅ JavaScript syntax my-vocabs-v19-3.js
- ✅ JavaScript syntax scoring.js
- ✅ JavaScript syntax study-progress-v9.js
- ✅ JavaScript syntax my-vocabs-v19.js
- ✅ JavaScript syntax sw.js
- ✅ JSON valid version.json
- ✅ JSON valid content/exam_info.json
- ✅ JSON valid content/languages.json
- ✅ JSON valid content/online-manifest-v20.json
- ✅ JSON valid content/lesson0.json
- ✅ JSON valid firebase-functions-v20/package.json
- ✅ JSON valid firebase-functions-v20/firebase.json
- ✅ JSON valid content/packs/hi/vocabulary.json
- ✅ JSON valid content/packs/hi/dialogues.json
- ✅ JSON valid content/packs/hi/general-vocabulary.json
- ✅ JSON valid content/packs/hi/phrases.json
- ✅ JSON valid content/packs/hi/dialogue-vocabulary.json
- ✅ Service worker precache files exist

## Scope protection

- All packaged learning content is unchanged from V20.3.
- Online semantic assessment code is unchanged.
- V19.5 scalable Firebase sync is unchanged.
- My Vocabs V20.3 smart-sheet code is unchanged.
- V20.2 whole-app UI cleanup and V20.1 compact practice layout are unchanged.

## Browser note

A headless Chromium smoke attempt was made in the build container, but Chromium did not complete the page dump in this environment. The result is therefore not claimed as a full browser click-through test. JavaScript syntax, data integrity, service-worker references, navigation wiring and content-preservation checks passed.
