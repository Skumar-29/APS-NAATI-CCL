# APS NAATI CCL Practice V2.0.6 — Voice & Audio Settings

## Added

- Global **Settings** button on Home, Learn, Practice, Mock Test and Progress pages.
- English learning voice selector.
- Hindi learning voice selector.
- Separate English Speaker 1 and Speaker 2 dialogue voice selectors.
- Separate Hindi Speaker 1 and Speaker 2 dialogue voice selectors.
- Preview button for every selected voice.
- Refresh installed voice list.
- Reset all selections to automatic system voices.

## Progress protection

This update keeps the same local-storage keys and IndexedDB database used by V2.0.5:

- `apsFinalVocabStatus`
- `apsFinalVocabSettings`
- `apsFinalVocabResume`
- `apsFinalAttempts`
- `apsFinalLesson`
- `apsFinalMistakes`
- `apsFinalPhraseStats`
- IndexedDB: `aps-naati-complete-v2`

The new dialogue voice fields are added inside the existing settings object. No existing vocabulary status, phrase count, completed dialogue, attempt report, lesson progress, mistake record or saved recording is deleted.

For extra safety, users can use **Progress → Backup progress** before updating.
