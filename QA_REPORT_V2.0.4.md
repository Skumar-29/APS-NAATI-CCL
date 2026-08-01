# APS NAATI CCL Practice V2.0.4 — Pagination QA Report

## Scope

This update fixes the Learn page so students can access every vocabulary card and phrase rather than only the first 120 visible items.

## Content validation

- Vocabulary cards: **3,000**
- Vocabulary pages at 120 per page: **25**
- Phrases: **1,200**
- Phrase pages at 120 per page: **10**
- Dialogues retained: **85**
- Dialogue segments retained: **1,073**

## Pagination tests passed

- Page 1 vocabulary range: 1–120 of 3,000
- Page 2 vocabulary range: 121–240 of 3,000
- Final vocabulary page: page 25
- Page 1 phrase range: 1–120 of 1,200
- Final phrase range: 1,081–1,200 on page 10
- Previous button disabled on the first page
- Next button disabled on the final page
- Direct page selector available
- Search resets the view to page 1
- Topic, status, completion and Vocabulary/Phrases changes reset to page 1
- Playlist built from current filters includes all matching entries, not only the visible 120
- Responsive pagination layout added for mobile screens

## Technical validation

- JavaScript syntax: passed (`node --check app.js`)
- JSON parsing: passed
- Service-worker cache updated to V2.0.4
- Version metadata updated to V2.0.4
- ZIP integrity: verified after packaging

## Upgrade note

Upload V2.0.4 directly to the existing GitHub repository. It includes all V2.0.3 Final answer-comparison features plus this pagination correction.
