---
name: ww-prd-breakdown
description: >
  Watson workflow planning phase: create or refine a PRD, then split it into
  optional epics and small local markdown work items with BDD behavior specs.
  Use when writing a PRD, breaking down a PRD, planning features, writing
  work items, or authoring Given/When/Then behaviour specs. Keywords: ww,
  watson workflow, ww-plan, PRD breakdown, epic, work items, BDD.
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

Create or refine a PRD until it is clear enough to split, then break it into
optional epics and small work items that a normal developer or agent
subagent can deliver without senior-level inference.

The planning phase writes local markdown work items. It does not write
executable tests and does not write implementation code.

## Orchestrator Skills

Load in the top-level agent:

- `ww-workflow-config` (first — create/load `plans/workflow-config.yaml`)
- `ww-planning-stack` (when choosing PRD vs epic vs work item shape)
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
- [ ] PRD created or refined against [references/prd-template.md](references/prd-template.md)
- [ ] `interview-me` used when user, outcome, success, architecture direction,
  edge cases, or constraints were unclear
- [ ] PRD accuracy gate passed ([references/prd-accuracy-gate.md](references/prd-accuracy-gate.md))
- [ ] Each PRD row classified (`task` | `spike` | `epic`) per `ww-work-items` → work-item-kinds
- [ ] Epics used only where they add coordination value
- [ ] Focused context loaded (`AGENTS.md`, PRD, existing work items)
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

## PRD Creation And Validation

Before splitting, read [references/prd-template.md](references/prd-template.md).
If the PRD is missing user/persona, goal, scope, success criteria,
architecture direction, behavior scenarios, constraints, or edge cases, use
`interview-me` or ask focused questions.

The PRD should be the main source of truth for product and architecture
context. Prefer a concise PRD section over creating extra planning
documents. Use ADRs only for durable architecture decisions that need to
outlive the PRD.

Non-blocking unknowns may become `kind: spike` work items or work-item
`## Blocked decisions`.

## PRD Accuracy Gate

After PRD content is drafted and before work items, run
[references/prd-accuracy-gate.md](references/prd-accuracy-gate.md).
Brownfield workloads must not skip this step.

Record the gate table in the PRD. Rows marked `investigate` become
`kind: spike` work items. Rows that need several coordinated delivery
packets may become `kind: epic` parents plus child tasks.

## Work Item Requirements

Each work item must include:

- `kind: task | spike | epic` (see `ww-work-items` → work-item-kinds)
- a clear goal
- user or system context
- reference docs, including PRD path and epic path when applicable
- a short parent context summary from the PRD or epic
- BDD-style Given/When/Then behavior specs when behavior changes (epics use
  child table instead)
- out-of-scope boundaries
- TypeScript interfaces, or "none" (epics: "none")
- test guidance for the delivery RED phase
- file manifest
- dependencies
- loop limit
- tags (optional — see `ww-work-items` → Work Item Tags)

For `kind: epic`, include `## Child work items` and create separate files
for each child before handoff. Do not create an epic for a single small task
or 1-2 obvious tasks.

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
- pointer to `/ww-approve` (batch or per slug), then `/ww-deliver` or `/ww-deliver <slug>`

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

