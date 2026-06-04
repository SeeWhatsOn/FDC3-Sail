---
name: prd
description: >
  Watson planning skill: write a structured ww PRD from confirmed intent.
  Runs the accuracy gate for brownfield workloads using verify-this.
  Applies MoSCoW to the vertical slices table. Keywords: ww, PRD, product
  requirements, accuracy gate, MoSCoW, spec, planning.
metadata:
  author: watson
  workflow: ww
  phase: planning
---

# PRD

Writes a ww-structured PRD document from confirmed intent or direct human
specification. The PRD is the main source of truth for the planning phase —
all downstream work items derive from it.

## Input

Either:
- INTENT CONFIRMED block from the `interview` skill, or
- Direct human description with enough detail to fill all required PRD fields

## PRD format

Follow [references/prd-template.md](../ww-work-items/references/prd-template.md).

Required sections (use stable IDs `PRD-01`, `PRD-02`…):

- Persona / user
- Goal / outcome
- Relationship to other plans (brownfield required)
- In scope
- Out of scope
- Success criteria
- BDD scenarios (candidates — full specs go in work items)
- Architecture / implementation direction
- Risks / unknowns
- Constraints
- Suggested vertical slices (ID → task/spike/epic → planned slug)
- Parent context summary (5-10 lines for work item subagents)

## Output file

Write to `plans/prd-[slug].md`. The slug is a short kebab-case description
of the workload (e.g. `prd-context-broadcast-handler.md`).

## MoSCoW

Label each in-scope row with a MoSCoW priority per
[references/moscow-guide.md](references/moscow-guide.md).

Must-have rows go to work items first. Should-have and Could-have may be
deferred. Won't-have rows go to Out of scope.

## Accuracy gate

After writing the PRD draft, run the accuracy gate before splitting into
work items. Required for brownfield; recommended for greenfield.

See [references/prd-accuracy-gate.md](../ww-work-items/references/prd-accuracy-gate.md).

For each in-scope row, use `verify-this` to produce evidence:

1. Restate the claim as falsifiable: "behavior X does not exist on this
   branch"
2. Run `verify-this` — capture VERIFIED / NOT VERIFIED / INCONCLUSIVE
3. Map verdict to evidence label:
   - VERIFIED (behavior missing) → `verified-gap`
   - VERIFIED (bug reproducible) → `verified-red`
   - NOT VERIFIED (behavior partially exists) → `verified-partial`
   - INCONCLUSIVE → `investigate` → becomes `kind: spike`
   - Explicitly deferred → `deferred`

Append the gate table to the PRD. Do not hand off to `work-breakdown` until
the gate passes or all open items are recorded as `## Blocked decisions`.

## Hand-off

After PRD is written and gate passes:
- If PRD has architecture triggers → hand to `spec-planner` to delegate
  `architect-agent`
- Otherwise → hand to `work-breakdown` skill

## What you must never do

- Skip the accuracy gate on brownfield workloads
- Invent architecture direction not provided by the human
- Use a PRD ID that doesn't exist in the slices table in a work item
- Produce work items before this skill completes
