# V21.3.2 — Mock Test Exam Pace

## Change
- Mock Test source speech is now locked at relative TTS rate **0.90** instead of **1.00**.
- Normal Practice/Learning speed controls are unchanged.
- Mock Test remains locked: no transcript help, manual response flow, one penalty-free repeat per dialogue.
- Mock screen wording now says **Exam-style speaking pace**.

## Why
NAATI publishes the CCL structure (two pre-recorded dialogues, roughly 300 words each, 12–14 short segments, maximum 35 words per segment) and provides retired real-test MP3 practice material, but does not publish a fixed WPM or a Web Speech API rate value. Browser TTS `rate=1` is only the default for the selected platform/voice and can sound materially faster across voices. Live testing of V21.3.1 found the locked mock rate of 1.0 too fast.

The 0.90 value is therefore a product calibration for the currently preferred Google English/Hindi voices, not an official NAATI numeric speed.

## Backend
No Firebase deployment required.
