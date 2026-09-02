# APS NAATI CCL Practice — V19.1 My Vocabs Online + Compact

This is a focused My Vocabs update. The 105 Verified Practice dialogues, 85 Original Source dialogues, master vocabulary, phrases, scoring, Content Studio and Firebase account/progress architecture are unchanged.

## Changes
- Compact sheet-first My Vocabs layout; removed the large hero/introduction area.
- Dedicated pop-out opens directly into a focused My Vocabs loading/sheet view instead of showing Home first.
- Closing a pop-out refocuses the original app; same-tab Back restores the originating tab/overlay/segment context.
- Online-first assistance when internet is available: translation, synonyms and dictionary context; installed APS data is fallback when offline or the online services fail.
- Automatic lookup starts when an English word is entered.
- Fast entry: English word + Enter saves it, starts lookup, creates/reuses a blank row and focuses the next English cell. Shift+Enter moves to the previous English cell.
- Fill Missing Details fills available details for the current filtered rows.
- Manual Hindi/examples/My Synonyms are protected from automatic overwrite.
- Online results are cached for 30 days to reduce repeated requests.
- Help explains online/offline behaviour and third-party online processing.

## Online services
The static GitHub Pages build uses public web translation/lexical endpoints with no embedded private API key. If an endpoint is unavailable, APS falls back to installed vocabulary. This can later be replaced by the project's protected Firebase backend without changing the My Vocabs data model.
