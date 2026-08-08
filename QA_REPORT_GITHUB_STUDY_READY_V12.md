# APS NAATI GitHub Study Ready v12 - Transcript Layout QA

## Scope
- Dialogue source transcript layout on desktop/Mac
- Responsive transcript layout on tablet and iPhone widths
- Existing inline Skip control
- Existing source Play/Repeat controls
- Existing Transcript On/Off behaviour
- Service-worker cache refresh

## Root cause fixed
The source card used a two-column CSS Grid. After the inline **Skip** button was added before the source icon, automatic grid placement used both columns in row 1 and placed the transcript paragraph into the narrow first column on row 2. That caused the transcript to wrap almost word-by-word.

## Fix
- The source card now reserves a compact first-row control area.
- The transcript paragraph explicitly spans the entire grid from column 1 to the final column on row 2.
- Normal word wrapping is enforced; normal English/Hindi dialogue text is not broken word-by-word.
- Transcript text is left-aligned and capped at a comfortable 850 px reading width on large displays.
- Tablet/mobile widths use the full available transcript width.
- Source action buttons remain on their own full-width row.
- The service-worker cache is bumped to v12 so existing installations receive the changed stylesheet.

## Regression retained
- v11 proper account system
- Google and email/password sign-in
- Email verification and password recovery
- Cross-device Firebase progress sync
- Guest local-only mode
- 85 dialogues / 1,073 segments
- 3,000 base vocabulary items / 551 base phrases
- Practice history and recall scheduling
- Hide English / Hide Hindi recall features
- Local recording, Skip controls, search, voice settings and update checker
