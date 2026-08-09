# APS NAATI CCL Practice — V17 QA Report

**Checks:** 77/77 passed · **Failures:** 0

## Scope
V17 adds safe vocabulary/phrase merge, controlled draft deletion and a clearer save/apply workflow while preserving the V16 learner/account/player/content system.

## Key results
- PASS — empty owner layer omitted from distributable: Protects any existing GitHub owner-content-v16.json from upload overwrite.
- PASS — service-worker precache paths exist
- PASS — preserve app.js: 931fa70886c1
- PASS — preserve cloud-sync-v11.js: ed01d99c24a6
- PASS — 105 dialogues preserved: 105
- PASS — 3000 core vocab preserved: 3000
- PASS — 551 phrases preserved: 551
- PASS — 3009 general vocab preserved: 3009
- PASS — dialogue vocab 105 sets preserved: 105
- PASS — dialogue vocab 1649 items preserved: 1649
- PASS — runtime safe-merge progress migration smoke test: ",       "stage": "1w",       "dueAt": "2026-08-11T00:00:00Z",       "completedStages": [         "1d"       ],       "updatedAt": "2026-08-09T16:56:01.902Z"     }   },   "dp": {     "dialogue-23": {       "visitedIds": [         "v1"       ],       "lastId": 

## Safety design
- Existing/published records are archived or merged, not hard-deleted.
- Permanent delete is restricted to unused unpublished drafts with no progress/merge references.
- Merge aliases preserve old stable IDs and migrate status, recall, resume and dialogue-vocabulary progress.
- Phrase merges also combine phrase practice history.
- V17 deliberately reuses the V16 owner-content key/path for backward compatibility.
- The ZIP omits an empty `content/owner-content-v16.json` so an already-published owner file is not accidentally overwritten.

## Browser note
Static checks and a runtime merge/progress-migration smoke test passed. A final click-through on the deployed GitHub Pages build is still recommended.