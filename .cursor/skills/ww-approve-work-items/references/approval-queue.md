# Approval Queue

## Argument parsing

| User input | Queue |
|------------|--------|
| (none) | All `plans/work-items/*.md` with `status: draft`, `kind` ≠ `epic` |
| `<slug>` | Single file `plans/work-items/<slug>.md` if draft |
| `plans/prd-….md` or PRD name substring | Draft items whose `## Reference docs` or title track matches that PRD |
| `--catalog-only` | Build catalog only; do not present gates |

Also include in catalog (but do not queue for approval unless human asks):

- `status: approved` — already ready for `/ww-deliver`
- `status: done` — informational
- `kind: epic` — show in catalog; deliver children only

## Dependency order

1. Collect all `depends_on` slugs from queued drafts.
2. Verify each slug exists under `plans/work-items/`.
3. Topological sort: dependencies first.
4. If cycle detected, stop and report the cycle.

## PRD filter heuristic

Match draft items to a PRD when `## Reference docs` contains the PRD path, or:

| PRD file | Slug patterns / notes |
|----------|------------------------|
| `prd-desktop-agent-conformance-gaps.md` | conformance, cleanup, cap-intents, wcp1, wcp-identity, app-channel, fdc3-error, bdd-wcp, align-wcp, reduce-vitest, extend-cleanup |
| `prd-desktop-agent-release-p2.md` | dacp-wcp-log, align-readme, centralize-implementation, fix-in-memory-transport-test-timing |
| `prd-transport-platform-hardening.md` | messageport, in-memory-transport, impersonation, document-in-memory |

## Validation

Before presenting each item, run every checkbox in
`ww-work-items/references/validation-before-approve.md` for its `kind`.

If validation fails, do not offer `approve` until fixed or human accepts
`revise` to correct the draft.

## Status writes

Only change these fields on approve/done:

```yaml
status: approved   # or done
```

Do not set `in-progress`, `staged`, or `done` (delivery) except:

- `done` when human confirms already shipped
- delivery orchestrator owns post-approve lifecycle
