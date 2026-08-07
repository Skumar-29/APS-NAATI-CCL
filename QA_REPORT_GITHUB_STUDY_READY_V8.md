# QA Report — GitHub Study Ready v8

## Recall display
- Hide English: implemented and persisted.
- Hide Hindi: implemented and persisted.
- Both can be enabled together.
- Tap current card: reveals only the current item.
- Tap again: hides the current item again.
- Previous/Next: reveal state resets automatically.
- Speaker button remains independently clickable and does not reveal the card.
- Examples are hidden until reveal when recall mode is active.
- Same player is used for vocabulary and phrases, so behaviour is identical.

## Voice discovery
- No voice provider was changed.
- English and Hindi lists include every matching voice returned by `speechSynthesis.getVoices()`.
- Voice lists deduplicate only exact duplicate browser entries.
- `voiceschanged` refresh remains enabled.
- Manual Refresh voices now polls multiple times to handle delayed Safari/Chrome voice discovery.
- Selected exposed voices remain previewable and usable.
- Browser limitation remains: a GitHub web app cannot force macOS/iOS to expose a downloaded system voice that Safari/Chrome does not report to the Web Speech API.

## Retained
- v7 cloud sync and manual Refresh.
- Local recordings.
- Practice search and header layout.
- Inline dialogue Skip controls.
- Vocabulary/phrase sequential and Fisher-Yates random order.
