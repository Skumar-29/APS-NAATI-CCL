# QA Report — V21.3.2 Mock Test Exam Pace

- Mock constant exists: `MOCK_EXAM_SPEECH_RATE=0.90`
- `openDialogue(..., "mock")` uses the locked mock constant
- Practice default remains 0.90 and practice speed selector remains available
- Mock Test speed selector remains hidden/locked
- Recent mock pair uses the same mock engine and calibrated pace
- Hindi/Punjabi content files unchanged
- Firebase functions unchanged
- Service worker cache bumped to V21.3.2
- JavaScript syntax checks passed

Note: NAATI does not publish a numeric speaking WPM/rate for CCL. This is a relative TTS calibration based on official test structure plus live app testing.
