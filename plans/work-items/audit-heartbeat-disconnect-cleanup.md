---
title: "Audit heartbeat timer and state cleanup on disconnect"
slug: audit-heartbeat-disconnect-cleanup
kind: task
type: bug
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-runtime.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/state/mutators/heartbeat.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/heartbeat-runtime.test.ts
depends_on: []
integration_branch: ""
branch: fix/audit-heartbeat-disconnect-cleanup
external_tracker: ""
tags: [fdc3]
---

## Goal

Verify every production disconnect path clears both heartbeat interval timers and `state.heartbeats[instanceId]`, and add tests if any path leaks.

## User or system context

`AgentState.heartbeats` holds at most one entry per connected instance — not exponential growth — but a missed `stopHeartbeat` leaves a `setInterval` and state row until the tab reloads. BDD failures such as “2 heartbeat timers remain” may be test id mismatch or a real cleanup gap on goodbye / timeout / `disconnectInstance`.

Production already calls `stopHeartbeat` from `cleanupDACPHandlers`; this item confirms coverage and closes gaps.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 10 — related)
- `packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts`

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

Given an instance with an active heartbeat (WCP validate / connect path)
When disconnect occurs via WCP6 goodbye, heartbeat timeout, or `disconnectInstance`
Then `getActiveHeartbeatTimerCount() === 0` and `state.heartbeats[instanceId]` is absent

Given WCP4 temp connection vs WCP5 canonical `instanceId`
When cleanup runs
Then heartbeat is stopped for the same id that `startHeartbeat` used

## Out of scope

- Changing heartbeat interval/timeout defaults.
- Test step refactors covered by `align-wcp-instance-id-in-tests` (may run in parallel).

## TypeScript interfaces

none

## Test guidance

Extend Vitest on `heartbeat-runtime` / `cleanup` for each disconnect entry point. Coordinate with Cucumber `disconnect-cleanup-p0` and `heartbeat.feature` via `align-wcp-instance-id-in-tests` if failures are test-only.

## Blocked decisions

None.

## Loop history

- 2026-05-27: approved by human
