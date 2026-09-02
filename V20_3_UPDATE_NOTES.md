# APS NAATI CCL Practice V20.3 — My Vocabs Smart Sheet

V20.3 is a focused My Vocabs workflow update built on the V20.2 whole-app UI baseline. Learning content, online assessment, Firebase scalable sync, dialogue libraries, Content Studio and Safe Merge are unchanged.

## Changes

- Spreadsheet viewport no longer jumps to the top after editing, correcting spelling, changing recall status or deleting rows.
- Enter moves to the same column in the next existing row. A new blank row is created only when needed at the end.
- Scrolling is minimal: the table moves only enough to keep the next active cell visible.
- Hindi-first entry is supported: if English is blank, typing a Hindi meaning can fill the English column online; installed APS vocabulary is an offline fallback when possible.
- Duplicate English spelling is detected using normalized matching (case, extra spaces and simple punctuation ignored).
- Duplicate prompt shows the existing row, Hindi meaning, My Synonyms and recall status with actions: Open existing, Add separate meaning, Cancel.
- My Synonyms can be spoken in the existing vocabulary player. Hindi and English entries are detected per comma/semicolon/slash-separated item and use the matching voice.
- New **Speak My Synonyms for personal vocabulary** setting is enabled by default and can be switched off.
- My Synonyms remains manual-only and is never overwritten by automatic services.

## Preserved

- 105 Verified Practice dialogues
- 85 Original Source dialogues
- V20 online semantic assessment
- V19.5 scalable Firebase sync
- My Vocabs CSV import/bulk translation, frozen columns, sticky header, resizable columns, right-click actions and Shift+Arrow selection
- Content Library Studio and Safe Merge
