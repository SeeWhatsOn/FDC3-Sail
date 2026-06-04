# PR Reconcile

Run `/ww-reconcile` after merging PRs to sync work item statuses with git reality.

## When to run

- After merging one or more PRs that were opened by `/ww-deliver`
- When `plans/work-items/` contains items with `status: pr_awaiting` or `committed`
- Periodically to catch items shipped outside the ww workflow

## Process

1. Read all `plans/work-items/*.md` with `status: pr_awaiting` or `committed`.
2. For each item, check the associated `pr_url` or `branch`:
   - Run `gh pr view <pr_url> --json state,mergedAt` (requires `gh` CLI).
   - If PR state is `MERGED`: set `status: done`, record `merged_pr`, archive per `archive-on-done.md`.
   - If PR state is `CLOSED` (not merged): set `status: draft` and surface to human.
   - If PR still `OPEN`: leave as-is.
3. For `committed` items with no PR: ask human whether the commit was merged.
4. Report: items archived, items still open, items needing human input.

## Manual reconcile (no `gh` CLI)

If `gh` is unavailable:
1. List all `pr_awaiting` and `committed` items.
2. Ask human to confirm which are merged.
3. Set `status: done` and archive per human confirmation.

## After reconcile

- All merged items are in `plans/completed-work-items/`.
- Remaining `plans/work-items/` contains only active or unstarted items.
- Report a summary to the human.
