# APS NAATI GitHub Study Ready v11 - Account System QA

## Scope
- Embedded Firebase config: learner never pastes config
- Google sign-in
- Email/Password account creation
- Password confirmation
- Verification email link
- Resend verification
- Verification status refresh
- Cloud sync gate for unverified password accounts
- Forgot password
- Signed-in reset password
- Friendly authentication errors
- Existing cross-device progress sync

## Security behaviour
- Email/Password cloud sync is disabled in the client until `emailVerified === true`.
- Recommended Firestore rule also denies unverified password-provider access.
- Google accounts can sync immediately when Firebase reports the trusted account verified.
- Guest accounts remain local-only.
- Firebase Web configuration is application configuration, not per-user configuration.

## Regression retained
- 85 dialogues
- 1,073 dialogue segments
- 3,000 base vocabulary items
- 551 base phrases
- practice history and recall scheduling
- Hide English / Hide Hindi + tap-to-reveal
- local recording, search, Skip controls, voice settings and update checker
