---
name: ww-planning-stack
description: >
  Watson planning shape: choose the lightest useful path from PRD to
  optional epic to deliverable work items. Use before /ww-plan when deciding
  whether a product goal needs a PRD, an epic, a spike, or direct work items.
  Keywords: ww, planning shape, PRD, epic, work item, spike, task packet.
metadata:
  author: watson
  workflow: ww
  phase: planning
---

# WW Planning Shape

Use this as a routing guide. The default flow is:

```text
PRD -> optional Epic -> Work Item -> /ww-deliver
```

Keep the structure as small as possible while leaving enough context for a
normal developer or agent subagent to deliver safely.

## When to use

- Starting a workload and deciding what planning artifacts are needed.
- A PRD is too vague to split safely.
- A planning pass produced one giant task or too many tiny equal tasks.
- Agents need clear parent context without loading every document.

## Artifact roles

| Artifact | Purpose | Default? |
|----------|---------|----------|
| PRD | Product goal, success criteria, edge cases, constraints, architecture direction, and slicing table | yes |
| Epic | Coordination container for several related child work items | only when useful |
| Work item | Deliverable packet for a developer or agent subagent | yes |
| Spike | Work item for unknowns that need investigation before implementation | when unknowns block safe delivery |
| ADR | Durable architecture decision record | only for decisions that must outlive the PRD |

The PRD is the source of truth. Prefer adding concise architecture and
implementation direction to the PRD over creating extra documents.

## When to create an epic

- Create an epic when there are 3+ related child work items, multiple
  subagents or roles need the same parent context, delivery is phased, or the
  work shares one architecture/behavior boundary.
- Skip the epic for a single bug, one small feature, or 1-2 obvious tasks.
- Never deliver an epic directly. Deliver approved child work items.

## Choosing the lightest shape

| Situation | Use |
|-----------|-----|
| Small bug or obvious change | One work item, or skip planning and use normal TDD |
| Product behavior change | PRD -> work items |
| Several related deliverables | PRD -> epic -> child work items |
| Unknown scope or risk | PRD -> spike, then child work items if needed |
| Durable API/security/platform decision | PRD + optional ADR -> work items |

## PRD expectations

The PRD should be understandable by product people, architects, senior
developers, and agents. Include:

- user/persona, goal, scope, success criteria, and edge cases
- architecture/implementation direction from the human when provided
- constraints, risks, unknowns, and open questions
- behavior scenarios when behavior changes
- a slicing table mapping requirements to `task`, `spike`, or `epic`

Use `interview-me` before or during PRD drafting when the goal, user,
success criteria, architecture direction, or edge cases are unclear.

## Example: TODO app

- PRD: "Add collaborative TODO lists with sharing, roles, audit history, and
  offline sync."
- Epic: "List sharing and permissions" because it groups several related
  child tasks.
- Work item: "Enforce viewer/editor permissions on TODO mutations."
- Work item: "Add invite-by-email flow for list sharing."

No epic is needed for "Add due-date sorting" if it can be delivered as one
or two obvious work items.

## Anti-patterns

- Creating documents because the stack allows them, not because delivery
  needs them.
- Hiding architecture direction in a separate document when a short PRD
  section would do.
- Creating an epic for every work item.
- Implementing the whole PRD in one delivery session.
- Sending `/ww-deliver` an epic parent slug.
- Skipping PRD accuracy checks on brownfield work.
- Inventing GitHub issue IDs in work item frontmatter

## References

- Accuracy gate: `ww-prd-breakdown/references/prd-accuracy-gate.md`
- PRD checklist: `ww-prd-breakdown/references/prd-template.md`
- Work item kinds: `ww-work-items/references/work-item-kinds.md`
- Canonical item format: `ww-work-items/references/work-item-template.md`
