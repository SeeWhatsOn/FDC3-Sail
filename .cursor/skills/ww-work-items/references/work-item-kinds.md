# Work Item Kinds

Frontmatter field:

```yaml
kind: task   # task | spike | epic  (default: task)
```

`type` remains `feature | bug | chore` (nature of change). `kind` is
**planning shape** and deliverability.

## task (default)

- Completable in one focused session / one PR
- Given/When/Then behavior spec required when user-visible behavior or
  system behavior changes
- Eligible for `/ww-deliver` when `status: approved`
- Example: fix cleanup handler, cap history map

## spike

- Time-boxed investigation or doc deliverable
- Behavior spec may be phased: **Phase 1 investigate**, **Phase 2 fix**
- `/ww-deliver` only when Phase 2 has concrete testable outcomes; otherwise
  close via human review with findings in `## Staged for review` or PRD
  update
- Often produces child `task` items or an ADR
- Example: WCP identity map leak severity, test hygiene vs product bug

## epic

- **Container only** — not implemented directly
- Use only when coordination value is real: 3+ related child work items,
  phased delivery, multiple agents or roles, shared architecture context, or
  cross-cutting behavior
- Skip for a single bug, one small feature, or 1-2 obvious tasks
- Must include `## Child work items` with slugs (draft or approved)
- `file_manifest` may list docs index paths only
- **Excluded** from `/ww-deliver` queue
- Children must be separate files with `depends_on` pointing to epic slug
  or each other
- Approve epic for planning tracking; approve each child before delivery
- Example: conformance-evidence epic → traceability map task → BDD gap tasks

## Validation by kind

| Check | task | spike | epic |
|-------|------|-------|------|
| Goal one sentence | yes | yes (or phased) | yes |
| G/W/T per behavior change | yes | phase 2 yes | no (use child table) |
| Parent context | concise PRD/epic excerpt | concise PRD/epic excerpt | concise PRD excerpt |
| `## Child work items` | no | if spawning children | **required** |
| `/ww-deliver` | yes | if fix phase approved | **never** |
| TypeScript interfaces | required or "none" | required or "none" | "none" |

## PRD row → work item mapping

| PRD classification | Create |
|--------------------|--------|
| task | one `kind: task` file |
| spike | one `kind: spike` file |
| epic | one `kind: epic` + one file per child task/spike |

Do not fold an epic and all children into a single work item file.
Do not create an epic just to preserve the hierarchy.

## Epic file pattern

```markdown
---
kind: epic
...

## Child work items

| Slug | Kind | Depends on | Status |
|------|------|------------|--------|
| conformance-traceability-map | task | | draft |
| app-channel-context-history-bdd | task | conformance-traceability-map | draft |
```

Update the table when children are approved or done.
