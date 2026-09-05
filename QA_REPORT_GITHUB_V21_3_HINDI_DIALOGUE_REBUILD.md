# QA Report — APS NAATI CCL Practice V21.3 Hindi Dialogue Rebuild

## Result
**PASS — 74 automated/static checks, 0 failures, 0 notes.**

## Content structure
- 194 Hindi dialogues
- 2,402 segments
- 107 Verified Practice
- 87 Original Source
- Sequential Verified IDs `dialogue-001`–`dialogue-107`
- Sequential Original IDs `original-001`–`original-087`
- Unique segment IDs

## Rebuild integrity
- Verified Practice 1–85 preserve their existing segment IDs/counts.
- Verified Practice 1–85 have zero exact cross-dialogue source-segment duplication.
- Additional similarity sampling found no suspicious high-similarity segment reuse across different rebuilt dialogues; naturally related topics remain appropriately similar at the whole-dialogue level.
- Verified Practice 86–105 are byte-structure unchanged from the V21.2.1 protected baseline.
- Original Source 1–85 source/language/model fields match the saved first-source/V18 reference.
- New Original 86–87 and Verified 106–107 each contain 14 alternating English/Hindi source segments.
- No known broken-Hindi patterns, Gurmukhi characters or Unicode replacement characters were found in Hindi learner dialogue fields.

## Dialogue vocabulary
- 194 sets
- 1,891 total records
- Every dialogue has at least 5 relevant records.
- No duplicate normalized terms inside a dialogue set.
- Example English/Hindi text matches the cited source segment.
- Known ambiguous false matches removed.

## Recently Appeared
- UI contains student reporting and Recent-library controls.
- Date filters: This week / Last 30 days / Month / Custom.
- Dedicated Recent mock pair: `original-086` + `original-087`.
- Firebase functions require authentication.
- Report documents use a one-way user hash rather than storing a raw Firebase UID.
- Aggregate documents contain dialogue/month/per-day counts only.
- Aggregation uses monthly per-dialogue documents rather than a per-dialogue-per-day read model, substantially reducing Recent-filter reads for large user counts.
- A report-date change performs transaction reads before writes.

## My Vocabs Added date
- New records receive a creation timestamp.
- Added date remains permanent when a row is edited.
- Added column and Today / Yesterday / 7 days / 30 days / Custom filters are present.
- Date filters combine with existing Recall filtering and Play Filtered.
- Old rows without a date remain identifiable as Older rather than receiving an invented timestamp.

## Regression protection
- Punjabi pilot content is byte-identical to the V21.2.1 baseline.
- Hindi Core, General and Phrase libraries are unchanged by the dialogue rebuild.
- Existing assessment backend body is unchanged; V21.3 adds only the two Recent functions and required imports to that codebase.
- JavaScript files and backend function file pass `node --check`.
- Service-worker cache is bumped and forces fresh Hindi dialogues/dialogue-vocabulary.
- Version, language and online-manifest counts report 194 / 107 / 87 and 1,891 dialogue-vocabulary items.

## Automated QA log
```text
PASS=74 FAIL=0 NOTES=0
PASS 194 Hindi dialogues: 194
PASS 2402 Hindi segments: 2402
PASS 107 Verified Practice dialogues: 107
PASS 87 Original Source dialogues: 87
PASS Verified IDs sequential 001–107
PASS Original IDs sequential 001–087
PASS All segment IDs unique
PASS No Gurmukhi/replacement characters in Hindi learner dialogue fields: []
PASS Known broken-Hindi patterns absent: []
PASS Every Hindi side contains Devanagari text: []
PASS Verified 1–85 preserve exact segment IDs/counts: []
PASS Verified 86–105 are byte-structure unchanged from V21.2.1 baseline: []
PASS Punjabi pilot content byte-identical to V21.2.1: []
PASS Hindi Core/General/Phrases unchanged by dialogue rebuild: []
PASS Original reference contains all 85 dialogues: 85
PASS Original 1–85 source/language/model exactly match saved first-source/V18 reference: []
PASS All rebuilt Verified segments contain sample/meaning/critical/note assessment data: []
PASS Verified 1–85 have zero exact cross-dialogue source-segment duplication: []
PASS original-086 has 14 segments
PASS original-086 alternates English/Hindi source directions
PASS original-087 has 14 segments
PASS original-087 alternates English/Hindi source directions
PASS dialogue-106 has 14 segments
PASS dialogue-106 alternates English/Hindi source directions
PASS dialogue-107 has 14 segments
PASS dialogue-107 alternates English/Hindi source directions
PASS original-086 carries supplied candidate-report metadata
PASS original-087 carries supplied candidate-report metadata
PASS 194 dialogue-vocabulary sets
PASS Dialogue-vocabulary itemCount matches actual sum: 1891
PASS Dialogue-vocabulary final reviewed item count: 1891
PASS Every dialogue has at least 5 relevant dialogue-vocabulary records: []
PASS Dialogue-vocabulary terms/examples/segment references pass structural QA: []
PASS Known ambiguous false vocabulary matches removed: []
PASS Recent UI contains Appeared in my test
PASS Recent UI contains This week
PASS Recent UI contains Last 30 days
PASS Recent UI contains Custom dates
PASS Recent UI contains original-086
PASS Recent UI contains original-087
PASS Recent UI contains reportRecentDialogue
PASS Recent UI contains getRecentDialogueStats
PASS Recent UI contains v213CurrentMockPair
PASS My Vocabs Added-date feature contains createdAt:now
PASS My Vocabs Added-date feature contains >Added<
PASS My Vocabs Added-date feature contains Today
PASS My Vocabs Added-date feature contains Yesterday
PASS My Vocabs Added-date feature contains Last 7 days
PASS My Vocabs Added-date feature contains Last 30 days
PASS My Vocabs Added-date feature contains Custom dates
PASS My Vocabs Added-date feature contains addedDateMatches
PASS My Vocabs Added-date feature contains Play Filtered
PASS Existing assessAttempt backend body unchanged; V21.3 adds only imports + Recent functions
PASS Recent backend contains exports.reportRecentDialogue
PASS Recent backend contains exports.getRecentDialogueStats
PASS Recent backend contains recentUserHash
PASS Recent backend contains runTransaction
PASS Recent backend contains Promise.all
PASS Recent backend contains dialogue"?107:87
PASS Recent report documents do not store raw Firebase UID
PASS Recent aggregation uses scalable monthly documents, not per-dialogue daily reads
PASS Service-worker cache bumped to V21.3
PASS Service worker forces fresh Hindi dialogues + dialogue-vocabulary
PASS Recent assets are precached
PASS Online manifest dialogue counts updated
PASS Language metadata dialogue-vocabulary count updated
PASS Version metadata includes Added My Vocabs column
PASS Version metadata marks Recent backend deployment required
PASS Version nested Hindi pack counts updated
PASS Version nested Hindi dialogue-vocabulary count updated
PASS Version release notes use final 1,891 dialogue-vocabulary count
PASS Privacy notice documents Recent reporting
PASS All app/backend JavaScript passes node --check: []
PASS index.html loads V21.3 Recent assets
```

## Not claimed
- No real live-browser/device interaction test was performed in this workspace.
- The two new source dialogues are owner-provided/candidate-reported topics; they are not represented as official NAATI-confirmed transcripts or future-topic predictions.
