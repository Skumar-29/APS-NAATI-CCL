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
