---
name: ww-planning-stack
description: >
  Watson planning stack: when to use release briefs, domain PRDs, ADRs,
  epics, spikes, and local work items — and how they connect to
  spec-driven-development and optional GitHub issues. Use before /ww-plan,
  when choosing document types, or when improving planning workflow.
  Keywords: ww, planning stack, PRD, epic, work item, release brief,
  specification driven, task packet.
metadata:
  author: watson
  workflow: ww
  phase: planning
---

# WW Planning Stack

Meta-skill for **which artifact to write** and **how planning flows into
delivery**. Implementation lives in `ww-prd-breakdown`, `ww-work-items`, and
`ww-deliver-work-items`.

## When to use

- Starting a new workload and unsure whether you need a PRD, spec, epic, or
  issue
- Onboarding agents to the Watson workflow
- After a planning pass that felt too flat (eleven equal tickets, duplicate
  plans, draft items merged without approval)

## Stack overview

```text
Release brief (optional, 1 page)
    └── Domain PRD (per theme: feature, hardening, transport)
            ├── ADR (optional, per architectural decision)
            ├── Epic work item (optional, groups 3+ child tasks)
            │       └── Child work items (task | spike)
            └── Work items (task | spike) — default delivery unit
                    └── RED tests → /ww-deliver → GREEN
Optional: GitHub Epic/Issue (external_tracker on work items only)
```

**Do not create four full documents for every slice.** Use the minimum
depth that leaves nothing critical to guess at delivery time.

## Layer guide

| Layer | File pattern | Purpose | Agent implements? |
|-------|----------------|---------|-------------------|
| Release brief | `plans/release-*.md` or section in `project-docs.md` | P0/P1 bar, themes, links to domain PRDs | No |
| Domain PRD | `plans/prd-*.md` | Persona, scope, dedup, success criteria, product G/W/T | No — decompose only |
| ADR | `docs/decisions/ADR-*.md` | Why for contracts, security, caps | No |
| Epic | `plans/work-items/*-epic.md` with `kind: epic` | Groups children, tracks matrix gaps | No — children deliver |
| Spike | `kind: spike` | Investigate; output doc or child tasks | Sometimes (doc-only) |
| Task | `kind: task` (default) | One PR-sized packet with G/W/T | Yes via `/ww-deliver` |
| GitHub issue | Tracker | Human sprint board | Mirror only |

## Choosing depth

| Situation | Minimum stack |
|-----------|----------------|
| Single bug, obvious fix | Task work item only (or skip plans, use TDD) |
| Release hardening on existing code | Release brief + domain PRD + tasks |
| New public API or host contract | Domain PRD + ADR + tasks |
| Conformance / matrix / many scenarios | Domain PRD + **epic** + traceability spike/task first |
| Greenfield product surface | `spec-driven-development` spec → domain PRD → tasks |

## Watson command map

| Human intent | Command / skill |
|--------------|-----------------|
| Clarify goals | `interview-me` |
| Write or refine PRD | `spec-driven-development` + `ww-prd-breakdown` (`/ww-plan`) |
| Verify PRD against repo | `ww-prd-breakdown` → `prd-accuracy-gate.md` |
| Split into work items | `/ww-plan` (`ww-prd-breakdown`) |
| Approve packets | Human `approve` per item (human-gate-template) |
| Implement approved slice | `/ww-deliver` (`ww-deliver-work-items`) |

## Integration with other skills

| Skill | Role in stack |
|-------|----------------|
| `spec-driven-development` | Upstream: objective, commands, boundaries before or inside PRD |
| `planning-and-task-breakdown` | Vertical slices, dependency order while drafting items |
| `documentation-and-adrs` | ADRs when PRD items imply irreversible decisions |
| `test-driven-development` | RED phase inside `/ww-deliver` or before deliver when hardening |
| `work-item-management` | Legacy mirror of `ww-work-items`; prefer `ww-work-items` for WW |

## Anti-patterns

- Implementing the whole PRD in one agent session
- Eleven work items with equal weight when some are epics (traceability,
  conformance matrix)
- `status: approved` or committing plans without human gate
- Skipping PRD accuracy gate on brownfield repos (duplicate remediation plans)
- Sending `/ww-deliver` an epic parent slug
- Inventing GitHub issue IDs in work item frontmatter

## References

- Accuracy gate: `ww-prd-breakdown/references/prd-accuracy-gate.md`
- PRD checklist: `ww-prd-breakdown/references/prd-template.md`
- Work item kinds: `ww-work-items/references/work-item-kinds.md`
- Canonical item format: `ww-work-items/references/work-item-template.md`
