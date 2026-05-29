---
title: "Investigate WCP and heartbeat test hygiene"
slug: align-wcp-instance-id-in-tests
kind: spike
type: bug
status: waiting_on_user
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/test/step-definitions/heartbeat.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/start-app.steps.ts
  - packages/sail-desktop-agent/test/step-definitions/disconnect.steps.ts
  - packages/sail-desktop-agent/test/support/mock-transport.ts
  - packages/sail-desktop-agent/test/features/apps/disconnect-cleanup-p0.feature
  - packages/sail-desktop-agent/test/features/infrastructure/heartbeat.feature
depends_on:
  - extend-cleanup-source-and-open-with-context
integration_branch: ""
branch: test/wcp-heartbeat-hygiene
external_tracker: ""
tags: [fdc3]
---

## Goal

**Investigate first:** failures such as “2 heartbeat timers remain” may be caused by test design (multiple `A desktop agent` inits, validate on one id / disconnect on another) rather than missing `stopHeartbeat` in production.

## User or system context

`disconnect-cleanup-p0.feature` scenario 3 uses goodbye (valid production path). Scenario 1 asserts `no heartbeat timers` without starting heartbeat — may pass vacuously.

`mockTransport.lastWcp5ValidatedInstanceId` exists for WCP5 canonical id — use when investigation confirms id mismatch.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 10)

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

**Phase 1 — minimal repro**

Given a single `DesktopAgent` instance for the scenario
When one validate, one goodbye (or disconnectInstance) for the same logical app
Then `getActiveHeartbeatTimerCount() === 0`

**Phase 2 — fix (test-only unless investigation finds a product gap)**

Align steps to WCP5 instance id or tighten scenarios; do not weaken assertions.

## Out of scope

- Production heartbeat cleanup logic (covered by `extend-cleanup-source-and-open-with-context` and related DACP paths).
- Rewriting unrelated BDD features outside heartbeat/WCP instance-id hygiene.

## TypeScript interfaces

none

## Test guidance

Do not assume product bug until minimal scenario passes/fails in isolation. Tighten scenarios to avoid vacuous heartbeat assertions.

## Blocked decisions

Resolved: failures were test design (connection id vs WCP5 canonical id, vacuous assertions). Test-only fixes; no production handler changes required.

## Loop history

- 2026-05-27: approved by human
- 2026-05-29: Phase 2 delivered — aligned steps to WCP5 canonical id via `mockTransport.registerWcp5Mapping` after validate; tightened disconnect-cleanup scenario 1 (removed duplicate agent init, distinct connection id, validate before disconnect); all 7 target scenarios green.

## Staged for review

**RED evidence (before):** `I test the liveness` and `no heartbeat timers` failed when steps used connection id `a1` while heartbeat/WCP6 ran on WCP5 canonical id; messaging assertions expected `to.instanceId: a1`.

**Command:** `cd packages/sail-desktop-agent && npx cucumber-js --profile single test/features/apps/disconnect-cleanup-p0.feature test/features/infrastructure/heartbeat.feature`

**Result:** 7 scenarios (7 passed), 84 steps (84 passed)

**Files changed:** file_manifest only (+ this work item)

**Learnings proposed:**
- [AGENTS.md candidate] After WCP4 validate in Cucumber, register `connectionId → lastWcp5ValidatedInstanceId` on `MockTransport` (WCP5 `meta.destination` is `temp-{uuid}`, not the test connection id).
- [AGENTS.md candidate] BDD liveness/disconnect/goodbye steps must resolve canonical instance id; pre-seeded connection instances should be removed after validate.
- [AGENTS.md candidate] `disconnectInstance(canonical)` may leave launch-keyed open-with-context pending under the connection id — disconnect both when they differ (test harness) until product migrates pending keys on WCP5.
