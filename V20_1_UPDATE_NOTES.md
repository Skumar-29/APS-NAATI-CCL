# APS NAATI CCL Practice V20.1 — Compact Practice Workspace

V20.1 is a UI-only refinement of the V20 online-first assessment experience. It does not change dialogue content, scoring prompts, Firebase cloud sync, My Vocabs data, Content Studio, or the deployed `assessAttempt` function.

## Practice-page changes
- Response transcript/audio and Sample Interpretation are side-by-side on desktop when Review is open.
- The old duplicate transcript and sample blocks inside the feedback panel are hidden.
- The separate Show Sample Answer control is no longer needed on the segment page, so opening the sample cannot jump the page.
- Source, response, feedback, meaning points, short notes, and navigation cards use tighter spacing and smaller radii/padding.
- Search, Settings, and Add My Vocab are icon-first compact controls with accessible titles.
- Replay, Repeat, Review, Record Again, Previous, Next, and Finish use shorter labels and icons.
- Source transcript is a compact icon toggle; its colour still shows On/Off state.
- Desktop source text shares the row with Skip/Play controls; mobile safely returns to a stacked layout.
- Responsive breakpoints collapse side-by-side content before it can overlap.

## Preserved
- V20 online semantic assessment and local fallback.
- V19.5 scalable cloud sync and My Vocabs cross-device architecture.
- 105 Verified Practice + 85 Original Source dialogues.
- All learning content and stable IDs.
