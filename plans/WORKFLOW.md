# Watson workflow (ww) — configuration and queue

## Configuration files

| File | Scope | In git? |
|------|--------|---------|
| `plans/workflow-config.yaml` | Team repo defaults | Yes |
| `plans/local/user-overrides.yaml` | Personal overrides | No (gitignored) |
| `workloads.<prd-slug>` in either file | Per-PRD delivery mode | As above |

**Load order:** `workflow-config.yaml` → `local/user-overrides.yaml` → active
workload block (if the command names a PRD or work item maps to a workload).

## First-run interview

If `plans/workflow-config.yaml` is missing, `/ww-plan` and `/ww-deliver` **stop**
and run the short interview in `ww-workflow-config` (then resume the command).

If the file exists, **do not re-ask** answered fields.

## Delivery automation tiers

| Tier | Code | Plans on disk | Git |
|------|------|---------------|-----|
| **Stage only** | `stage_only` | Always update `status` | Stage implementation files only; no commit/push |
| **Commit + push** | `commit_push` | Always update | Commit + push branch (include `plans/` if `version_in_git`) |
| **Draft PR** | `draft_pr` | Always update | Commit + push + open/update **draft** PR |

Plans and code follow the **same tier** — no separate “plans policy” per tier.

## Work item status lifecycle

```text
draft → approved → in-progress → staged → waiting_on_user
  → committed → pr_awaiting → done
```

| Status | Meaning |
|--------|---------|
| `approved` | Eligible for `/ww-deliver` |
| `in-progress` | Delivery running |
| `staged` | Tests/review green; files staged locally |
| `waiting_on_user` | Human review gate (chat `approve` / `changes` / `skip`) |
| `committed` | Pushed to feature branch (`commit_push` / `draft_pr`) |
| `pr_awaiting` | Draft PR open; frontmatter `pr_url` set |
| `done` | Merged or explicitly closed |

`/ww-reconcile` moves `pr_awaiting` → `done` when `gh pr view` reports **MERGED**.

## Commands

| Command | Purpose |
|---------|---------|
| `/ww-plan` | PRD → work items |
| `/ww-approve` | Approve drafts |
| `/ww-deliver` | TDD delivery |
| `/ww-reconcile` | PR merge → `done`, queue audit |

## Scripts

```bash
plans/scripts/queue-status.sh      # Count by status
plans/scripts/reconcile-queue.sh   # pr_awaiting → done via gh
```
