# APS NAATI CCL Practice — Content Reliability V15

## Purpose
V15 adds a dialogue-specific learning layer without replacing the V14 natural-Hindi dialogue rebuild or changing the established account/login flow.

## Dialogue learning flow
When a student selects **Learning Mode**, the app opens a Dialogue Learning Hub with two independent choices:

1. **Learn Vocabs** — opens the existing vocabulary player with only the important vocabulary selected for that dialogue.
2. **Start Dialogue** — opens the existing Learning Mode dialogue player immediately.

Vocabulary is recommended but never compulsory. A student can return to the Dialogue Learning Hub at any time, including midway through the vocabulary set.

## Dialogue-specific vocabulary
- 105 dialogue vocabulary sets.
- Every set is built from the dialogue title and the English meaning of all dialogue segments.
- Filler words and false-context matches are intentionally excluded.
- Student-facing wording uses simple, natural Hindi.
- Preferred medical terminology includes **चिकित्सक**, **दंत चिकित्सक**, **विशेषज्ञ चिकित्सक** and **पशु चिकित्सक**.
- Dialogue vocabulary uses unique IDs and a separate progress record so Core Vocabulary progress is not overwritten.

## Owner Content Studio
V15 adds dialogue search by:
- dialogue number / ID
- dialogue title
- topic
- English dialogue text
- Hindi dialogue text

The existing selector, segment editor, add/delete/reorder functions, import/export, and local override model remain available.

## Report navigation fix
Closing a completed Practice Mode dialogue report now returns the student to the **Dialogue Practice** page, preserving the current filters and search state. A Mock Test report returns to **Mock Test**.

## Progress safety
Existing dialogue attempts, Core Vocabulary, Phrases, Lesson 0, account data, recordings/settings and prior progress keys remain in place. V15 adds a new dialogue-vocabulary progress key and includes it in progress backup/restore and Firebase cloud sync.
