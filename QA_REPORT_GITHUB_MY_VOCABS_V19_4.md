# APS NAATI CCL Practice — V19.4 QA Report

**Result: 31/31 checks passed.**

## Scope
V19.4 is a focused My Vocabs spreadsheet upgrade. It does not modify the dialogue/content/player/account/scoring systems inherited from V19.3.

## Checks
- PASS — app.js preserved from V19.3
- PASS — cloud-sync-v11.js preserved from V19.3
- PASS — scoring.js preserved from V19.3
- PASS — content-library-v17.js preserved from V19.3
- PASS — original-source-v18.js preserved from V19.3
- PASS — reliability-v15.js preserved from V19.3
- PASS — study-progress-v9.js preserved from V19.3
- PASS — V19.4 JS loaded by index
- PASS — V19.4 CSS loaded by index
- PASS — English-only/headerless CSV supported
- PASS — CSV import starts automatic translation
- PASS — Translate All Missing exists
- PASS — Persistent bulk queue exists
- PASS — Bulk pause/resume exists
- PASS — Bulk retry failed exists
- PASS — No. column added
- PASS — First three columns frozen
- PASS — Column resizing exists
- PASS — Column auto fit exists
- PASS — Column widths persist
- PASS — Compact/comfortable rows exist
- PASS — Shift Arrow row selection exists
- PASS — Selected rows highlighted
- PASS — Click row number selection exists
- PASS — Play Selected exists
- PASS — My Synonyms remains user-managed
- PASS — Press Enter starts translation and next row
- PASS — Service worker assets present
- PASS — New SW cache name
- PASS — JSON files parse
- PASS — Packaged content unchanged from V19.3

## Runtime note
JavaScript syntax and static integration checks passed. Live online translation itself was not load-tested against hundreds of Google requests inside this build container; V19.4 therefore uses a paced one-at-a-time queue, retries, persistent resume state, and Retry Failed controls to reduce browser/API throttling risk.

## V19.4 behavior
- English-only CSV files are accepted with or without a header.
- Missing Hindi meanings begin translating automatically immediately after import.
- My Synonyms is never auto-filled.
- No., English and Hindi Meaning are frozen while scrolling horizontally.
- Shift + Arrow Up/Down expands the current row selection and selected rows use a different highlight color.
- Column widths and density are saved locally.
