# APS NAATI CCL Practice — Content Reliability v13

## Purpose

V13 is a controlled reliability rebuild on top of the working v12 shell. It intentionally preserves the existing Firebase account/login flow, cloud sync and dialogue-player controls.

## Dialogue quality gates

- Total packaged dialogues: 105
- Study-ready default: 25 (5 existing human-edited pilots + 20 new original APS source-checked bilingual practice dialogues)
- Legacy imported drafts preserved for review: 80
- Legacy drafts are excluded from Mock Test selection and hidden by the default Practice quality filter.
- Every new APS dialogue has stable IDs, a sample answer, meaning points, critical-detail metadata and a meaning-first variation policy.
- New APS practice segments are validated at 35 source words or fewer.

## General Vocabs

- Total General Vocab records: 3,009
- Reviewed / cross-checked records shown by default: 236
- Source-reference records requiring bilingual review: 2,773
- The large uploaded PDF is not treated as a verified dictionary because its source contains semantic and PDF-encoding errors. Those records are kept in a separate owner/editor review view.

## Content Studio

Settings → Content reliability & editing → Open Content Studio.

The editor can:

- edit dialogue title/situation/status;
- edit English or Hindi source text;
- edit the primary sample answer;
- add accepted example alternatives;
- edit meaning points and critical details;
- add a missing segment;
- delete or reorder a segment;
- save a local override without damaging packaged content;
- export/import all local overrides as JSON for later GitHub merging.

## Answer-equivalence rule

Sample answers are examples, not exact-string answer keys. Meaning-first assessment may accept valid synonyms, natural paraphrases, word-order changes and active/passive changes when speaker intent and meaning remain intact. Names, numbers, dates, negation, modality and conditions remain critical.

## Important editorial status

This build is designed so students do not have to rely on the 80 legacy machine-formatted dialogues. Those sources remain available for owner review and future bilingual correction rather than being silently presented as verified content.
