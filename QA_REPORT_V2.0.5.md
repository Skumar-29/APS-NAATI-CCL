# APS NAATI CCL Practice V2.0.5 — Phrase Library QA Report

## Purpose

Replace the full dialogue segments that appeared after the first 120 phrase cards with a genuine short-phrase learning library.

## Final content

- Vocabulary: **3,000** words and short terms
- Phrases: **551** short English–Hindi phrases
- Dialogues: **85**
- Dialogue-specific phrase coverage: **85 of 85 dialogues**
- Core phrase IDs preserved: **120 of 120**
- New curated phrases: **431**

## Phrase-quality checks

- Duplicate English phrases: **0**
- Imported full-segment IDs (`dlg-p-*`): **0**
- Multi-sentence phrase cards: **0**
- Maximum English phrase length: **11 words**
- Cards containing Devanagari Hindi: **551 of 551**
- Dialogue titles/topics reviewed for phrase coverage: **85 of 85**

## Pagination verification

- Page size: **120**
- Phrase pages: **5**
- Pages 1–4: up to 120 cards each
- Final page: **71** cards
- Previous, Next and direct page selection remain data-driven from V2.0.4.

## Technical checks

- `app.js` syntax: passed
- `scoring.js` syntax: passed
- All JSON files parsed successfully
- Dynamic phrase count uses `state.phrases.length`
- Phrase completion and practice counts remain enabled
- Service-worker cache updated to V2.0.5
- Existing first-120 phrase progress remains compatible

## Review boundary

The phrase bank has been structurally validated and written as short, natural learning units. As with all bilingual education content, user feedback and a second independent bilingual review remain useful before the public App Store release.
