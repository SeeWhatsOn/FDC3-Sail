# Delete work item on done (FDC3-Sail policy)

When a work item reaches `status: done`, **delete** the markdown file and record delivery in the parent PRD.

## Procedure

1. Ensure the parent PRD **Work item retention** section (or accuracy gate row) lists the slug as `done — work item deleted`.
2. Append merge/delivery notes to the PRD row if needed (`merged_pr`, date).
3. Delete the file:

   ```text
   plans/work-items/<slug>.md  →  removed (git rm)
   ```

4. Do **not** create or use `plans/completed-work-items/` in this repo.

## When to apply

Apply on every path that sets `done`:

- `/ww-reconcile` when a `pr_awaiting` PR is **MERGED**
- Human `done <slug>` in `/ww-approve` (already shipped)
- Human confirms shipped after `stage_only` delivery
- Stale approved audit when human confirms implementation merged

Do **not** delete for `escalated` — those move to `plans/dead-letter/`.

## Queue and lookup rules

| Location | Purpose |
|----------|---------|
| `plans/work-items/` | Active queue (`draft` through `pr_awaiting`) |
| Active PRD **Work item retention** + `plans/project-docs.md` | Delivered work (files deleted) |
| `plans/dead-letter/` | Escalated / abandoned items |

- `/ww-deliver`, `/ww-approve`, and queue scripts scan **only** `plans/work-items/`.
- `depends_on` on completed predecessors should be **empty** (satisfied); do not require deleted slug files to exist.
- Historical slug lookup: parent PRD accuracy gate / retention table.
