---
description: Watson workflow — reconcile work item queue with merged PRs and git
argument-hint: [--dry-run]
---

# /ww-reconcile

Sync `plans/work-items/` with reality after merges or between delivery batches.

## Load skills

1. `ww-workflow-config`
2. `ww-work-items`

## What to do

1. Run `plans/scripts/queue-status.sh` (before).
2. Follow `ww-workflow-config` → `references/reconcile.md`.
3. For each `pr_awaiting` item, check PR state via `gh pr view`.
4. Set `done` + `merged_pr` when merged; report open/closed PRs.
5. Optionally flag `approved` slugs that appear shipped on `integration_branch`
   (human confirms before marking `done`).
6. Run `plans/scripts/queue-status.sh` (after).
7. Commit `plans/` updates if `repo.plans.version_in_git` (ask once if unset).

## Usage

```text
/ww-reconcile
/ww-reconcile --dry-run
```
