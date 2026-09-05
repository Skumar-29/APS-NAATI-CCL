# QA Report — V21.2.1 Practice Controls

Date: 2026-09-05

## Result
Static/integration QA: **PASS**

## Verified
- Full build still contains the existing V21.2 app and all previous V20/V21 systems.
- `content/packs/**`: byte-for-byte unchanged from V21.2.
- `firebase-functions-v20/**`: byte-for-byte unchanged from V21.2.
- `firebase-functions-v21-tts/**`: byte-for-byte unchanged from V21.2.
- Only existing files changed for this patch: `index.html`, `sw.js`, `version.json`, `content/online-manifest-v20.json`.
- New frontend files: `practice-controls-v21-2-1.js`, `practice-controls-v21-2-1.css`.
- All JavaScript files pass `node --check`.
- `version.json` and `content/online-manifest-v20.json` parse successfully.
- Service worker precaches the two new V21.2.1 frontend files and uses a new cache version.
- Mock Test has an explicit guard and does not receive the new study switches.
- Online Assessment switch reuses the existing V20 assessment preference and does not create a second assessment system.
- Turning Assessment OFF leaves local feedback available and prevents new semantic assessment requests through the existing V20 gate.
- Turning Assessment ON while Review is open calls the existing review-triggered assessment path.
- Retry uses `requestAssessmentForReview(..., {force:true})` and clears the temporary client cooldown before retrying.
- Transcript toggle continues to use the existing `toggle-source-transcript` action and only changes its visible presentation.
- Online Assessment Settings card is hidden/removed to avoid a duplicate control.

## Browser/device testing
A full real-device/live-site interaction test is **not claimed** from this workspace. After GitHub upload, confirm in Chrome that:
1. Assessment switch is visible beside Speed/Gap.
2. ON is green/right and OFF is red/left.
3. Transcript switch is visibly labelled and works.
4. A local-fallback result shows Retry online and successfully retries when the backend is reachable.
5. Word Lookup still works.
6. Hindi source/sample playback remains correct.
