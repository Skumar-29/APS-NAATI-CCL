# APS NAATI CCL Practice V18 — Original Source

## Purpose

V18 keeps the existing 105 Verified Practice dialogues unchanged and adds the earlier organised 85-dialogue source library as a separate **Original Source** collection.

## Original Source preservation rule

For the 85 Original Source dialogues, the scenario, conversation sequence, speaker intent, names, numbers, dates, amounts and substantive meaning are preserved from the source audit. The content is not rewritten into a different APS scenario.

The editorial pass corrects:

- Hindi spelling and Devanagari errors
- Hindi grammar and unnatural machine-formatted wording
- English spelling/OCR and obvious grammar errors without deliberately changing the underlying facts
- English and Hindi model/sample answers
- target-language meaning units and critical details

Hindi is written in simple, natural Standard Hindi suitable for spoken interpreting. The preferred teaching term for **doctor** is **चिकित्सक**; dentist is **दंत चिकित्सक** and veterinarian is **पशु चिकित्सक** where applicable.

## Library separation

- Verified Practice: 105 existing V17 dialogues
- Original Source: 85 restored dialogues
- Total available: 190 dialogues

Original Source uses IDs `original-001` to `original-085`, with segment IDs such as `original-023-s01`. This prevents collision with the current `dialogue-*` IDs and protects existing V17 progress.

## Student workflow

Original Source uses the same core workflow as Verified Practice:

1. Dialogue Practice → Original Source
2. Learning Mode
3. Dialogue Learning Hub
4. Learn Vocabs or Start Dialogue
5. Practice Mode, recording and report
6. Return to the same dialogue library after closing the report

The existing player controls, transcript toggle, speed, gap, recordings and Firebase account system are preserved.

## Dialogue vocabulary

Each Original Source dialogue has a separate vocabulary set. The set prioritises vocabulary explicitly linked to that dialogue in the earlier 3,000-word audit and terms found in the restored dialogue, with conservative topic/title supplements where needed. Existing master vocabulary IDs are referenced where available; learner-facing dialogue-vocab IDs are separately namespaced.

## Mock Test

Original Source dialogues are deliberately marked `testEligible: false` in V18. They remain available for Learning and Practice, but they do not silently change the existing Mock Test pool until that separate calibration decision is made.

## Historical/source facts

The Original Source library intentionally preserves source facts and dates because the purpose of this collection is to restore the original test-like material. A language correction does not imply that every historical procedural statement is current official advice.
