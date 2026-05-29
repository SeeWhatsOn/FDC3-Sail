---
description: Watson workflow delivery — TDD implementation, verification, and review for approved work items
argument-hint: [work-item-slug] [--batch N]
---

# /ww-deliver

Kick off the Watson workflow **delivery phase**.

## Load skills immediately

Read and follow these skills in order:

1. `ww-workflow-config`
2. `ww-work-items`
3. `ww-deliver-work-items`

## What to do

1. Load workflow config (short interview if `plans/workflow-config.yaml` missing).
2. Suggest `/ww-reconcile` when `pr_awaiting` items exist.
3. Run the full delivery workflow from `ww-deliver-work-items`.
4. If the user provided a slug argument, deliver only that work item.
5. Otherwise deliver all `status: approved` work items in dependency order.
6. Respect **automation tier** from config (`stage_only` | `commit_push` | `draft_pr`).
7. If `--auto-until-review` is present, run phases through review, then stop at
   `waiting_on_user` (no commit/PR unless tier and human `approve` say so).

## Usage

```text
/ww-deliver
/ww-deliver add-context-broadcast-handler
/ww-deliver --auto-until-review
/ww-deliver add-context-broadcast-handler --auto-until-review
```

Do not write tests, implementation, verification, or review verdicts in the
top-level agent context. Launch specialist subagents per `subagent-launch.md`.
