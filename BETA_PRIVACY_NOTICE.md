# Beta Privacy Notice

This friends-beta build is intended for private testing.

- Dialogue recordings and learning progress are designed to remain on the tester's device in this build unless a future connected AI feature explicitly asks permission to upload them.
- Testers should not enter confidential personal information.
- Testers may clear local app data through browser/site settings.
- Before public release, publish a complete privacy policy and verify all storage and upload behaviour.


## V21.3 Recently Appeared reports

If a signed-in learner uses **Appeared in my test**, the app sends the selected dialogue ID and the learner-selected appearance date to protected Firebase Functions. The backend keeps at most one current report per signed-in user and dialogue, stores a one-way hash instead of the raw Firebase user ID in the report document, and exposes only aggregate counts and dates to other learners. Aggregate storage is grouped by dialogue and month with per-day counts; it does not contain student identities. A learner can remove or change only their own report through the app. Recent-topic reports are candidate/student reports and are not official NAATI topic confirmations or predictions.
