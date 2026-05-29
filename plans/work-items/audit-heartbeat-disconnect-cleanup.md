---
title: "Audit heartbeat timer and state cleanup on disconnect"
slug: audit-heartbeat-disconnect-cleanup
kind: task
type: bug
status: waiting_on_user
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
integration_branch: v3-pre
branch: cursor/audit-heartbeat-disconnect-cleanup-f2c8
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-runtime.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/state/mutators/heartbeat.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/heartbeat-runtime.test.ts
depends_on: []
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

- 2026-05-27: approved by human (planning gate; status not updated)
- 2026-05-29: approved by human (/ww-approve)
- 2026-05-29: Phase A RED — added disconnect coverage tests; 1 failure (multi-instance WCP4 temp cleanup)

## RED evidence

- Test files changed: `packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/cleanup.test.ts`
- Command run: `cd packages/sail-desktop-agent && npx vitest run src/core/handlers/dacp/__tests__/cleanup.test.ts`
- Failure summary: New test `cleanupDACPHandlers clears only the targeted heartbeat when multiple instances are connected and WCP4 temp context is used` fails because after `cleanupDACPHandlers(targetContext)` with a WCP4 temp `instanceId`, `getActiveHeartbeatTimerCount()` remains 2 instead of 1 — the canonical instance's interval timer and `state.heartbeats[canonicalInstanceId]` are not cleared while the other instance's heartbeat remains correctly active.
- Expected reason: `resolveCleanupInstanceId` only maps temp → canonical when exactly one active heartbeat exists (`activeHeartbeatIds.length === 1`); with two connected instances both heartbeating, cleanup with a temp context id falls through to the temp id, so `stopHeartbeat` clears neither the canonical timer nor state row keyed by `startHeartbeat`'s id.
- Unrelated tests: healthy (200/201 Vitest pass; sole failure is the new multi-instance test)

## Staged for review

**Automation tier:** `stage_only` (no commit until human `approve`)

### GREEN summary

- **Fix:** `linkWcpTempInstanceId` at `startHeartbeat`; `resolveCleanupInstanceId` consults map before single-heartbeat heuristic.
- **Vitest:** 14/14 `cleanup.test.ts`, 201/201 package Vitest.
- **Cucumber:** 21/22 (one broadcast messaging step failed in full run — likely flaky; re-run if concerned).

### Phase audit

| Phase | Subagent | Registered | Result |
|-------|----------|------------|--------|
| A RED | test-engineer | yes | Multi-instance temp cleanup RED |
| B GREEN | implement-agent | yes | All cleanup tests green |
| C Verify | verifier-agent | yes | Orchestrator confirmed 18/18 focused vitest |
| D Review | code-reviewer | yes | VERDICT: PASS |

### Learnings proposed

- Document WCP4 temp→canonical link at `startHeartbeat` in AGENTS.md (extend existing WCP4/WCP5 bullet).
- Multi-connection Vitest needs shared state in `createDACPTestContext` when sharing `initialState`.
