---
title: "App-channel context history conformance BDD gaps"
slug: app-channel-context-history-bdd
type: enhancement
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/test/features/channels/app-channels.feature
  - packages/sail-desktop-agent/test/step-definitions/
depends_on:
  - conformance-traceability-map
integration_branch: ""
branch: test/app-channel-context-history
external_tracker: ""
tags: [fdc3, conformance2.2]
---

## Goal

Add Cucumber scenarios for **remaining** FDC3 2.2 app-channel context history / ordering variants from the conformance pack — not a from-scratch app-channel suite.

## User or system context

`test/features/channels/app-channels.feature` already covers multiple types, untyped listeners, and several conformance flows. `FDC3_2_2_COMPLIANCE_REVIEW.MD` flags **matrix gaps**, not zero coverage.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 6)
- FINOS FDC3 2.2 App-Channel-Tests (external pack)
- `plans/work-items/conformance-traceability-map.md` (coordinate — list which rows this closes)

## Behavior spec

For each gap row in the traceability map marked partial/missing:
- Add scenario(s) with `@conformance2.2` and `@app-channels`
- Assert messaging tables match pack expectations

## Out of scope

- `Channel.clearContext()` (not FDC3 2.2 per remediation plan).

## Test guidance

RED: add scenarios against current code; fix handlers only when failure is spec-correct.

## Blocked decisions

Which exact conformance rows to import in v3 scope — use traceability map to bound work.
