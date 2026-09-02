# APS NAATI CCL Practice V20 — Online-First Learning Platform

## Product rule

**Online for intelligence and synchronization; cache/local storage for speed and resilience.** Navigation, playback, recording safety, filtering and cached content remain local/instant. Online services are used for transcription, semantic assessment, cloud progress and content freshness.

## V20 changes

- Main navigation reorganized to **Home / Learn / Practice / Review / Progress**.
- Mock Test remains available inside Practice.
- New Review area combines weak segments, recent reports and My Vocabs revision.
- Home is a next-action dashboard instead of a feature catalogue.
- Web practice can use the existing cloud transcription endpoint when a Firebase web user is signed in.
- New optional `assessAttempt` Cloud Function provides online semantic scoring and specific feedback.
- Online assessment is cached locally by segment + transcript.
- Local meaning scoring was recalibrated to be more meaning-recall focused and less punitive of harmless extra/grammar words.
- Practice comparison no longer duplicates the transcript/sample/meaning text.
- Feedback is separated into meaning transfer, critical details, language improvement, delivery and genuine short notes.
- Sample answers and note-taking tips are collapsible.
- Existing 105 Verified Practice + 85 Original Source content is unchanged.
- Existing V19.5 scalable cloud progress and My Vocabs architecture is preserved.

## Fallback behaviour

If online assessment is unavailable, the page clearly says **Local estimate** instead of presenting the local matcher as equivalent to cloud semantic assessment. The learner can continue recording, playback, practice and review without losing work.
