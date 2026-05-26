---
title: "Extend cleanupDACPHandlers for source pending intents and open-with-context"
slug: extend-cleanup-source-and-open-with-context
type: bug
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/open-with-context.ts
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/cleanup.test.ts
  - packages/sail-desktop-agent/test/features/apps/disconnect-cleanup-p0.feature
depends_on: []
integration_branch: ""
branch: fix/cleanup-source-and-open-with-context
external_tracker: ""
tags: [fdc3, lifecycle, p0]
---

## Goal

Make `cleanupDACPHandlers` / `disconnectInstance` clear all instance-related pending work: intents where the instance is **source** or **target**, and open-with-context state plus module timeout handles.

## User or system context

Vitest and `disconnect-cleanup-p0.feature` are red. Task 3 in `FDC3_2_2_REMEDIATION_PLAN.MD` covers heartbeat path but not these two gaps.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (items 1–2)
- `packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts`

## Behavior spec

Given a pending intent with `sourceInstanceId` equal to the disconnecting instance
When `cleanupDACPHandlers` runs
Then `intents.pending` has no entry for that requestId, promise map entry removed, timeouts cleared, reject called if applicable

Given open-with-context pending on target instance X
When instance X disconnects
Then `open.pendingWithContext[X]` is cleared and `pendingOpenWithContextTimeouts` has no entry for that request

## Out of scope

- New Cucumber tags; use existing steps and `disconnectInstance`.

## Test guidance

GREEN existing `cleanup.test.ts` and `disconnect-cleanup-p0.feature` without changing assertions to match buggy behavior.

## Blocked decisions

(none)
