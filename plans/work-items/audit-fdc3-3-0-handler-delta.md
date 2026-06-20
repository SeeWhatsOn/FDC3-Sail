---
title: "Audit FDC3 3.0 vs 2.2 handler delta"
slug: audit-fdc3-3-0-handler-delta
kind: spike
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - plans/prd-fdc3-3-0-dual-version-support.md
depends_on: []
integration_branch: v3-pre
branch: cursor/audit-fdc3-3-0-handler-delta-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Produce an authoritative checklist mapping FINOS FDC3 3.0 API and DACP wire deltas to Sail handler files, classifying each row as done, partial, gap, or deferred.

## User or system context

Downstream 3.0 work items need a single source of truth before implementation. Prevents duplicate spikes and wrong attribution (e.g. GetInfo2 as 3.0 vs 2.2 open-with-context).

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md` (F30-01)
- FINOS FDC3 3.0 API reference and DACP schema (external)
- `packages/sail-desktop-agent/src/core/handlers/dacp/`
- `AGENTS.md`

## Parent context

Child of `epic-fdc3-3-0-dual-version`. First Must-have slice. Output updates PRD accuracy gate rows or an appendix section — no production code unless a one-line comment is warranted.

## Behavior spec

### Phase 1 — Investigate

Scenario: Map breaking 3.0 removals
  Given FINOS 3.0 API reference deprecated/removed list
  When each entry is checked against Sail public surface and DACP handlers
  Then the checklist records done / not applicable / gap with file path

Scenario: Map additive 3.0 wire fields
  Given FINOS 3.0 DACP open, broadcast, raiseIntent, channel messages
  When each optional `metadata` or new message type is traced in `core/handlers/dacp/`
  Then each row is classified verified-partial, verified-gap, or done with evidence path

Scenario: Toolbox overlap
  Given v5 failure review clusters (GetInfo2, getResultMetadata, close-context)
  When each symptom is attributed to 2.2 vs 3.0 vs harness
  Then child work items are not mis-scoped

### Phase 2 — Deliverable (doc-only)

Scenario: Handoff to implementation
  Given Phase 1 checklist complete
  When maintainers read the PRD appendix or spike notes
  Then every F30-03–11 row has an updated evidence label and no conflicting slugs

## Out of scope

- Implementing gaps found during audit
- Bumping `@finos/fdc3` dependency
- FINOS policy questions on findIntent (stays on v5 epic)

## TypeScript interfaces

none

## Test guidance

Docs-only spike deliverable: no executable RED phase. Verification: human review of checklist completeness against FINOS 3.0 reference; optional cross-check with existing `@conformance3.0` in `close.feature`.

**Deliverable via `/ww-deliver`:** yes — Phase 2 is markdown updates to PRD (accuracy gate appendix) only.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
