# APS NAATI CCL Practice — V21.1 Hindi Clarity QA Report

## Scope

Hindi-content repair only. Punjabi full-pack work remains paused. Firebase assessment, transcription and TTS backends were not changed or redeployed.

The repair targets the 85 **Original Source** dialogues because the current V21.1 WIP branch had regressed to older machine-formatted/broken Hindi in many of those segments. The earlier V18 Original Source study book was used as a reference for the intended corrected content, including restoration of two truncated Document Translation source segments.

## Final structural checks

- Total dialogues: **190**
- Verified Practice dialogues: **105**
- Original Source dialogues: **85**
- Total segments: **2346**
- Original Source segments reviewed: **1073**
- Dialogue IDs preserved: **PASS**
- Segment IDs preserved: **PASS**
- Verified Practice 105-dialogue objects unchanged byte-for-byte at JSON-object level: **PASS**
- Existing `criticalDetails` arrays preserved for all existing segment IDs: **PASS**

## Hindi clarity checks

- Original Source editorial rows recorded in change log: **1,073**
- Rows whose Hindi text changed: **1,072** (one already-clean segment remained unchanged)
- Known broken forms from the reported screenshots/legacy machine text remaining: **0**
- Gurmukhi/CJK/replacement characters in learner-facing Hindi dialogue fields: **0**
- Hindi-side segment/model fields with no Devanagari text: **0**
- Source/model fields ending in a truncation ellipsis: **0**

## Specific legacy repairs

- `original-013` CCTV in School: broken forms such as `क्रिक्केत`, `सेह्पथि`, `समस्सेय`, `इम्मारत` and related machine spellings were replaced with clear natural Hindi.
- `original-063-s07` Renovation: repaired from wrongly labelled romanised-Hindi `en` source to a proper **Hindi → English** segment. This is the only source-language direction correction: `original-063-s07`.
- `original-082-s03` Document Translation: restored full source to **“We do not provide document translation services directly.”** and complete Hindi interpretation.
- `original-082-s05` Document Translation: restored full source to **“Of course. We have a list of translation services and translators you can contact.”** and complete Hindi interpretation.
- Obvious English OCR artifacts found during the same audit were cleaned in a small number of Original Source records so TTS/sample text does not read corrupted text.

English-source OCR/restoration edits where the segment remained English-source: **9**  
`original-005-s07, original-046-s13, original-052-s05, original-052-s07, original-070-s10, original-070-s12, original-073-s09, original-082-s03, original-082-s05`

English target/sample OCR cleanups in Hindi-source segments: **5**  
`original-011-s07, original-029-s08, original-051-s14, original-070-s09, original-070-s11`

## Isolation checks

- Hindi vocabulary file unchanged: **PASS**
- Hindi general vocabulary unchanged: **PASS**
- Hindi phrases unchanged: **PASS**
- Hindi dialogue-vocabulary unchanged: **PASS**
- All five Punjabi pilot content files unchanged: **PASS**
- Learner progress IDs/storage schemas were not changed.
- My Vocabs code/data model was not changed.
- Firebase Functions code was not changed.

## Cache/update safety

- `version.json` updated to `21.1.0-hindi-clarity`.
- in-app update build constant updated to the same version.
- service-worker shell/content cache names bumped.
- migration explicitly skips the old `content/packs/hi/dialogues.json`, forcing the repaired Hindi dialogue file to be fetched fresh after update instead of serving the old cached copy first.

## Syntax / file validation

- `sw.js`: `node --check` **PASS**
- `study-hotfix-v5.js`: `node --check` **PASS**
- `app.js`: `node --check` **PASS**
- JSON parse errors across packaged content/version files: **0**

## Hashes

- Previous V21.1 WIP Hindi `dialogues.json`: `14a416cd87a930ee38bc81f83bb42da220ccdd44f81aa33d17125641edd4736e`
- Repaired Hindi `dialogues.json`: `6bacb8a67c0b38f04a43ee1cf658df53bcbb6e3f44c2f26f944448ec0f5f375f`

## Testing boundary

This report covers static/content QA and cache/update logic checks. It does **not** claim full Chrome/device audio regression testing. After upload, the recommended live check is to open previously broken Original Source dialogues (especially `original-013`, `original-063`, and `original-082`), play the Hindi audio, and confirm the new text/audio is being served.
