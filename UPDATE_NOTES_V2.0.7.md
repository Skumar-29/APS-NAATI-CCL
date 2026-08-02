# APS NAATI CCL Practice V2.0.7 — Bilingual Player Timing

## Added

- Separate **translation delay** between the first language and its meaning.
- Separate **next-item gap** before the following word or phrase.
- Reading order: English → Hindi, Hindi → English, English only, Hindi only.
- Independent English and Hindi speech speeds.
- Repeat each bilingual pair 1–3 times.
- Controls available in the player and in Settings → Voice & Audio.

## Default playback

English word → 1.5-second translation delay → Hindi meaning → 2-second next-item gap → next word.

## Progress safety

V2.0.7 keeps the same local-storage and IndexedDB names as V2.0.6. It does not clear vocabulary status, phrase practice counts, dialogue attempts, reports, recordings, Lesson 0 progress, mistakes, or selected voices. Older single-speed settings are migrated to the new English and Hindi speed fields.
