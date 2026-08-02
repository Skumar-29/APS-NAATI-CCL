# APS NAATI CCL Practice — Friends Beta V2.0.7

This folder is ready for GitHub Pages. Once deployed over HTTPS, friends can install it like an app on Mac, iPhone, Android and Windows. No Terminal is required.

## Publish with GitHub Pages

1. Create a new GitHub repository, for example `aps-naati-ccl-beta`.
2. Upload **the contents of this folder** to the repository root.
3. Open the repository **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Open the **Actions** tab and wait for `Deploy APS NAATI CCL Practice Beta` to finish.
6. Copy the Pages address shown by GitHub and send it to testers.

## Install on devices

### Mac (Safari, macOS Sonoma 14 or later)
Open the beta link in Safari, then choose **File → Add to Dock**.

### iPhone
Open the beta link in Safari, tap **Share → Add to Home Screen**, turn on **Open as Web App** when shown, then tap **Add**.

### Android
Open the beta link in Chrome, open the menu, and choose **Install app** or **Add to Home screen**.

### Windows
Open the beta link in Edge or Chrome and choose **Install app** from the browser menu/address bar.

## Important beta notes

- The app stores current learning progress primarily on each device.
- A user's progress does not automatically move to another device yet.
- Test microphone, recording, dialogue audio, vocabulary player and offline reopening on every device type.
- Do not promote imported dialogues as fully human-verified until bilingual review is complete.


## V2.0.3 progress update

- Vocabulary section contains only reviewed vocabulary and short terms; dialogue sentence cards were removed.
- Phrase completion, remaining count and practice count are saved locally.
- Dialogue completion, remaining count and number of completed practices are shown in Practice and Progress.
- Existing dialogue attempts from earlier versions are automatically included in the new records.


## V2.0.3 final comparison upgrade

After recording a segment, choose **Check my answer** to view:

- your optional automatic transcript;
- a sample interpretation;
- key meaning points;
- short suggested notes;
- a note-taking technique for that specific segment; and
- a button to hear the sample answer.

This is available for all 85 dialogues and 1,073 segments. Mock Test answers remain hidden until the test is complete.


## V2.0.4 pagination update

- Vocabulary is displayed in 25 pages of up to 120 cards.
- Phrases are displayed in 10 pages of up to 120 cards.
- Previous, Next and direct page selection are available above and below the cards.
- Search and filter changes automatically return to page 1.
- **Play all current filters** includes every matching item, not only the visible page.


## V2.0.5 curated phrase-library update

- Removed the imported full dialogue segments that previously appeared after phrase 120.
- Replaced them with **551 reviewed short phrases**.
- Preserved the original 120 core phrase IDs for progress compatibility.
- Added topic-based phrases covering all CCL domains used by the 85-dialogue library.
- Added at least two dialogue-specific phrases for every one of the 85 dialogues.
- Phrase cards contain no long multi-sentence dialogue segments.
- Maximum English phrase length is 11 words.
- Phrase pagination now shows 5 pages at up to 120 cards per page.


## V2.0.6 Voice & Audio settings

- Added a **Settings** button to the main app header.
- English and Hindi learning voices can be selected and previewed.
- Dialogue Speaker 1 and Speaker 2 can use separate English and Hindi voices.
- Selected voices are stored in the existing settings record, so vocabulary, phrase, dialogue, Lesson 0, completion and attempt progress remain unchanged during the update.
- Existing voice choices from older versions are preserved as the learning-voice fallback.
- Added Refresh voices and Use automatic voices controls.
- Voice availability depends on the voices exposed by the current device and browser.


## V2.0.7 bilingual player timing

- Added a separate delay between a vocabulary word or phrase and its translation.
- Kept the next-item gap as an independent setting.
- Added English → Hindi, Hindi → English, English-only and Hindi-only playback modes.
- Added separate English and Hindi speech speeds.
- Existing repeat, playlist order, examples and voice selections remain available.
- Older saved `rate` and `both` settings are migrated automatically without clearing progress.
- The same controls work for both vocabulary and phrases.
