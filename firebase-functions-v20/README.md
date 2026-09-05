# APS NAATI CCL Practice — Firebase Functions (V21.3)

This folder contains the existing assessment function plus the two new privacy-preserving
**Recently Appeared** aggregation functions.

## V21.3 backend change

New functions only:

- `reportRecentDialogue`
- `getRecentDialogueStats`

They run in `australia-southeast1` and require Firebase Authentication. A user can maintain
one current report per dialogue. The report document uses a one-way hash of the Firebase UID;
aggregate monthly documents contain only dialogue/month/per-day count information. The web client never
reads or writes these Firestore collections directly. Monthly aggregation keeps Recent filters efficient for large user counts while preserving day/week/month/custom date filtering.

## Deploy ONLY the V21.3 functions

From this `firebase-functions-v20` folder:

```bash
npm install
firebase deploy --only functions:reportRecentDialogue,functions:getRecentDialogueStats --project aps-naati-ccl-practice
```

Do **not** redeploy `assessAttempt`, `transcribeAttempt`, or `synthesizeSpeech` for this update.
Their working behaviour is not changed by V21.3.

No new OpenAI secret is required for the Recently Appeared functions.
