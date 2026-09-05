# APS NAATI CCL Practice — V21.3.1 Mock Test Navigation + Compact Dialogue Cards

## Fixes
V21.3 Recent Dialogues replaced the Practice-page renderer after the V20 Practice navigation wrapper had already added the Mock Test selector. This accidentally hid the visible Mock Test entry even though the mock engine remained present.

The dialogue library was also using more vertical space than necessary on desktop, making it harder to scan a large 194-dialogue library.

## V21.3.1
- Restores compact **Dialogue | Mock Test** selector at the top of Practice.
- Adds the same selector on Mock Test so learners can return directly to Dialogue Practice.
- Preserves normal random two-dialogue Mock Test.
- Preserves the dedicated candidate-reported Recent mock pair.
- Compacts dialogue cards without removing learner information or actions.
- Uses **3 dialogue cards per row on roomy desktop screens**, 2 on medium desktop/tablet widths, and 1 on smaller screens.
- Tightens tags, progress, descriptions, review badges, metadata, Recent-report control and Learn/Practice actions.
- Keeps mobile tap targets comfortable and allows slightly more description text on narrow screens.
- No dialogue, vocabulary, progress, assessment, voice, My Vocabs, Recent-report data, Firebase Function, or Firestore rule changes.
- No Firebase redeployment is required.

## Cache
Service-worker cache names were advanced again within V21.3.1 so browsers fetch both the restored Mock Test navigation and the compact card CSS rather than keeping the earlier shell.
