# APS NAATI CCL Practice V19.5

## Scalable Cloud Sync + Performance

V19.5 is an infrastructure release built on the V19.4.2 learner experience. It does not replace or rewrite the study content.

### Cloud progress structure

Older builds attempted to keep almost all cross-device data inside one Firestore document. Once My Vocabs and recall/history grew, that document could exceed Firestore's 1 MiB document limit.

V19.5 keeps `apsUserProgress/{uid}` small and stores learner data under child collections:

- `apsUserProgress/{uid}/sections/{progressKey}`
- `apsUserProgress/{uid}/sections/{progressKey}/chunks/{chunkNumber}` only for unusually large sections
- `apsUserProgress/{uid}/myVocabs/{vocabId}`

Automatic sync writes only changed progress sections. My Vocabs records sync independently and are merged by their per-record update timestamps.

### Safe migration

On the first signed-in V19.5 sync, the app can read the older root `keys` progress map, merge it with local progress, write the new scalable structure, and remove the legacy root `keys` field only after the new writes succeed. Local data remains on the device throughout the migration.

The Firestore rules must be updated before migration. See `FIREBASE_CLOUD_SYNC_SETUP.txt` and `firestore-v19-5.rules`.

### Performance changes

- Service-worker install precache reduced to the application shell instead of all language-pack JSON.
- Large language-pack JSON uses a separate runtime cache with stale-while-revalidate behavior.
- Previously cached language packs are copied from an older cache during service-worker activation before the obsolete cache is removed.
- General and dialogue vocabulary fetches no longer force `no-store` network reloads.
- Supplemental vocabulary loads in parallel with the core language pack instead of as a second sequential phase.
- Packaged dialogue/content references are preserved instead of repeatedly deep-cloning multi-megabyte data where the owner override layer already creates new output structures.
- My Vocabs keeps an in-memory store and coalesces local persistence during bulk translation instead of JSON-stringifying the full sheet after every translated word.

### My Vocabs UI

The visible sheet is now:

`No. | English | Hindi Meaning | My Synonyms | Recall`

The Actions column is removed. Right-click a row (or selected rows) for Play, Translate/refresh Hindi, Recall status, Delete, and Clear selection. Existing sticky headers, frozen No./English/Hindi columns, resizable widths, bulk translation, Enter-to-next-row, and Shift+Arrow row selection remain.

### Content preservation

The packaged Hindi learning data is unchanged from V19.4.2: 190 dialogues (105 Verified Practice + 85 Original Source), 3,000 Core Vocabulary items, 3,009 General Vocabulary source records, 551 phrases, and 190 dialogue-vocabulary sets.
