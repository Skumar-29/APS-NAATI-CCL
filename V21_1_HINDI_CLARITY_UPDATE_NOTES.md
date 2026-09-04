# APS NAATI CCL Practice — V21.1 Hindi Clarity Update

## What changed

This is a focused Hindi content repair before continuing the Full Punjabi Pack.

- Reviewed all 1,073 segments in the 85 Original Source dialogues.
- Replaced broken, machine-formatted and hard-to-understand Hindi with clear natural Standard Hindi suitable for listening and NAATI CCL practice.
- Updated Hindi source segments and Hindi sample/model interpretations together with their learner-facing meaning points/notes where required.
- Preserved dialogue IDs, segment IDs, scenarios, order and existing critical-detail metadata.
- Restored two truncated legacy source sentences in Original Source 82 (Document Translation) from the V18 study-book reference.
- Corrected Original Source 63 segment 07 from wrongly labelled romanised Hindi to Hindi → English.
- Cleaned a small set of obvious English OCR artifacts found during the same audit.
- Added a service-worker cache invalidation for Hindi `dialogues.json` so an older cached copy does not survive the update.

## What did not change

- 105 Verified Practice dialogue objects
- Hindi vocabulary, general vocabulary, phrases and dialogue-vocabulary files
- Punjabi pilot pack
- My Vocabs
- progress/attempt storage IDs
- cloud sync schemas
- Firebase assessment/transcription/TTS backends

## Version

`21.1.0-hindi-clarity`

Punjabi full-pack completion remains paused until this Hindi repair is live-tested.
