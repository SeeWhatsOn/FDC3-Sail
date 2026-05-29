# PRD Template

Use this checklist when creating or refining a PRD before splitting it into
epics and work items. If critical fields are missing, use `interview-me` or
ask focused questions instead of guessing.

## Required

- Persona / user: who benefits or operates the feature.
- Goal / outcome: what changes and why it matters.
- Relationship to other plans: table of existing PRDs/remediation docs →
  status → action (extend | no duplicate | defer).
- In scope: behaviors or capabilities included in this workload (prefer
  stable IDs: `PRD-01`, …).
- Out of scope: explicit non-goals.
- Success criteria: observable outcomes that prove value.
- BDD scenarios: Given / When / Then behavior candidates.
- Architecture / implementation direction: human-provided design intent,
  constraints, preferred patterns, APIs, data boundaries, and code-specific
  notes that downstream agents must preserve.
- Risks / unknowns: product, technical, security, or operational risks.
- Constraints: platform, security, API, deadline, or team constraints.
- Suggested vertical slices: map each ID to `task` | `spike` | `epic` and
  planned work item slug.
- Parent context summary: 5-10 lines that work item subagents can read
  without loading the full PRD.

## Optional

- **Workflow:** `workflow_profile` — PRD slug under `workloads:` in
  `plans/workflow-config.yaml` when this batch needs non-default automation
  (e.g. `draft_pr`). See `plans/WORKFLOW.md`.
- Reference docs and source links.
- Rollout or launch notes.
- Migration or deprecation notes.
- Analytics, telemetry, or support requirements.
- Commands: test, build, lint from `package.json` / `AGENTS.md`.
- ADR links for durable decisions that need a record outside the PRD.

## Validation

Before drafting work items:

1. Run [prd-accuracy-gate.md](prd-accuracy-gate.md) and record the gate
   table.
2. Confirm the PRD has enough product and architecture context to split
   safely.
3. Confirm behavior changes have enough detail to produce BDD specs.
4. Identify unanswered questions that block safe slicing.
5. Decide whether missing details are blockers, `kind: spike`, or work-item
   `## Blocked decisions`.

