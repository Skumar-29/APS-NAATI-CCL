# APS NAATI CCL Practice V2.0.3 — Final QA Report

## Update tested

This build adds optional answer comparison and segment-specific note-taking training throughout the dialogue library.

## Content validation

- Dialogues: **85**
- Dialogue segments: **1073**
- Segments with a sample answer: **1073 / 1073**
- Segments with short suggested notes: **1073 / 1073**
- Segments with a note-taking skill tip: **1073 / 1073**
- Segments with a key-meaning checklist: **1073 / 1073**
- Sample answers in the correct target-language script: **1073 / 1073**
- Average short-note length: **56.7 characters**
- Maximum short-note length: **115 characters**

## Functional validation

Passed:

- JavaScript syntax checks for `app.js` and `scoring.js`
- JSON parsing and schema checks
- Answer-review rendering test
- Check-my-answer open/close toggle test
- Student transcript display test
- Sample-answer display test
- Sample-answer playback control presence
- Short-note and note-skill display tests
- Mock-mode answer-lock code check
- Final report comparison content check
- Service-worker cache revision check
- GitHub Pages deployment files retained

## Behaviour

### Learning and Practice modes

After a response is recorded, the student can select **Check my answer**. The app then shows:

1. the student's optional automatic transcript;
2. one sample interpretation;
3. key meaning that should be included;
4. short notes for that exact segment;
5. a note-taking technique; and
6. a button to hear the sample interpretation.

### Mock Test mode

The transcript, sample answer and notes remain hidden until the two-dialogue mock test is finished.

## Content-quality boundary

The comparison system is complete for all 85 dialogues. Five pilot dialogues received the strongest manual structuring. Many imported dialogues still carry the existing bilingual-review flag, so naturalness and terminology should continue to be corrected when students or bilingual reviewers identify an issue. A sample answer is not the only acceptable answer; accurate synonyms and equivalent phrasing must be accepted.
