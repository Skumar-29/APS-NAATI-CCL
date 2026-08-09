APS NAATI CCL Practice — V16

This GitHub-ready build preserves the V15 learner app, natural-Hindi dialogue library, Firebase account/login system, player, recordings, scoring and existing progress.

V16 adds:
- Owner Content Library Studio with Dialogues / Vocabulary / Phrases / Publish tabs
- vocabulary search across Core, General and Dialogue Vocabs
- phrase search and editing
- add/edit Hindi meanings, synonyms, English/Hindi examples, notes and topics
- allocate one stable vocabulary record to Core Vocabulary, General Vocabs and multiple dialogues
- allocate phrases to the main Phrase library and multiple dialogues
- duplicate/sense warnings
- Draft / Reviewed / Published workflow
- archive / restore and revert-local-change options without deleting learner progress IDs
- owner content backup export/import
- optional Publish to GitHub for content/owner-content-v16.json using a session-only fine-grained token
- independent Show/Hide Example and Speak Example controls in recall/player settings
- network-first service-worker handling for the owner content layer after content-only GitHub updates

The V15 Dialogue Learning Hub and Back to Dialogue vocabulary flow continue unchanged.

V17 SAFE MERGE NOTE
-------------------
Content Library Studio now supports safe duplicate merge for vocabulary and phrases. Use Save Draft for unfinished work, Save & Apply for reviewed local changes, and the Publish tab for GitHub publishing. See CONTENT_LIBRARY_V17.md.
