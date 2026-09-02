# QA Report — APS NAATI CCL V19.2 My Vocabs Google-Style Auto-Fill

**Passed:** true

## Checks
- PASS: version_v19_2
- PASS: no_mymemory_api (legacy name is referenced only for one-time repair detection; no MyMemory network call remains)
- PASS: no_datamuse
- PASS: google_style_primary
- PASS: dictionary_synonyms
- PASS: enter_autofill
- PASS: next_row_focus
- PASS: manual_protection
- PASS: legacy_auto_repair
- PASS: new_cache_key
- PASS: JSON parse (9 files)
- PASS: service-worker assets (33 checked)
- PASS: index references

## V19.2 behaviour
- New English words auto-fill when Enter is pressed; the next blank English row is focused immediately.
- V19.1 MyMemory translation is removed because it returned unrelated phrase fragments for simple words.
- Google-style online translation is attempted directly when online.
- Synonym suggestions are conservative: APS curated groups plus dictionary sense synonyms.
- Meaningful examples come from dictionary definitions/examples when available.
- Existing user-edited Hindi/examples/My Synonyms are not overwritten.
- Old V19.1 auto-generated rows are refreshed once when online, without overwriting manual fields.
- Bulk Refresh Missing remains optional for imports/old incomplete rows.
