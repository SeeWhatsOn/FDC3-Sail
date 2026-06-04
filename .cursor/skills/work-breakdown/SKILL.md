---
name: work-breakdown
description: >
  Watson planning skill: decompose an approved PRD into epics, stories, and
  tasks. Applies MoSCoW, calls bdd for behavior specs, validates INVEST, and
  delegates each draft to spec-agent. Keywords: ww, work breakdown, epic,
  story, task, MoSCoW, vertical slice, planning.
metadata:
  author: watson
  workflow: ww
  phase: planning
---

# Work Breakdown

Decomposes a PRD's vertical slices into ww work items following the canonical
format from `ww-work-items`. Each item is a thin vertical slice — one
observable behavior path.

## Input

Approved PRD at `plans/prd-[slug].md` with accuracy gate table present.

## Process

### 1. Classify each PRD row

Per [../ww-work-items/references/work-item-kinds.md](../ww-work-items/references/work-item-kinds.md):

| Accuracy gate label | Default kind |
|--------------------|--------------|
| `verified-red` | `task` — fix the failing test |
| `verified-gap` | `task` — implement the missing behavior |
| `verified-partial` | `task` — extend existing behavior |
| `investigate` | `spike` — explore before committing |
| Epic candidate (3+ child items) | `epic` + child tasks |

### 2. Apply MoSCoW

Per [references/moscow-guide.md](references/moscow-guide.md):

- Must-have: sequence first
- Should-have: sequence after Must-have
- Could-have: defer unless Must-have set is small
- Won't-have: confirm with human, do not create work items

### 3. Slice vertically

Each work item must cross all relevant layers from UI through to storage
(or whichever layers it touches). Do not create horizontal slices (e.g.
"add frontend for X" separate from "add backend for X") unless the PRD
explicitly separates the phases.

### 4. Call `bdd` for behavior changes

For each task or spike with observable behavior: load the `bdd` skill and
generate `Given / When / Then` scenarios. Attach the output to the work item
brief before delegating to `spec-agent`.

### 5. INVEST validation

Per [references/invest-criteria.md](references/invest-criteria.md), verify
each work item draft satisfies all six criteria before delegating to
`spec-agent`. Revise the scope or split the item if any criterion fails.

### 6. Delegate to spec-agent

Pass each item as a structured brief to `spec-agent`:

```text
title:           [work item title]
slug:            [descriptive filename slug]
goal:            [one sentence goal]
kind:            [task | spike | epic]
prd_context:     [relevant PRD excerpt + accuracy gate row]
user_or_system:  [who or what depends on this]
file_manifest:   [likely files or areas]
depends_on:      [sibling slugs or empty]
bdd_scenarios:   [Given/When/Then blocks from bdd skill]
project_context: [relevant AGENTS.md sections]
```

Do not write the work item markdown yourself — `spec-agent` owns that.

## Output

List of `plans/work-items/[slug].md` files with `status: draft`, plus the
dependency order. Return both to `spec-planner` for the human gate.

## What you must never do

- Create work items before the PRD accuracy gate passes
- Create horizontal slices (separate frontend/backend items) unless PRD says so
- Skip INVEST validation before delegating to spec-agent
- Call spec-agent without bdd scenarios for behavior-changing items
