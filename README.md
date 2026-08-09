# APS NAATI CCL Practice — V14 Natural Hindi Full Rebuild

This folder is ready to replace the current files in the existing GitHub Pages repository.

## What V14 changes

- **105 dialogues / 1,273 segments** remain available with stable dialogue and segment IDs.
- The **80 old machine-formatted legacy dialogues were rebuilt** with new APS practice wording instead of spelling-patching corrupted Roman-Hindi conversions.
- The remaining **25 already-clean pilot/original dialogues were revalidated and normalised** to the same V14 terminology and answer-flexibility policy.
- Student-facing Hindi uses **simple, natural Standard Hindi**. The preferred term for doctor is **चिकित्सक**; dentist is **दंत चिकित्सक** and veterinarian is **पशु चिकित्सक**.
- Sample answers are examples, not exact sentence keys. Valid synonyms, natural paraphrases, word-order variation, and active/passive changes may be accepted when the same meaning and critical details are preserved.
- Every segment has meaning units, critical-detail metadata and an explicit answer-flexibility policy.
- All source segments are **35 words or fewer**.
- The obsolete Pilot50 runtime overlay was removed so an old pilot segment cannot silently overwrite V14 content.
- **General Vocabs** remains separate from the core CCL vocabulary. Only reviewed General Vocabs are shown in the learner UI; raw PDF-reference terms remain preserved in the data for future editorial review.
- Content Studio remains available for owner edits, adding a missing segment, deleting/reordering a segment, and JSON import/export.

## What V14 deliberately does not change

The main `app.js` and `cloud-sync-v11.js` are unchanged from V13. This preserves the existing:

- Firebase login/account flow
- Google / Apple / Email / Guest account behaviour already present in the build
- cloud progress sync
- recording and playback
- transcript toggle
- speed and response-gap controls
- voice settings
- dialogue player behaviour
- progress history and recall features

**No Cloudflare setup is required.**

## Upload to the existing GitHub repository

1. Extract the V14 ZIP.
2. Open your existing APS NAATI GitHub repository.
3. Upload **everything inside the extracted V14 folder** to the repository root and replace the older files.
4. Commit the changes.
5. Wait for GitHub Pages to publish.
6. Open the app and hard-refresh once, or close and reopen the installed web app, so the V14 service-worker cache replaces the previous version.

Do not upload the outer ZIP itself as the website contents; upload the files and folders inside it.

## Quality reports

See:

- `CONTENT_RELIABILITY_V14.md`
- `QA_REPORT_GITHUB_NATURAL_HINDI_V14.md`
- `QA_REPORT_GITHUB_NATURAL_HINDI_V14.json`

The automated QA checks structure, duplicate IDs, segment length, JSON/JavaScript validity, known legacy corruption markers, terminology and service-worker assets. Language assessment remains meaning-first; the stored alternatives are not intended to be an exhaustive list of every valid interpretation.
