# APS NAATI CCL Practice V20.3.1 — Dialogue Navigation Hotfix

Focused reliability patch for Previous/Next segment navigation.

## Fixed
- Previous/Next now cancels stale source playback, countdown and pre-recording work before switching segments.
- Navigation is blocked while an active recording is in progress; finish or skip the recording first.
- A stale asynchronous Play operation can no longer start the microphone after the learner has moved to another segment.
- Completed response audio object URLs are detached from transient recording state so starting another segment does not revoke earlier saved response playback.
- When revisiting a completed segment, its saved recording is rehydrated from IndexedDB when available.

## Preserved
- V20.3 My Vocabs Smart Sheet
- V20.2 whole-app UI cleanup
- V20.1 compact practice workspace
- V20 online semantic assessment
- V19.5 scalable Firebase sync
- all 190 dialogue and vocabulary content files
