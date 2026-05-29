---
name: ww-workflow-config
description: >
  Load and maintain Watson workflow configuration (plans/workflow-config.yaml),
  first-run preference interview, automation tiers, and status lifecycle. Use
  before /ww-plan, /ww-deliver, /ww-approve, or /ww-reconcile. Keywords: ww,
  workflow-config, automation tier, plans versioning, queue reconcile.
metadata:
  author: watson
  workflow: ww
  phase: library
---

# WW Workflow Config

Durable workflow preferences for the Watson (ww) stack. Stops repeated
interview questions and keeps `plans/work-items/` aligned with git reality.

## When to load

Load this skill at the start of:

- `/ww-plan` (with `ww-prd-breakdown`)
- `/ww-deliver` (with `ww-deliver-work-items`)
- `/ww-approve`
- `/ww-reconcile`

Do **not** load in implementation subagents.

## Configuration resolution

1. **Repo:** `plans/workflow-config.yaml` (required for team; create via interview if missing)
2. **User:** `plans/local/user-overrides.yaml` (optional, gitignored)
3. **Workload:** `workloads.<prd-slug>` — delivery overrides only (`default_automation`, etc.)

Merge: deep-merge `repo` keys; workload `delivery` overrides repo `delivery`.

Record resolved config in orchestrator notes for the session.

## First-run interview (blocking)

If `plans/workflow-config.yaml` does not exist:

1. Tell the human: “No workflow config found — short setup (once per repo).”
2. Ask only questions without answers in any existing partial config.
3. Use [references/interview-prompt.md](references/interview-prompt.md).
4. Write `plans/workflow-config.yaml` from answers (commit in the same PR when the human is setting up the repo).
5. **Resume** the command that triggered setup (`/ww-plan` or `/ww-deliver`).

If the file exists, **skip** the interview. Read values; do not re-ask.

`/ww-plan` may create the file; `/ww-deliver` must not duplicate questions already in it.

## Delivery automation tiers

| Value | Behavior after Phase D passes |
|-------|------------------------------|
| `stage_only` | Set `staged` / `waiting_on_user`; stage files; **no** commit, push, or PR |
| `commit_push` | On human `approve`: commit, push branch; set `committed`; include `plans/` if `repo.plans.version_in_git` |
| `draft_pr` | On human `approve`: commit, push, open/update **draft** PR; set `pr_awaiting` + `pr_url` |

Workload may override `repo.delivery.default_automation` for the active PRD.

Human chat `approve` is still required before `commit_push` / `draft_pr` unless the
human explicitly delegated in the same message.

## Work item status lifecycle

Read [references/status-lifecycle.md](references/status-lifecycle.md). Use these
`status` values in frontmatter. Only `approved` (and resumed `in-progress`) enter
`/ww-deliver`.

## Plans / git policy

- **Always** update work item markdown on disk during delivery (`in-progress`, `staged`, etc.).
- **Git add `plans/`** only when:
  - `repo.plans.version_in_git: true`, and
  - automation tier is `commit_push` or `draft_pr`, and
  - human approved commit (or tier executed commit step).

## Integration branch

Default from `repo.integration_branch`. Prompt only if missing from config and
work item frontmatter is empty.

## PR reconcile

`/ww-reconcile` uses [references/reconcile.md](references/reconcile.md).

## PRD planning hook

During `/ww-plan`, after health check:

- [ ] Workflow config loaded (or created via interview)
- [ ] PRD frontmatter includes `workflow_profile` pointer if this PRD uses a workload override
- [ ] Handoff mentions active `default_automation` tier

See `ww-prd-breakdown` progress checklist.
