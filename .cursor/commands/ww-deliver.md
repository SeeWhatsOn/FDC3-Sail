---
description: Watson workflow delivery — TDD implementation, verification, and review for approved work items
argument-hint: [work-item-slug]
---

# /ww-deliver

Kick off the Watson workflow **delivery phase**.

## Load skills immediately

Read and follow these skills in order:

1. `ww-work-items`
2. `ww-deliver-work-items`

## What to do

1. Run the full delivery workflow from `ww-deliver-work-items`.
2. If the user provided a slug argument, deliver only that work item.
3. Otherwise deliver all `status: approved` work items in dependency order.
4. Stop at each human review gate; do not commit without explicit `approve`.
5. If `--auto-until-review` is present, run RED → GREEN → verification
   → review without pausing between phases, then stop at the human
   review gate.

## Usage

```text
/ww-deliver                              # all approved work items
/ww-deliver add-context-broadcast-handler   # one work item
/ww-deliver --auto-until-review
/ww-deliver add-context-broadcast-handler --auto-until-review
```

Do not write tests, implementation, verification, or review verdicts in
the top-level agent context. Launch the specialist subagents defined in
the skill (`~/.cursor/agents/`). Run the session subagent probe from
`ww-deliver-work-items` → `subagent-launch.md` before Phase A.

