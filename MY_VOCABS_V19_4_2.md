# APS NAATI CCL Practice — My Vocabs V19.4.2

Focused spreadsheet usability patch.

## Changes
- Keeps the My Vocabs table header visible while working near the bottom of a long sheet.
- On desktop, only the vocabulary rows/table viewport scrolls vertically; focusing a new row no longer scrolls the whole My Vocabs page away from the header.
- Enter on the last row saves the English word, creates/reuses the next blank row, focuses it without browser page-jump, and scrolls the sheet body just enough to keep that row visible below the sticky header.
- Arrow Up/Down moves to the same editable column in the previous/next row.
- Arrow Left/Right moves to the previous/next editable cell when the text caret is already at the corresponding edge; otherwise Left/Right continue editing text normally.
- Shift + Arrow Up/Down row-range selection and selected-row highlighting are preserved.
- Existing frozen No. / English / Hindi Meaning columns, resizable columns, bulk translation, CSV import and progress behavior are unchanged.

No dialogue, vocabulary-content, Firebase, scoring, Content Studio, Safe Merge, or learner-progress schema changes are included.
