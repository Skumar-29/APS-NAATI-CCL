# APS NAATI CCL Practice — V19.1 QA Report

## Result
PASS for structural/data/static validation.

## Confirmed
- V19.1 JavaScript syntax passed (`node --check`).
- Service-worker JavaScript syntax passed.
- `version.json` parses successfully.
- Service worker precaches 32 runtime assets and every listed asset exists.
- 190 dialogue records remain packaged.
- 190 dialogue-vocabulary sets remain packaged.
- Core app, Firebase/cloud-sync, Content Studio, Original Source, scoring, study progress and study-hotfix files are byte-for-byte identical to the deployed V19 production build.
- All Hindi content pack JSON files are unchanged from V19.
- My Vocabs now contains online-first lookup code, installed-APS offline fallback, 30-day lookup cache, manual-field protection, Fill Missing Details, compact focus view, return-context handling, and Enter-to-next-row logic.
- Dedicated `?myvocabs=1` pop-out boot path suppresses the normal Home/app view while the My Vocabs workspace initializes.
- Full production ZIP integrity test passed.
- Small GitHub Web Update ZIP integrity test passed.

## Browser-test note
A headless Chromium full click-through was attempted in the build container, but Chromium did not terminate in this environment because of its sandbox/DBus/runtime behaviour. I therefore do not claim a completed automated browser interaction test. The JavaScript, JSON, asset and package checks above passed; after GitHub deploy, the recommended quick real-browser check is: open My Vocabs, type a word + Enter, confirm the next row receives focus, verify online fill, open the pop-out, then close it and confirm the original screen remains unchanged.
