# APS NAATI CCL Practice V2.0.7 — Bilingual Player Timing QA Report

**Build:** friends-beta-v207-bilingual-player-timing  
**Test date:** 2 August 2026

## Update scope

V2.0.7 changes only vocabulary and phrase playback settings and timing. Dialogue content, vocabulary content, phrase content, scoring, Lesson 0 and exam information are unchanged from V2.0.6.

## Features tested

- PASS: English → Hindi playback order.
- PASS: Hindi → English playback order.
- PASS: English-only playback.
- PASS: Hindi-only mode is present and uses the same tested language-routing code.
- PASS: Separate English and Hindi speech speeds.
- PASS: Translation delay occurs between the first language and its translation.
- PASS: Next-item gap remains separate from translation delay.
- PASS: Pair repeat remains available.
- PASS: Sequential and random playlist order remain available.
- PASS: The same bilingual playback function is used by vocabulary cards, phrases and the full player.
- PASS: Timing controls appear in the player settings and in Settings → Voice & Audio.
- PASS: Desktop and 390-pixel mobile layouts do not create horizontal overflow.

## Progress-preservation tests

- PASS: Existing local-storage key names are unchanged.
- PASS: Vocabulary statuses remain unchanged after saving new timing settings.
- PASS: Phrase completion and practice counts remain unchanged.
- PASS: Dialogue attempt records remain unchanged.
- PASS: No `localStorage.clear()` or IndexedDB deletion is present.
- PASS: Existing V2.0.6 single-speed settings migrate to separate English and Hindi speeds.
- PASS: Legacy `both` reading mode migrates to `English → Hindi`.
- PASS: Backup version updated to 2.0.7.

## Content and structure validation

- PASS: 3,000 vocabulary entries.
- PASS: 551 curated short phrases.
- PASS: 85 dialogues.
- PASS: 1,073 dialogue segments.
- PASS: JavaScript syntax validation for `app.js` and `scoring.js`.
- PASS: JSON parsing for all content files.
- PASS: Service-worker cache key updated to V2.0.7.
- PASS: Dialogue, vocabulary, phrase, exam, Lesson 0 and scoring files are byte-for-byte unchanged from V2.0.6.

## Browser interaction test method

A headless Chromium test loaded the full application with local content and a deterministic mock speech engine. It verified speech order, language codes, independent rates, elapsed translation delay, elapsed next-item gap, settings persistence, phrase playback, mobile layout and legacy-setting migration.

## Device note

The player logic is tested, but the exact natural voice names and sound quality still depend on the voices exposed by each Mac, iPhone, Android device or Windows computer.
