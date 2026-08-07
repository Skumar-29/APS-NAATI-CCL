# APS NAATI GitHub Study Ready v6 QA

## Vocabulary and phrase order verification

- In-order vocabulary queue preserves the source Hindi vocabulary item order.
- Random vocabulary queue preserves the exact same IDs with no duplicates or omissions and changes sequence through Fisher-Yates shuffle.
- In-order phrase queue preserves the source Hindi phrase item order.
- Random phrase queue preserves the exact same IDs with no duplicates or omissions and changes sequence through Fisher-Yates shuffle.
- Order changes made while the vocabulary/phrase player is already open are now applied immediately.
- Switching from Random back to In order restores the canonical sequence while retaining the current item.
- Order setting remains shared by vocabulary and phrases and is saved on the device, as intended.

## Regression checks

- JavaScript syntax: pass.
- Hindi base content: 3,000 vocabulary items and 551 phrases.
- Dialogue pack: 85 dialogues / 1,073 segments.
- Search/button-layout hotfix v5 retained.
- Local GitHub recording and inline Skip controls retained.
- Update checker retained; service-worker cache advanced to v6.
