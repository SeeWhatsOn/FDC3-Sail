---
name: ww-prd-breakdown
description: >
  Watson workflow planning phase: turn a PRD or product goal into small,
  descriptive local markdown work items with BDD behavior specs. Use when
  breaking down a PRD, planning features, writing work items, or authoring
  Given/When/Then behaviour specs. Load ww-planning-stack first when unsure
  which planning artifacts to create. Keywords: ww, watson workflow, ww-plan,
  PRD breakdown, work items, BDD, planning phase.
disable-model-invocation: true
metadata:
  author: watson
  workflow: ww
  phase: planning
---

# WW PRD Breakdown

Planning workflow for the Watson workflow. Invoked by `/ww-plan`.

Run this workflow in the top-level agent. Do not launch an orchestrator
subagent. The top-level agent owns orchestration, human gates, and file
writes; specialist subagents provide focused drafts only when useful.

## Purpose

Break a PRD into small work items that a normal developer can
understand and deliver without senior-level inference from the PRD.

The planning phase writes local markdown work items. It does not write
executable tests and does not write implementation code.

## Orchestrator Skills

Load in the top-level agent:

- `ww-planning-stack` (when choosing PRD vs epic vs task depth)
- `ww-work-items`
- `context-engineering`
- `planning-and-task-breakdown`

Load when needed: `interview-me`, `idea-refine`, `documentation-and-adrs`,
`api-and-interface-design`.

When using `spec-agent`, discipline skills load in the subagent brief —
see [references/spec-agent-brief.md](references/spec-agent-brief.md).

Follow `ww-work-items` → Context Budget.

## PRD Breakdown Progress

Track progress through the workflow:

- [ ] Health check passed (`ww-work-items`)
- [ ] Human chose `plans/` persistence policy: local-only default or
  versioned planning artifacts for this repo/workload
- [ ] `plans/project-docs.md` built or updated ([references/project-docs-template.md](references/project-docs-template.md))
- [ ] PRD validated against [references/prd-template.md](references/prd-template.md)
- [ ] PRD accuracy gate passed ([references/prd-accuracy-gate.md](references/prd-accuracy-gate.md))
- [ ] Each PRD row classified (`task` | `spike` | `epic`) per `ww-work-items` → work-item-kinds
- [ ] Focused context loaded (`AGENTS.md`, PRD, existing work items)
- [ ] Intent clarified with human (if needed)
- [ ] Work items identified as small vertical slices
- [ ] Each draft validated (`ww-work-items` → Draft Validation)
- [ ] Each draft presented using [references/human-gate-template.md](references/human-gate-template.md)
- [ ] Human replied `approve` for each item
- [ ] Approved items written with `status: approved`
- [ ] Handoff report lists slugs and points to `/ww-deliver`

Use `spec-agent` as a specialist subagent for each work-item draft
when isolated drafting context is useful. Send the prompt from
[references/spec-agent-brief.md](references/spec-agent-brief.md).
The top-level agent still owns review, validation, file writes, and
approval gates.

## PRD Validation

Before splitting, read
[references/prd-template.md](references/prd-template.md). If persona,
goal, scope, success criteria, or behavior scenarios are missing, ask
focused questions. Non-blocking unknowns may become work-item
`## Blocked decisions`.

## PRD Accuracy Gate

After PRD content is drafted and before work items, run
[references/prd-accuracy-gate.md](references/prd-accuracy-gate.md).
Brownfield workloads must not skip this step.

Record the gate table in the PRD or `plans/project-docs.md`. Rows marked
`investigate` become `kind: spike` work items. Rows that need multiple
delivery PRs become `kind: epic` parents plus child tasks.

## Work Item Requirements

Each work item must include:

- `kind: task | spike | epic` (see `ww-work-items` → work-item-kinds)
- a clear goal
- user or system context
- reference docs
- BDD-style Given/When/Then behavior specs (epics use child table instead)
- out-of-scope boundaries
- TypeScript interfaces, or "none" (epics: "none")
- test guidance for the delivery RED phase
- file manifest
- dependencies
- loop limit
- tags (optional — see `ww-work-items` → Work Item Tags)

For `kind: epic`, also include `## Child work items` and create separate
files for each child before handoff.

BDD behavior specs describe observable behaviour:

```text
Given [context]
When [action]
Then [observable outcome]
```

Do not prescribe executable test code in this phase. Delivery decides
the right test level during RED.

Use the canonical format from `ww-work-items` → Canonical Work Item
Format (loads `references/work-item-template.md` when needed).

## Output

Approved local work items in `plans/work-items/`, with descriptive
filenames such as:

```text
plans/work-items/add-context-broadcast-handler.md
plans/work-items/resolve-order-race-condition.md
```

Do not assign tracker IDs unless the item is backed by a real external
tracker. If a future GitHub/Jira integration exists, store the external
reference in `external_tracker`.

Follow `ww-work-items` → Local Persistence And Commit Policy for
`plans/` handling.

At startup, ask whether planning artifacts are local-only (default) or
versioned for this repo/workload. Do not edit `.gitignore`
automatically.

## Human Gate

Read and follow
[references/human-gate-template.md](references/human-gate-template.md).

## Handoff Report

End with a report that includes:

- approved work item slugs and titles
- dependency order for delivery
- pointer to `/ww-deliver` or `/ww-deliver <slug>`

## What You Must Never Do

- Write production code
- Write executable tests
- Create fake tracker identifiers
- Set delivery statuses other than `draft` or `approved`
- Commit or merge `plans/` as approved without human `approve` per item
- Split PRD into work items before accuracy gate on brownfield workloads
- Use one work item file for an entire epic/matrix (use epic + children)
- Modify `AGENTS.md` directly
- Proceed past a failed health check
- Present a draft before draft validation passes

