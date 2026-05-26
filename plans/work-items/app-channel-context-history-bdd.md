---
title: "App-channel context history conformance BDD"
slug: app-channel-context-history-bdd
type: enhancement
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/test/features/channels/app-channels.feature
  - packages/sail-desktop-agent/test/step-definitions/
depends_on: []
integration_branch: ""
branch: test/app-channel-context-history
external_tracker: ""
tags: [fdc3, conformance2.2]
---

## Goal

Add Cucumber coverage for app-channel typed/untyped context history and ordering gaps listed in `FDC3_2_2_COMPLIANCE_REVIEW.MD`.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 6)
- FINOS FDC3 2.2 App-Channel-Tests (external pack)

## Behavior spec

Scenarios derived from conformance pack: multiple context types on one app channel, getCurrentContext / stored context ordering, listener delivery vs. history.

Tag with `@conformance2.2` and `@app-channels`.

## Out of scope

- `Channel.clearContext()` (not 2.2 per remediation plan).

## Test guidance

RED: add scenarios first against current implementation; fix handlers only if scenarios fail for spec-correct reasons.

## Blocked decisions

Which exact conformance rows to import — maintain traceability map (sibling work item).
