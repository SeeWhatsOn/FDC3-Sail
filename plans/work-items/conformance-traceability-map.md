---
title: "FDC3 2.2 conformance traceability map"
slug: conformance-traceability-map
type: docs
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/docs/conformance-traceability.md
  - packages/sail-desktop-agent/test/features/
depends_on: []
integration_branch: ""
branch: docs/conformance-traceability
external_tracker: ""
tags: [fdc3]
---

## Goal

Publish a maintainable map from FINOS FDC3 2.2 conformance areas to in-repo Cucumber scenarios, with honest status: covered | partial | missing | n/a.

## User or system context

`@conformance2.2` tags exist on many scenarios but do not by themselves prove full pack coverage. This map drives items 6–7 and release narrative.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 8)

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

Given FINOS FDC3 2.2 conformance pack areas
When each area is mapped to in-repo Cucumber scenarios
Then the traceability doc lists status covered | partial | missing | n/a with feature file and scenario references

## Deliverable

Markdown table under `packages/sail-desktop-agent/docs/conformance-traceability.md` (or repo `docs/`) with columns:

- Conformance area / test name (from FINOS pack or `fdc3-expert` knowledge base)
- Feature file + scenario name (if any)
- Status
- Notes / owner work item slug

## TypeScript interfaces

none

## Out of scope

- Toolbox `fdc3-conformance` UI progress work (see `.cursor/plans/fdc3-conformance-progress_*.plan.md`).

## Test guidance

Review map accuracy against `test/features/`; no executable tests required unless doc paths break CI.

## Blocked decisions

Authoritative list source: local `fdc3-expert` vs. published FINOS conformance artifact version pin.

## Loop history

- 2026-05-27: approved by human (validation gaps waived)
