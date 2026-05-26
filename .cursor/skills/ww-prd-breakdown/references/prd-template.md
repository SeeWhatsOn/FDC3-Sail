# PRD Template

Use this checklist before splitting a PRD into work items. If critical
fields are missing, ask focused questions instead of guessing.

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
- Risks / unknowns: product, technical, security, or operational risks.
- Constraints: platform, security, API, deadline, or team constraints.
- Suggested vertical slices: map each ID to `task` | `spike` | `epic` and
  planned work item slug.

## Optional

- Reference docs and source links.
- Rollout or launch notes.
- Migration or deprecation notes.
- Analytics, telemetry, or support requirements.

## Optional but recommended

- Commands: test, build, lint from `package.json` / `AGENTS.md`.
- Release brief link: `plans/release-*.md` or `project-docs.md` section.

## Validation

Before drafting work items:

1. Run [prd-accuracy-gate.md](prd-accuracy-gate.md) and record the gate
   table.
2. Confirm the PRD has enough behavior detail to produce BDD specs.
3. Identify unanswered questions that block safe slicing.
4. Decide whether missing details are blockers, `kind: spike`, or work-item
   `## Blocked decisions`.

