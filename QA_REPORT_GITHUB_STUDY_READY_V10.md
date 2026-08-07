# APS NAATI CCL Practice - GitHub Study Ready v10 QA

## Purpose
Fix the v9 cross-device setup defect where each new browser asked the user to paste the Firebase Web configuration again.

## Verified
- Firebase Web configuration is bundled directly in the web client.
- A clean browser can initialise Firebase without a localStorage config entry.
- Existing per-device saved config remains compatible as a fallback.
- Firebase project ID is still hard-gated to `aps-naati-ccl-practice`.
- Google and Email web auth paths are retained.
- Firestore collection remains `apsUserProgress/{uid}`.
- Manual Refresh and Sync now controls are retained.
- Service-worker cache version advanced to v10.
- No dialogue, vocabulary, phrase, recording, recall-history or scoring data was removed.

## Security
The Firebase web configuration identifies the public web app; authorization of user data remains enforced by Firebase Authentication and the published Firestore user-scoped rules.
