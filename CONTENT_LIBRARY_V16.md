# APS NAATI CCL Practice — V16 Content Library Studio

V16 preserves the working V15 learner app and adds an owner-side content management layer.

## Owner Content Library Studio

Open **Settings → Content reliability & editing → Open Content Library Studio**.

Tabs:
- **Dialogues** — opens the preserved searchable dialogue editor for source lines, sample answers, alternatives, meaning points, critical details, missing segments and reordering.
- **Vocabulary** — search/edit/add vocabulary, meanings, synonyms, English/Hindi examples, notes and topics. Allocate one stable vocabulary record to Core Vocabulary, General Vocabs and any number of dialogues.
- **Phrases** — search/edit/add phrases and allocate one stable phrase record to the main Phrases library and any number of dialogues.
- **Publish** — review local owner edits, export/import a V16 backup and optionally publish the small owner content layer to GitHub.

## Stable IDs and learner progress

Existing records keep their original IDs when wording, spelling, meaning, examples or allocations are edited. New owner records receive a stable generated ID. Archive removes an item from current student content without erasing the learner-progress record stored under that ID.

## Draft / Reviewed / Published

- **Save Draft** keeps the change in the owner studio without changing student-facing content.
- **Mark Reviewed** applies it on the current device and makes it eligible for publishing.
- **Published** means the reviewed record has been written to the GitHub owner-content layer.

## GitHub publishing

V16 updates only `content/owner-content-v16.json`, not the full app/database. Repository owner/repository/branch can be remembered locally; the GitHub token is session-only and is not stored in localStorage or included in exports. Use a fine-grained token restricted to this repository with Contents write permission. For a future multi-admin production system, replace this owner-only method with a backend/GitHub App flow.

The service worker uses network-first loading for the owner-content file so a content-only GitHub update can appear without requiring a new app release/cache version.

## Recall example controls

Vocabulary/phrase recall now has independent controls for:
- Hide/Show English
- Hide/Show Hindi
- Hide/Show Example
- Speak Example on/off in player settings

Example display and example speech are independent. A learner may hide an example while keeping it spoken, or show it without speaking it.

## Preserved V15 systems

V16 does not replace the Firebase login/account flow, player, recording, scoring, Dialogue Learning Hub, dialogue vocabulary progress, Core Vocabulary progress, phrase progress or existing settings/progress IDs.
