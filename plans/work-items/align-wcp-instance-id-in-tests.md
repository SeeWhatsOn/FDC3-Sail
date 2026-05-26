---
title: "Align Cucumber steps with WCP-validated instance ids"
slug: align-wcp-instance-id-in-tests
type: bug
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/test/step-definitions/heartbeat.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/start-app.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/disconnect.steps.ts
  - packages/sail-desktop-agent/test/support/mock-transport.ts
  - packages/sail-desktop-agent/test/features/apps/disconnect-cleanup-p0.feature
depends_on:
  - extend-cleanup-source-and-open-with-context
integration_branch: ""
branch: test/wcp-instance-id-alignment
external_tracker: ""
tags: [fdc3, wcp]
---

## Goal

When WCP4 assigns a canonical instance id, steps for validate, goodbye, disconnect, and DACP messages use that id so heartbeat and cleanup assertions match production routing.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 10)
- `mockTransport.lastWcp5ValidatedInstanceId`

## Behavior spec

Given sends validate for connection id `a1`
When WCP5 returns instance id `canonical-xyz`
Then subsequent DACP and `disconnectInstance` use `canonical-xyz`

## Test guidance

GREEN `disconnect-cleanup-p0` heartbeat scenario and heartbeat.feature timeout cleanup scenario.

## Blocked decisions

(none)
