# Work item status lifecycle (extended)

## Flow

```text
draft
  -> approved          (/ww-plan or /ww-approve)
       -> in-progress  (/ww-deliver start)
            -> blocked
            -> staged     (tests + review pass)
                 -> waiting_on_user   (human review gate)
                      -> committed      (commit_push: pushed)
                      -> pr_awaiting     (draft_pr: PR open)
                           -> done       (merged or explicit close)
                 -> in-progress  (human changes [note])
            -> escalated -> dead-letter
```

## Frontmatter fields

| Field | When set |
|-------|----------|
| `pr_url` | `pr_awaiting` |
| `merged_pr` | `done` (merge URL or `#N`) |
| `branch` | Delivery start |
| `integration_branch` | From workflow config |

## `/ww-deliver` eligibility

- **Start:** `status: approved` (and `kind` not `epic`)
- **Resume:** `in-progress`, `staged`, `waiting_on_user` for same slug
- **Not queued:** `done`, `pr_awaiting`, `committed`, `draft`, `escalated`

## Automation tier → terminal status (before merge)

| Tier | After human `approve` at gate |
|------|-------------------------------|
| `stage_only` | Stay `waiting_on_user` or `staged` until human commits; manual `done` or `/ww-reconcile` after merge |
| `commit_push` | `committed` |
| `draft_pr` | `pr_awaiting` + `pr_url` |

## `done`

Set `done` when:

- `/ww-reconcile` detects PR **MERGED**, or
- Human says `approve` after merge, or
- `stage_only` and human confirms shipped outside ww

Append `## Loop history` line with date and PR link. Then archive the file
to `plans/completed-work-items/` per `ww-work-items/references/archive-on-done.md`.
