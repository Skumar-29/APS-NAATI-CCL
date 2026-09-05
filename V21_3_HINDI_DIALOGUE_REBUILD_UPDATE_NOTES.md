# APS NAATI CCL Practice — V21.3 Hindi Dialogue Rebuild

## Purpose
V21.3 repairs the structural quality problem found in the first 85 Verified Practice dialogues, adds two owner-supplied recently reported dialogue topics, adds student-driven Recently Appeared reporting, and adds Added-date recall filters to My Vocabs. Punjabi remains the protected 5-dialogue pilot in this release.

## Hindi dialogue library
- 194 total dialogues
- 107 Verified Practice
- 87 Original Source
- 2,402 total segments
- Verified Practice 1–85 rebuilt as distinct, topic-specific bilingual conversations while preserving their existing dialogue and segment IDs.
- Verified Practice 86–105 preserved from V21.2.1.
- Verified Practice 106–107 are new practice variants for the two newly supplied topics.
- Original Source 1–85 re-verified/restored against the saved first-source/V18 reference.
- Original Source 86–87 are the two owner-supplied candidate-reported 14-segment dialogues, with only necessary Hindi clarity corrections.

## Dialogue-specific vocabulary
- 194 dialogue-vocabulary sets
- 1,891 context-linked records
- Minimum 5 reviewed items per dialogue
- Examples are tied to the actual current bilingual segment.
- Ambiguous single-word matches require confirmation from both sides of the same segment to avoid false matches such as Hindi `कर` being treated as the noun `tax` when it is functioning as a verb.

## Recently Appeared
- Signed-in learners can mark or unmark **Appeared in my test** for any of the 194 dialogues.
- One current report per signed-in user per dialogue.
- A report includes the learner-selected appearance date.
- Aggregate counts support **This week**, **Last 30 days**, **Month**, and **Custom dates**.
- Counts decrease when learners remove/change their own report.
- Candidate/student reports are clearly labelled as reports, not official NAATI confirmations or predictions.
- The owner-supplied Original Source 86–87 pair is available as a dedicated Recent mock pair.
- Backend aggregation is monthly per dialogue with per-day counts to reduce Firestore reads at scale.
- Aggregate results do not expose student identity.

## My Vocabs — Added date
- New permanent **Added** column.
- New filters: **Today**, **Yesterday**, **Last 7 days**, **Last 30 days**, **Custom dates**.
- Added-date filters combine with Recall/status filters.
- Editing spelling, meaning, synonyms or Recall does not change the original Added date.
- Older rows without a trustworthy creation timestamp show **Older** and are not assigned a fabricated date.
- CSV export includes Added At; import can preserve a valid Added At value for new/undated rows.

## Preserved systems
V21.3 preserves the V21.1 Hindi clarity repairs, V21.2 Instant Word Lookup, V21.2.1 practice controls, existing assessment/transcription/TTS behaviour, language-scoped progress/attempts/My Vocabs, Firebase sync architecture, and the Punjabi pilot.

## Backend deployment required
Two new functions must be deployed from `firebase-functions-v20`:
- `reportRecentDialogue`
- `getRecentDialogueStats`

Deploy only those two functions. Do not redeploy `assessAttempt`, `transcribeAttempt`, or `synthesizeSpeech` for this update.

## Testing status
Automated/static QA passed. Real live-browser/device interaction testing is still required after deployment; this report does not claim that such testing was performed in the build workspace.
