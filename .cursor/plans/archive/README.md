# Archive

Point-in-time records: plans that are superseded, landed, or fully closed. Kept for history —
**do not work from these.** Each file carries an `ARCHIVED` header (date, reason, where any live
work went). If a file here still had open items when it was archived, those items were either
re-verified as already resolved (with evidence, in place) or carried forward into a live plan
under `.cursor/plans/` — nothing was dropped silently.

For current work, use the plans in `.cursor/plans/` directly.
