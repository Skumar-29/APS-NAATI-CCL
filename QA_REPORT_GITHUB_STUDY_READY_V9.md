# QA Report — GitHub Study Ready v9

## Daily practice history
- Today and Last 7 Days summaries are added to Progress.
- Day-by-day table records active study time, dialogue attempts, segments, vocabulary, phrases, recall completions and average dialogue score.
- Current study streak is calculated from recorded daily activity.
- Active-time tracking pauses when the page is hidden or idle.

## Spaced recall
- Vocabulary has separate 1 Day, 1 Week, 2 Weeks and 4 Weeks due lists.
- Phrases have separate 1 Day, 1 Week, 2 Weeks and 4 Weeks due lists.
- Dialogues stay as complete dialogues and can be started directly from the due list.
- Any interval can be enabled or disabled in Settings.
- Completing a stage schedules the next enabled stage.
- Vocabulary and phrase recall uses the existing v8 player, including Hide English / Hide Hindi and tap-to-reveal.
- Existing phrase and dialogue timestamps are seeded where available; vocabulary scheduling begins with v9 practice because older vocabulary records have no reliable timestamps.

## Reminder behaviour
- Daily reminder time is configurable.
- Reminder sound is configurable and includes a Test reminder button.
- Browser notification permission can be enabled from Settings.
- GitHub-only background limitation is stated in the UI: fully scheduled notifications while the app is closed require background push support.

## Cross-device sync
- Practice-day records, recall progress and recall settings are included in Firebase cloud sync.
- Daily records merge per device/day and recall records merge by newest item timestamp.
- Cloud sync debounce is fifteen seconds so continuous vocabulary practice does not create a write for every card.
- Manual Refresh and Sync now remain available.
- Audio recordings remain local.

## Retained v8 behaviour
- Hide English / Hide Hindi and tap current card to reveal.
- Voice provider unchanged; exposed Mac/iPhone voices remain discoverable.
- Local dialogue recording without Firebase transcription dependency.
- Inline Skip controls, Practice search, organised header controls.
- Vocabulary/Phrase In order and Fisher-Yates Random order.
