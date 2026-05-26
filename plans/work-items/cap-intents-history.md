---
title: "Bound intents.history growth"
slug: cap-intents-history
type: enhancement
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/state/mutators/intent.ts
  - packages/sail-desktop-agent/src/core/state/types.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/
depends_on: []
integration_branch: ""
branch: fix/cap-intents-history
external_tracker: ""
tags: [fdc3, lifecycle]
---

## Goal

Prevent unbounded growth of `state.intents.history` in long-running Desktop Agent sessions.

## User or system context

Every `recordIntentResolution` appends forever; trading desktops may run days without reload.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 3)
- `FDC3_2_2_COMPLIANCE_REVIEW.MD` (optional cleanup / QA)

## Behavior spec

Given N intent resolutions recorded
When N exceeds configured cap (or age TTL)
Then oldest entries are removed and selectors still return recent resolutions by requestId

## Out of scope

- Persisting history to disk.

## Test guidance

Unit test: record cap+1 resolutions, assert map size <= cap.

## Blocked decisions

Cap by count vs. TTL vs. both — default recommendation: max 500 entries FIFO unless product specifies otherwise.
