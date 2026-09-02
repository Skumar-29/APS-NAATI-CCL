# APS NAATI CCL Practice V20.1 QA Report

**Result: 52/52 checks passed.**

- PASS — Version is 20.1
- PASS — Compact practice flag
- PASS — Response/sample side-by-side flag
- PASS — Sample no-auto-scroll flag
- PASS — Icon-first controls flag
- PASS — Online assessment remains enabled
- PASS — V19.5 cloud sync preserved
- PASS — V20.1 CSS loaded after V20 CSS
- PASS — V20.1 JS loaded after V20 JS
- PASS — Recording panel refinement installed
- PASS — Response/sample grid exists
- PASS — Sample card next to response exists
- PASS — Sample play remains available
- PASS — Search icon enhancement
- PASS — Settings icon enhancement
- PASS — Add vocab icon enhancement
- PASS — Compact source actions
- PASS — Compact review action
- PASS — Compact record again
- PASS — Duplicate transcript hidden
- PASS — Old sample toggle hidden
- PASS — Old sample block hidden
- PASS — Desktop side-by-side response/sample
- PASS — Mobile response/sample collapse
- PASS — Top icon buttons tinted
- PASS — Add vocab icon separately tinted
- PASS — Compact source card
- PASS — Compact feedback styling
- PASS — Responsive controls no-overlap safeguards
- PASS — New shell cache name
- PASS — V20.1 CSS precached
- PASS — V20.1 JS precached
- PASS — JS syntax: app.js
- PASS — JS syntax: online-v20.js
- PASS — JS syntax: online-v20-1.js
- PASS — JS syntax: sw.js
- PASS — JS syntax: my-vocabs-v19-4.js
- PASS — JS syntax: cloud-sync-v11.js
- PASS — JSON parse: version.json
- PASS — JSON parse: content/languages.json
- PASS — JSON parse: content/exam_info.json
- PASS — JSON parse: content/lesson0.json
- PASS — JSON parse: content/online-manifest-v20.json
- PASS — Learning content unchanged from V20
- PASS — Preserved core file: app.js
- PASS — Preserved core file: cloud-sync-v11.js
- PASS — Preserved core file: my-vocabs-v19-4.js
- PASS — Preserved core file: scoring.js
- PASS — Preserved core file: reliability-v15.js
- PASS — Preserved core file: content-library-v17.js
- PASS — Preserved core file: original-source-v18.js
- PASS — All service-worker precache assets exist

## Scope
- V20.1 changes only the dialogue practice presentation layer and version/cache metadata.
- V20 online semantic assessment, V19.5 scalable cloud sync, My Vocabs, Content Studio, and learning content are preserved.
- The 105 Verified Practice + 85 Original Source learning content files are byte-for-byte unchanged from V20.

## Browser validation note
- Static responsive/no-overlap safeguards are included and JavaScript syntax/service-worker checks pass.
- A real authenticated end-to-end online assessment click-through still needs to be verified on the deployed GitHub/Firebase app because this build environment cannot sign in to the user’s Firebase account.
