# Project Docs Template

Build or update `plans/project-docs.md` during `/ww-plan` before
drafting work items.

```markdown
# Project docs

## PRD source
- [path or description of PRD / goal]

## Planning index

| Artifact | Path | Status | Notes |
|----------|------|--------|-------|
| Release brief | plans/release-….md | draft / n/a | |
| Domain PRD | plans/prd-….md | draft / approved | accuracy gate: pass/fail |
| ADR | docs/decisions/… | n/a | |

## Work items (this workload)

| Slug | kind | status | depends_on |
|------|------|--------|------------|
| example-task | task | draft | |

## Architecture
- [key modules, boundaries, patterns a normal developer must know]

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

