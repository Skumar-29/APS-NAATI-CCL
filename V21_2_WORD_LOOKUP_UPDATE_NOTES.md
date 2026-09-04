# APS NAATI CCL Practice — V21.2 Instant Word Lookup

## Purpose
V21.2 adds an instant vocabulary lookup layer to the protected V21.1 Hindi-Clarity build. It is designed for moments when a learner understands most of a dialogue segment but needs one word or short phrase immediately before interpreting.

## What changed
- Visible words in dialogue source transcripts are clickable/tappable in Learning and Practice modes.
- Visible words in sample interpretations are clickable/tappable when Review is open.
- The popup shows the English ↔ active-language meaning beside the clicked word without leaving the dialogue.
- Clicking a word inside a reviewed multi-word term can resolve the full term when it appears in the sentence, for example `entry requirements`.
- A speaker button plays the selected word/phrase using the existing Voice Manager.
- If lookup is opened while the source TTS is still playing, the listening phase is safely interrupted and the old async flow is prevented from chiming and starting microphone recording behind the popup.
- Lookup is blocked while the learner is already recording, so an active response is not interrupted or corrupted.
- `+ Add to My Vocabs` saves the English/active-language pair directly to the existing My Vocabs smart sheet.
- Existing duplicate handling is reused: Open existing / Add separate meaning / Cancel.
- Existing language isolation is reused, so Hindi and Punjabi personal vocabulary remain separate.
- Mock Test Mode deliberately does not enable word lookup.

## Lookup priority
1. Current dialogue vocabulary
2. Core vocabulary
3. Reviewed General Vocabs
4. Reviewed short phrase records
5. Existing online translation fallback

General vocabulary rows marked `source-reference` / review-required are deliberately excluded from trusted instant lookup. This prevents old malformed PDF-derived text from being presented as a reliable learner meaning.

## Protected systems unchanged
- V21.1 repaired Hindi dialogue content
- 190 Hindi dialogue IDs and 2,346 segment IDs/order
- 105 Verified Practice + 85 Original Source structure
- Hindi Core/General/Phrases/Dialogue Vocabulary content files
- Punjabi 5-dialogue pilot content
- assessment and transcription Firebase Functions
- `synthesizeSpeech` Firebase Function
- scoring logic and assessment cache schema
- progress, mistakes and dialogue-attempt storage schemas
- My Vocabs spreadsheet behaviour, Recall, My Synonyms and cloud sync

## Backend
No Firebase Functions deployment is required for V21.2.

## Cache/update
The service-worker shell cache is versioned to V21.2 and includes the new lookup JavaScript/CSS assets.
