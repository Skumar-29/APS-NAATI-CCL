# APS NAATI CCL Practice V20 — Final QA Report

**Result: 60/60 checks passed.**

- [x] JavaScript syntax: app.js
- [x] JavaScript syntax: cloud-sync-v11.js
- [x] JavaScript syntax: content-library-v17.js
- [x] JavaScript syntax: firebase-functions-v20/index.js
- [x] JavaScript syntax: my-vocabs-v19-3.js
- [x] JavaScript syntax: my-vocabs-v19-4.js
- [x] JavaScript syntax: my-vocabs-v19.js
- [x] JavaScript syntax: online-v20.js
- [x] JavaScript syntax: original-source-v18.js
- [x] JavaScript syntax: reliability-v15.js
- [x] JavaScript syntax: scoring.js
- [x] JavaScript syntax: study-hotfix-v5.js
- [x] JavaScript syntax: study-progress-v9.js
- [x] JavaScript syntax: sw.js
- [x] JSON parses: version.json
- [x] JSON parses: content/languages.json
- [x] JSON parses: content/online-manifest-v20.json
- [x] JSON parses: content/lesson0.json
- [x] JSON parses: content/exam_info.json
- [x] JSON parses: firebase-functions-v20/package.json
- [x] JSON parses: firebase-functions-v20/firebase.json
- [x] JSON parses: content/packs/hi/general-vocabulary.json
- [x] JSON parses: content/packs/hi/vocabulary.json
- [x] JSON parses: content/packs/hi/dialogue-vocabulary.json
- [x] JSON parses: content/packs/hi/phrases.json
- [x] JSON parses: content/packs/hi/dialogues.json
- [x] Dialogue total remains 190 — 190
- [x] Original Source remains 85 — 85
- [x] Verified Practice remains 105 — 105
- [x] Core vocab remains 3000
- [x] Phrases remain 551
- [x] Dialogue-vocabulary sets remain 190 — 190
- [x] Preserved V19.5 module: cloud-sync-v11.js
- [x] Preserved V19.5 module: my-vocabs-v19-4.js
- [x] Preserved V19.5 module: content-library-v17.js
- [x] Preserved V19.5 module: reliability-v15.js
- [x] Preserved V19.5 module: original-source-v18.js
- [x] Learning content byte-identical: content/packs/hi/dialogues.json
- [x] Learning content byte-identical: content/packs/hi/vocabulary.json
- [x] Learning content byte-identical: content/packs/hi/phrases.json
- [x] Learning content byte-identical: content/packs/hi/dialogue-vocabulary.json
- [x] Learning content byte-identical: content/packs/hi/general-vocabulary.json
- [x] V20 CSS linked
- [x] V20 JS linked after My Vocabs
- [x] Service-worker precache assets exist
- [x] V20 shell cache name present
- [x] Large language packs not in precache
- [x] Online assess endpoint
- [x] Assessment status/fallback
- [x] Review navigation
- [x] Mock inside Practice
- [x] Assessment cache
- [x] Web cloud transcription patch
- [x] No API key embedded in web JS
- [x] Backend uses Firebase secret
- [x] Backend verifies Firebase ID token
- [x] Backend separates meaning and language
- [x] Local fallback regression: customs response >=70% meaning coverage — 76.1%
- [x] V20 architecture doc exists
- [x] V20 update steps exist

## Browser testing note

Static structure, JavaScript syntax, JSON integrity, service-worker assets, content preservation, regression scoring and backend security wiring were checked in the build environment. A headless Chromium smoke run was attempted, but Chromium did not terminate normally in this container, so this report does not claim a full browser click-through. A live online semantic request cannot be completed here because it requires the user’s deployed Firebase function and secret. Until that function is deployed, V20 intentionally shows the improved local fallback.
