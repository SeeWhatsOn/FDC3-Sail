# Optional Context Index Template

Use `plans/project-docs.md` only when the PRD would otherwise become a
dumping ground for links. Keep the PRD as the source of truth; this file is
only an index for large workloads.

```markdown
# Project docs

## PRD source
- [path to PRD]

## Planning index

| Artifact | Path | Status | Notes |
|----------|------|--------|-------|
| PRD | plans/prd-….md | draft / approved | accuracy gate: pass/fail |
| Epic | plans/work-items/…-epic.md | draft / approved | optional |
| ADR | docs/decisions/… | n/a | only for durable decisions |

## Work items (this workload)

| Slug | kind | status | depends_on |
|------|------|--------|------------|
| example-task | task | draft | |

## Architecture
- [links to key modules, boundaries, and patterns; do not duplicate PRD text]

## Conventions
- [testing, naming, error handling — cite AGENTS.md sections where possible]

## Reference paths
- [paths to specs, ADRs, API docs used by this workload]

## Out of scope for this workload
- [PRD areas explicitly deferred]

## Persistence policy
- [ ] local-only (default) — do not commit `plans/` without human ask
- [ ] versioned — commit only human-approved PRDs and `status: approved` items
```

Keep entries concise. Link paths; do not paste large documents.

