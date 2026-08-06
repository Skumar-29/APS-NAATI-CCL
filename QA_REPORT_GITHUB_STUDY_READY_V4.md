# APS NAATI CCL Practice — GitHub Study Ready v4

## Fixed

- Recorded audio is saved and played from IndexedDB without Firebase.
- GitHub Pages no longer displays a Firebase Authentication transcription error.
- Browser speech recognition is used for local transcript comparison when available.
- Compare Answer remains available for manual recording-versus-sample review when no browser transcript is produced.
- The listening Skip button is inside the top-right of the source card.
- The recording Skip button is inside the top-right of the response card.
- Both controls use the short label `Skip`.
- The old floating skip bar is removed.
- Practice search, dialogue playback and the Settings update button are retained.

## Data safety

Updates replace app files and app caches only. Existing localStorage and IndexedDB practice data are not deleted.
