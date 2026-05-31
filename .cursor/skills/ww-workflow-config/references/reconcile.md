# Queue reconcile procedure

Used by `/ww-reconcile` and optionally at start of `/ww-deliver`.

## 1. Load config

`ww-workflow-config` → resolved `integration_branch`, `plans.version_in_git`.

## 2. PR awaiting → done

For each `plans/work-items/*.md` with `status: pr_awaiting` and `pr_url`:

```bash
gh pr view <url-or-number> --json state,mergedAt,url
```

| `state` | Action |
|---------|--------|
| `MERGED` | `status: done`, set `merged_pr`, loop history, **archive** to `plans/completed-work-items/` |
| `OPEN` | no change; report in summary |
| `CLOSED` (not merged) | set `approved` or `in-progress`, note in loop history |

If `gh` unavailable, list items and ask human to run reconcile after merge.

## 3. Stale approved audit (optional)

Compare `merged_pr` / git log on `integration_branch` to slugs; suggest
marking `done` when implementation clearly shipped (human confirms).
When marking `done`, archive per `ww-work-items/references/archive-on-done.md`.

## 4. Report

```text
Reconcile complete:
  done: [slugs]
  pr_awaiting: [slugs]
  stale approved (suggested): [slugs]
```

Run `plans/scripts/queue-status.sh` before and after.
