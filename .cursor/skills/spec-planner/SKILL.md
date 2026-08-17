---
name: spec-planner
description: >
  Watson workflow planning harness: orchestrate interview, PRD writing,
  optional architecture review, and work breakdown into approved work items.
  Replaces the old ww-prd-breakdown orchestrator. Use for /ww-plan and any
  planning that produces PRDs and work items. Keywords: ww, watson workflow,
  ww-plan, PRD, work items, planning, spec-planner.
disable-model-invocation: true
metadata:
  author: watson
  workflow: ww
  phase: planning
---

# Spec Planner (harness)

Planning harness for the Watson workflow. Invoked as `/ww-plan`.

Run in the **top-level agent only**. Do not launch an orchestrator subagent
for this role — the top-level agent owns orchestration, human gates, and
file writes. Subagents are launched by individual stages, not by this harness
loading everything at once.

## Purpose

Take a goal or request from raw intent to a set of approved work items in
`plans/work-items/` that `/ww-deliver` can consume. Each stage outputs a
durable file. The file is the context — not the conversation history.

## Skills loaded in this harness (top-level only)

- `ww-work-items` — project health, canonical work item format, status lifecycle
- `ww-planning-stack` — routing: PRD vs epic vs spike vs direct work items
- `context-engineering` — focused context per phase

Do NOT load the atomic skills (`interview`, `prd`, `work-breakdown`, `bdd`)
all at once in the orchestrator. Load each one only for its phase.

## Routing

At startup, choose the lightest path that produces safe work items:

```
Input is a vague idea?          → Stage 1 (interview) first
Input is a clear requirement?   → Skip to Stage 2 (prd) directly
PRD already exists in plans/?   → Skip to Stage 4 (work-breakdown) directly
Work items exist, status draft? → Direct to /ww-approve
```

Consult `ww-planning-stack` for full routing guidance.

---

## Stage 0 — Health check

Run `ww-work-items` → Project Health Check.
Report and stop if any hard requirements are missing.

---

## Stage 1 — Interview (conditional)

**Load `interview` skill.**

Skip entirely if the input already fills the PRD template without guessing.

Output: `INTENT CONFIRMED` block.

---

## Stage 2 — PRD

**Load `prd` skill.**

Write `plans/prd-[slug].md` following `references/prd-template.md`.

For brownfield workloads: run the accuracy gate (uses `verify-this` per
claim). Do not proceed to Stage 4 until the gate passes or all open rows
become `kind: spike` work items.

Output: `plans/prd-[slug].md` with gate table appended.

---

## Stage 3 — Architecture review (conditional)

**Delegate to `architect-agent`** when the PRD contains any of:

- New service, module, or package
- Shared state mutation across module boundaries
- Third-party dependency choice
- Human-provided architecture direction needing validation
- Cross-module API or interface design

**Skip** when the PRD is a focused bug fix, doc update, or isolated change
with no cross-cutting concerns.

Hand the agent:
```text
prd_path:              plans/prd-[slug].md
architecture_section:  [relevant excerpt]
scope_summary:         [2-3 sentences]
trigger_reason:        [which trigger fired]
project_context:       [Watson workflow section + testing conventions from AGENTS.md]
```

`BLOCKER` verdict from `architect-agent` halts Stage 4. Surface the blocker
to the human and wait for resolution before continuing.

Output: ARCH REVIEW result + optional ADR at `docs/decisions/`.

---

## Stage 4 — Work breakdown

**Load `work-breakdown` skill.**

`work-breakdown` decomposes the PRD rows, applies MoSCoW, calls `bdd` for
behavior specs, validates INVEST, and delegates each item to `spec-agent`.

Do not load `bdd` or call `spec-agent` directly from this harness — those
are `work-breakdown`'s responsibility.

Output: `plans/work-items/[slug].md` files with `status: draft`, plus
dependency order.

---

## Stage 5 — Human gate

For each draft work item:

1. Run draft validation from `ww-work-items` → Draft Validation checklist.
2. Present using `.cursor/skills/ww-approve-work-items/references/human-gate-template.md`.
3. Wait for human reply: `approve` | `revise [note]`.
4. On `revise`: re-brief `spec-agent` with `revision_feedback`, re-validate,
   re-present.
5. On `approve`: write `status: approved` to the work item frontmatter.

Do not mark any item `approved` without an explicit human `approve` reply.

---

## Stage 6 — Handoff

Produce a handoff report:

```text
PLANNING COMPLETE

Approved work items:
- [slug]: [title] (kind: [task|spike|epic], priority: [MoSCoW])

Dependency order: [list slugs in sequence]

Next: /ww-deliver [first-slug]
      or /ww-approve [slug] to revisit a draft
```

Trigger `continual-learning` to capture durable planning learnings before
ending the session.

---

## Progress checklist

- [ ] Stage 0: health check passed
- [ ] Routing decision made
- [ ] Stage 1: INTENT CONFIRMED (if run)
- [ ] Stage 2: PRD written + accuracy gate passed
- [ ] Stage 3: ARCH REVIEW received (if triggered) — no BLOCKER
- [ ] Stage 4: work items drafted
- [ ] Stage 5: all drafts validated and human-approved
- [ ] Stage 6: handoff report + continual-learning triggered

---

## What you must never do

- Write production code or executable tests
- Load all atomic skills at once in the orchestrator context
- Skip the human gate before setting `status: approved`
- Split into work items before accuracy gate on brownfield workloads
- Present a draft before draft validation passes
- Modify `AGENTS.md` directly — `continual-learning` owns that
- Proceed past a failed Stage 0 health check
- Proceed past a `BLOCKER` from `architect-agent`
