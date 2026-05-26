# PRD Accuracy Gate

Run **after** the PRD draft exists and **before** splitting into work items.
Required for brownfield workloads (existing code, remediation plans, prior
PRDs). Optional but recommended for greenfield.

Do not present work items to the human until this gate passes or open items
are explicitly recorded as `## Blocked decisions` on the PRD.

## Checklist

### 1. Plan deduplication

- [ ] List existing plans: `plans/prd-*.md`, `plans/work-items/`, repo-root
  remediation/roadmap docs, `.cursor/plans/`
- [ ] PRD includes a **Relationship to other plans** table: existing plan →
  status on current branch → this PRD action (extend | no duplicate | defer)
- [ ] No PRD row re-plans work already marked done unless regression is
  documented

### 2. Codebase verification

For each **in scope** PRD row, record evidence:

| Label | Meaning |
|-------|---------|
| `verified-red` | Failing test or reproducible bug on integration branch |
| `verified-gap` | Code read confirms missing behavior (cite path) |
| `verified-partial` | Some behavior exists; PRD says **extend** not greenfield |
| `investigate` | Severity or scope unknown; becomes `kind: spike` |
| `deferred` | Out of scope or post-release |

- [ ] No row uses `verified-gap` without a path or test reference
- [ ] Rows marked greenfield are not `verified-partial` on the branch

### 3. Requirement IDs (recommended)

- [ ] Each in-scope row has a stable ID: `PRD-01`, `CONF-01`, etc.
- [ ] Suggested vertical slices table maps ID → future work item slug

### 4. Classification

- [ ] Each row labeled `task`, `spike`, or `epic` (see `work-item-kinds.md`)
- [ ] Epic rows have named child slugs planned (not one vague mega-item)

### 5. Deliverability

- [ ] PRD has persona, goal, in/out of scope, success criteria, product-level
  G/W/T (see `prd-template.md`)
- [ ] Commands block present or deferred with reason (test/build from
  `AGENTS.md` / `package.json`)
- [ ] Open questions either resolved or assigned to spike items

## Output

Append to the PRD or `plans/project-docs.md`:

```markdown
## PRD accuracy gate (date / branch)

| ID | Classification | Evidence | Work item slug (planned) |
|----|----------------|----------|--------------------------|
| PRD-01 | task | verified-red: path/to/test | slug-name |
```

If the gate fails, fix the PRD or ask the human — do not split into work
items yet.
