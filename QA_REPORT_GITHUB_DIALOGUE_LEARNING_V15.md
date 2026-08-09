# QA Report — APS NAATI CCL Practice V15

Build: `github-dialogue-learning-2026-08-09-v15`

## Automated content checks — PASS
- 105 unique dialogues.
- 1,273 unique dialogue segments.
- No blank source segments or blank required sample/model answers.
- Every source segment is 35 words or fewer by whitespace word count.
- Root and Hindi-pack dialogue files are identical.
- V14 dialogue content remains byte-for-byte unchanged in V15.
- No student-facing `डॉक्टर` or `डाक्टर` remains in dialogue or dialogue-vocabulary data.
- Preferred `चिकित्सक` terminology remains in the V14 dialogue library.

## Dialogue vocabulary — PASS
- 105 dialogue-specific vocabulary sets: one for every dialogue.
- 1,649 total dialogue-vocabulary records.
- 8–20 selected terms per dialogue; median 16; average 15.7.
- Every dialogue-vocabulary ID is unique and does not collide with Core Vocabulary or Phrase IDs.
- Linked source segment IDs, where present, resolve to the correct dialogue.
- Root and Hindi-pack dialogue-vocabulary files are identical.
- Dialogue vocabulary uses simple English↔Hindi terminology and preserves `चिकित्सक`, `दंत चिकित्सक`, `विशेषज्ञ चिकित्सक` and `पशु चिकित्सक` preferences where relevant.

## Existing learning content — PASS
- 3,000 Core Vocabulary records retained byte-for-byte from V14.
- 551 Phrase records retained byte-for-byte from V14.
- V14 scoring.js and base styles.css retained byte-for-byte.

## Navigation / learning wiring — PASS
- Closing a completed Practice Mode report returns to Dialogue Practice rather than Home.
- Closing a Mock Test report returns to Mock Test.
- Practice filters/search are not reset by the report-close handler.
- Learning Mode cards open the new Dialogue Learning Hub.
- Dialogue Learning Hub provides `Learn Vocabs` and `Start Dialogue` independently; vocabulary is not compulsory.
- Dialogue vocabulary uses the existing vocabulary player.
- `Back to Dialogue` is injected only when the vocabulary player was launched from a dialogue.
- Partial dialogue-vocabulary progress is stored under a separate V15 key and can resume from the last practised term.
- Dialogue Learning Hub supports the existing Settings modal.

## Content Studio — PASS
- Search field added to Owner Content Studio.
- Search covers dialogue ID/number, title, topic, English source/sample content and Hindi source/sample content.
- Existing dialogue selector remains available.
- Existing add/delete/reorder/save/reset/import/export editor functions remain in place.

## Account / progress regression safeguards — PASS
- Existing Firebase login/account provider flow was not redesigned.
- Existing Core Vocabulary/Phrase IDs and progress stores are retained.
- Dialogue-vocabulary progress is added to backup/restore and Firebase sync with its own storage key.
- No Cloudflare dependency was added.

## Static package checks — PASS
- All JSON files parse successfully.
- JavaScript syntax checks pass for `app.js`, `cloud-sync-v11.js`, `reliability-v15.js`, `scoring.js`, `study-hotfix-v5.js`, `study-progress-v9.js` and `sw.js`.
- Every local file referenced by `index.html` exists.
- Every V15 service-worker precache path exists.
- The obsolete pilot runtime overlay is not loaded and is excluded from the V15 package.

## Runtime test note
The container environment did not provide a reliable localhost/headless interactive browser session, so this report does not claim a full manual click-through in Chromium. The build therefore uses static wiring checks, syntax checks, data-integrity checks and package-integrity checks here. A short live GitHub Pages smoke test is still recommended after upload.
