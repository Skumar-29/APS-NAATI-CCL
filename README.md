# APS NAATI CCL Practice — V15

**GitHub build:** `github-dialogue-learning-2026-08-09-v15`

V15 preserves the existing Firebase login/account flow, V14 natural-Hindi dialogue content, dialogue player, recording controls, Core Vocabulary, Phrases and prior progress.

## V15 additions

- **Dialogue Learning Hub** before Learning Mode with **Learn Vocabs** and **Start Dialogue**.
- **105 dialogue-specific vocabulary sets** with **1,649 key terms** selected from the dialogue title and the English meaning of all segments.
- The dialogue vocabulary reuses the existing vocabulary player.
- **Back to Dialogue** appears only when vocabulary was opened from a dialogue and works at any point, including halfway through.
- Partial dialogue-vocabulary progress is saved separately and can resume later.
- **Content Studio search** finds dialogues by number/ID, title, topic, English or Hindi text.
- Closing a Practice Mode report returns to **Dialogue Practice** rather than Home.
- Mock Test reports return to **Mock Test**.
- New dialogue-vocabulary progress is included in backup/restore and Firebase cloud sync.

## Deployment

Upload the contents of this folder to the same GitHub Pages repository used for V14. No Cloudflare change and no new Firebase project are required. Hard-refresh once after deployment so the V15 service-worker cache replaces V14.

See `CONTENT_RELIABILITY_V15.md` and `QA_REPORT_GITHUB_DIALOGUE_LEARNING_V15.md` for the implementation and QA summary.

---

## V16 — Content Library Studio

V16 preserves the V15 learner-facing system and adds an owner content-management layer. Open **Settings → Content reliability & editing → Open Content Library Studio** to manage Dialogues, Vocabulary, Phrases and Publish.

Vocabulary records can be edited or added with stable IDs, alternate Hindi meanings, English/Hindi examples, notes and allocations to Core Vocabulary, General Vocabs and multiple dialogues. Phrases have the same owner workflow for the main Phrase library and dialogue allocations. Draft changes remain owner-only; Reviewed changes can be tested locally; Published changes can be written to `content/owner-content-v16.json`.

The optional GitHub publisher uses a session-only token and never stores or exports that token. Recall/player mode also adds independent **Show/Hide Example** and **Speak Example** controls.

---

## V18 — Original Source

V18 keeps all 105 V17 **Verified Practice** dialogues unchanged and adds the earlier 85-dialogue source library as a separate **Original Source** collection. The restored collection contains 1,073 segments, uses the separate `original-*` ID namespace, has its own dialogue-vocabulary sets and separate progress reporting, and uses the same Learning Hub and Practice workflow as Verified Practice. Original Source is excluded from the current Mock Test pool until separately calibrated.

The Original Source language pass preserves the source scenario, conversation order, names, numbers, dates, amounts and substantive meaning while correcting English/Hindi language and model answers. Hindi is presented in simple, natural Devanagari; `चिकित्सक` is the preferred teaching term for doctor.

See `ORIGINAL_SOURCE_V18.md` and `QA_REPORT_GITHUB_ORIGINAL_SOURCE_V18.md`.
