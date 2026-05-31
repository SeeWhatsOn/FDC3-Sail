# Archive work item on done

When a work item reaches `status: done`, move it out of the active queue.

## Procedure

1. Ensure frontmatter has `status: done` and `merged_pr` when a PR was merged.
2. Append a `## Loop history` line with date and reason if not already present.
3. Move the file:

   ```text
   plans/work-items/<slug>.md
     -> plans/completed-work-items/<slug>.md
   ```

4. Create `plans/completed-work-items/` if missing.
5. Use `git mv` when the file is tracked; otherwise `mv`.

## When to archive

Apply on every path that sets `done`:

- `/ww-reconcile` when a `pr_awaiting` PR is **MERGED**
- Human `done <slug>` in `/ww-approve` (already shipped)
- Human confirms shipped after `stage_only` delivery
- Stale approved audit when human confirms implementation merged

Do **not** archive for `escalated` — those move to `plans/dead-letter/`.

## Queue and lookup rules

| Location | Purpose |
|----------|---------|
| `plans/work-items/` | Active queue (`draft` through `pr_awaiting`) |
| `plans/completed-work-items/` | Finished items (`status: done`) |
| `plans/dead-letter/` | Escalated / abandoned items |

- `/ww-deliver`, `/ww-approve`, and queue scripts scan **only**
  `plans/work-items/` for eligible items.
- `depends_on` validation checks both `plans/work-items/` and
  `plans/completed-work-items/` for slug existence.
