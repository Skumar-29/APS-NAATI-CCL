# QA Report — V21.2 Instant Word Lookup

## Baseline
Source baseline: `APS_NAATI_CCL_GitHub_Ready_v21_1_HINDI_CLARITY.zip`.
V21.2 was implemented additively; it was not rebuilt from scratch.

## Protected content integrity
SHA-256 comparison against the V21.1 Hindi-Clarity backup passed for all ten packaged Hindi/Punjabi content files:
- Hindi dialogues, Core vocabulary, General vocabulary, phrases and dialogue vocabulary: unchanged
- Punjabi pilot dialogues, Core vocabulary, General vocabulary, phrases and dialogue vocabulary: unchanged

Current structural counts remain:
- Hindi: 190 dialogues / 2,346 segments / 105 Verified Practice / 85 Original Source
- Hindi Core: 3,000
- Hindi General: 3,009
- Hindi phrases: 551
- Hindi dialogue-vocabulary: 190 sets / 3,283 records
- Punjabi pilot: 5 dialogues / 71 segments / 65 Core / 65 General / 40 phrases / 5 dialogue-vocabulary sets / 96 records

## Code checks
PASS — `node --check` for all top-level JavaScript files.
PASS — new `instant-word-lookup-v21-2.js` is loaded after the existing Voice Manager.
PASS — new CSS/JS are included in the service-worker precache.
PASS — app-shell cache version changed to V21.2.
PASS — JSON syntax for `version.json` and `content/online-manifest-v20.json`.

## Lookup logic tests
PASS — English `theft` in `original-013` resolves locally to `चोरी` from current Dialogue Vocabulary.
PASS — Hindi `चोरी` in `original-013` resolves locally to English `theft`.
PASS — unreviewed General source-reference entry `term → शतर्` is blocked from trusted local lookup.
PASS — adding a resolved item creates a My Vocabs record with the active language ID.
PASS — `findExact` recognises an already-saved matching English/target-language pair.
PASS — phrase resolver promotes a click inside `entry requirements` to the full reviewed two-word term when that phrase occurs in the sentence.

## Language-isolation tests
PASS — Hindi `admission` resolves to `प्रवेश`.
PASS — Punjabi pilot `admission` resolves to `ਦਾਖਲਾ`.
PASS — Hindi quick capture writes only to `apsMyVocabsV1:hi`.
PASS — Punjabi quick capture writes only to `apsMyVocabsV1:pa`.

## Behaviour safeguards
PASS — source text is enhanced only when the transcript is visible.
PASS — sample interpretation text can be enhanced when Review is visible.
PASS — opening lookup cancels current speech playback through the existing speech/Voice Manager path.
PASS — listening-interruption guard suppresses the pending chime and prevents microphone auto-start after a lookup interrupts source TTS.
PASS — lookup is blocked while a response is already recording, avoiding recording corruption.
PASS — Mock Test Mode is excluded from lookup enhancement.
PASS — no scoring or Firebase backend files were changed.

## Browser/device testing status
Not claimed. Automated Chromium rendering could not be completed in this workspace because the container's Chromium enterprise policy blocks local/file URLs. Static/unit QA passed, but the final live Chrome interaction should be verified after the GitHub update is deployed.

## Recommended live smoke test
1. Open a Hindi dialogue in Learning or Practice.
2. Turn Transcript On.
3. Click an English word such as `admission`, `bond` or another reviewed term.
4. Confirm the Hindi meaning appears without leaving the dialogue.
5. Open Review and click a word in the sample interpretation.
6. Click `+ Add to My Vocabs` and confirm the row appears in My Vocabs.
7. Repeat with a Hindi source word and confirm English meaning.
8. Open Mock Test and confirm the word lookup is not enabled.
