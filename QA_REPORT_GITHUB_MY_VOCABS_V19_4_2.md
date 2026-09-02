# APS NAATI CCL Practice — My Vocabs V19.4.2 QA

**Checks passed: 21/21**

- PASS — Version is 19.4.2 — 19.4.2
- PASS — Sticky header layout present
- PASS — Sheet body contained scroll present
- PASS — Focus uses preventScroll
- PASS — Focused row scrolls inside sheet
- PASS — Arrow Up/Down navigation
- PASS — Arrow Left/Right navigation
- PASS — Shift+Arrow row selection preserved
- PASS — Frozen No/English/Hindi preserved
- PASS — Bulk status auto-hide logic preserved
- PASS — app.js unchanged from V19.4.1
- PASS — cloud-sync-v11.js unchanged from V19.4.1
- PASS — scoring.js unchanged from V19.4.1
- PASS — content-library-v17.js unchanged from V19.4.1
- PASS — original-source-v18.js unchanged from V19.4.1
- PASS — content/packs/hi/dialogues.json unchanged from V19.4.1
- PASS — content/packs/hi/vocabulary.json unchanged from V19.4.1
- PASS — content/packs/hi/phrases.json unchanged from V19.4.1
- PASS — content/packs/hi/general-vocabulary.json unchanged from V19.4.1
- PASS — content/packs/hi/dialogue-vocabulary.json unchanged from V19.4.1
- PASS — Service worker precache assets exist

## Scope

This is a focused My Vocabs spreadsheet-navigation patch. It does not change dialogue content, master vocabulary/phrases, Firebase login/cloud sync schema, scoring, Content Studio, Safe Merge, or existing learner-progress identifiers.

## Browser behavior targeted

- On desktop, My Vocabs occupies the viewport and the table body is the vertical scroll container.
- The column header remains sticky while rows scroll.
- Enter on a bottom English row focuses the next row with `preventScroll` and then scrolls only the sheet container enough to reveal it.
- Up/Down move to the same editable column in adjacent rows.
- Left/Right move between editable cells only when the text caret is already at the relevant edge, preserving normal text editing inside a cell.
- Shift+Up/Down continues to extend row selection.

Static JavaScript/JSON/service-worker validation passed. A full automated browser keyboard interaction test was not available in this build environment, so the first deployed smoke test should verify row 334→335 Enter focus and header visibility.
