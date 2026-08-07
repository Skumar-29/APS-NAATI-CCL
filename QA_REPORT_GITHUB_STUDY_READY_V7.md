# APS NAATI GitHub Study Ready v7 QA

## Cross-device cloud progress sync

- Cloud sync engine added for the GitHub/browser version using Firebase Web Authentication + Cloud Firestore.
- Google and Email authentication code paths are enabled for web once the Firebase web app is configured.
- Existing local progress is merged on first cloud sign-in.
- Automatic upload triggers after tracked learning progress changes.
- Automatic cloud checks run on reconnect, app focus and visibility return.
- Settings includes a compact **Refresh** button to manually download newer progress from another device.
- Settings includes **Sync now** to manually upload the current device.
- Browser recordings are deliberately not uploaded.
- Device-specific English/Hindi voice selections remain local rather than overwriting another device's available voices.
- Guest mode remains local only.
- A no-Terminal setup guide is included as `FIREBASE_CLOUD_SYNC_SETUP.txt`.
- The cloud engine was exercised with an in-browser Firebase/Auth/Firestore mock: signed-in user restoration, initial cloud creation, automatic push after a local change and manual pull of newer remote progress all passed with zero page errors.
- A live production Firebase sign-in/write cannot be certified inside this build environment because the Firebase Web config, Authorized Domains and Firestore rules belong to the user's Firebase Console. The app detects missing setup and provides the setup workflow instead of deleting local progress.

## Player header / Settings layout

- The screenshot-reported circular/overlapping Settings control was corrected.
- Vocabulary/Phrase player: Search and Settings remain separate and non-overlapping.
- Dialogue player: Search and Settings remain separate and non-overlapping.
- Lesson player uses the same organised Settings control.
- Desktop/laptop width 1920 px: pass.
- Medium width 900 px: pass.
- Narrow mobile width 390 px: pass.
- On smaller screens the two controls switch to compact icon buttons instead of colliding with the title.

## Search and navigation regression

- Practice search still filters dialogue cards correctly.
- Home/Practice header Search and Settings do not overlap at 1920, 900 or 390 px test widths.
- Dialogue inline Skip Listening and Skip Recording controls remain present.

## Vocabulary and phrase order regression

- Vocabulary Random retains exactly the same IDs with no duplicates/omissions and changes the order.
- Switching Vocabulary back to In order restores the prior canonical sequence.
- Phrase player current total: 586 items (551 base + 35 approved pilot additions).
- Phrase Random retained the exact 586 IDs with no duplicates/omissions and changed the order.
- Switching Phrase back to In order restored the exact original phrase sequence.
- No JavaScript page errors were observed in the automated player/search/order tests.

## Content inventory

- 85 dialogues.
- 1,073 dialogue segments.
- 3,000 base vocabulary records + 22 approved pilot additions at runtime = 3,022 current cards.
- 551 base phrase records + 35 approved pilot additions at runtime = 586 current phrases.

## JavaScript validation

- `app.js`: syntax pass.
- `study-hotfix-v5.js`: syntax pass.
- `cloud-sync-v7.js`: syntax pass.
- `sw.js`: syntax pass.
