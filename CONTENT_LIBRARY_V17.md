# APS NAATI CCL Practice — V17 Safe Merge & Library Cleanup

## Purpose
V17 extends the V16 Content Library Studio without changing the Firebase login/account flow, dialogue player, Learning/Practice modes, Dialogue Learning Hub, recordings, scoring, or existing content IDs.

## Saving an edited word or phrase
- **Save Draft (not live):** stores the edit locally for later work. Learners continue to see the current reviewed/published version.
- **Save & Apply:** saves the edit as reviewed and applies it immediately on the current device/app session.
- **Publish tab → Publish to GitHub:** commits reviewed edits to the GitHub owner-content layer so deployed users can receive them. Drafts are not published.

## Safe Merge
Vocabulary and phrases can be merged when two records are genuine duplicates.

1. Open the record you want to clean up.
2. Choose **Safe Merge…**.
3. Search/select the other record.
4. Compare both records.
5. Choose **Keep current as main** or **Keep selected as main**.

V17 then:
- combines Core/General/Main and dialogue allocations;
- preserves useful Hindi alternatives and examples;
- migrates learner status using the strongest state (Known > Learning > Listen Again > New);
- migrates spaced-recall records;
- migrates vocabulary resume position;
- migrates dialogue-vocabulary visited progress;
- for phrases, combines phrase practice history;
- retains the removed stable ID as an alias to the kept ID instead of destroying it.

This alias model also migrates old-ID progress when a published merge is loaded on another device.

## Delete / Archive policy
- Existing or published content uses **Archive** instead of destructive deletion.
- A true duplicate should use **Safe Merge**.
- **Delete unused draft** appears only for an owner-created, unpublished draft with no learner-progress references and no merge dependency.

## Important distinction
Words that look similar are not automatically merged. Synonyms and different senses should normally remain separate. Example: `charge = शुल्क`, `charge = आरोप लगाना`, and `charge = चार्ज करना` are different senses.

## Compatibility
V17 deliberately continues to use the existing local owner key and GitHub path `content/owner-content-v16.json`. This preserves V16 owner edits and avoids a content reset. The schema inside that layer is upgraded to 1.1 when V17 publishes.

The distributable ZIP does **not** include an empty `owner-content-v16.json`, so uploading V17 cannot accidentally overwrite an existing published owner-content file. If the file does not exist yet, V17's GitHub Publish function can create it.
