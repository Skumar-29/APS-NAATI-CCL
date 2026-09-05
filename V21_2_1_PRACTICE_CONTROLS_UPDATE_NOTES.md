# APS NAATI CCL Practice — V21.2.1 Practice Controls

Date: 2026-09-05

## Purpose
This is a small UI/recovery update on top of the protected V21.2 Instant Word Lookup + V21.1 Hindi Clarity build.

## Changes
- Moved **Online Assessment** out of Settings and into the dialogue player beside Speed and Gap.
- Added a compact sliding **Assessment ON/OFF** switch:
  - ON = green, knob on the right.
  - OFF = red, knob on the left.
- Replaced the unlabeled transcript icon with a clearly labelled compact **Transcript ON/OFF** switch.
- Shortened the visible **Response gap** label to **Gap**; the full description remains in the tooltip.
- Added/strengthened **Retry online** recovery when a reviewed response is using local fallback because online assessment is failed, unavailable, or temporarily offline.
- Retry clears the temporary client assessment cooldown and reruns review preparation + online semantic assessment for the current segment.
- If Assessment is switched ON while Review is already open, the current response is assessed immediately. Otherwise online assessment remains Review-triggered.
- Mock Test remains unchanged.

## Preserved
No changes were made to:
- Hindi or Punjabi content files.
- V21.1 Hindi clarity repairs.
- V21.2 Instant Word Lookup.
- My Vocabs or language isolation.
- Dialogue IDs, progress, attempts, or assessment cache schema.
- Firebase assessAttempt, transcribeAttempt, or synthesizeSpeech backend code.
- Scoring / target-language guard logic.

## Deployment
This is a web-only frontend update. No Firebase Functions deployment is required.
