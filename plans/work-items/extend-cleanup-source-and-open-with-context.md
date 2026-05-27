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
tags: [fdc3]
---

## Goal

Extend `cleanupDACPHandlers` / `disconnectInstance` beyond today's target-only pending-intent filter:

1. **Required:** clear pending intents when disconnecting instance is `sourceInstanceId`.
2. **Required:** clear `open.pendingWithContext[targetInstanceId]` and `pendingOpenWithContextTimeouts` when the **target** instance disconnects.
3. **Optional follow-up:** cancel open-with-context when **source** disconnects (add BDD first).

## User or system context

Vitest (`cleanup.test.ts`) and Cucumber (`disconnect-cleanup-p0.feature`) are **red on v3-pre** for items 1–2.

`FDC3_2_2_REMEDIATION_PLAN.MD` Task 3 is **partially complete** (heartbeat uses `cleanupDACPHandlers`; module timers cleared in hooks). This work item is **not** a repeat of Task 3.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (items 1–2)
- `packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts`

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

**Required — source pending intent**

Given `intents.pending[requestId]` with `sourceInstanceId === instanceId` being cleaned up
When `cleanupDACPHandlers` runs
Then that pending entry is removed, `pendingIntentPromises` entry cleared, timeouts cleared, `reject` called if a promise entry exists

**Required — open-with-context target**

Given `open.pendingWithContext[targetInstanceId]` has entries
When `cleanupDACPHandlers` runs for `instanceId === targetInstanceId`
Then that bucket is empty and `pendingOpenWithContextTimeouts` has no handles for those `requestUuid` values

**Optional — open-with-context source**

Given pending open entries where `sourceInstanceId === instanceId`
When source disconnects
Then pending removed and timeouts cleared (add Vitest + Cucumber before implementing)

## Out of scope

- Re-implementing heartbeat cleanup (already calls `cleanupDACPHandlers`).

## TypeScript interfaces

none

## Test guidance

GREEN existing failing tests without weakening assertions. Consider tightening Cucumber scenario 1 so `no heartbeat timers` runs only when heartbeat was started (avoid vacuous pass).

## Blocked decisions

Whether source-side open-with-context cancel is required for v3 or deferred.
