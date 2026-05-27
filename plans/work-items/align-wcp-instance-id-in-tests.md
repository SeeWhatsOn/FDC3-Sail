---
title: "Investigate WCP and heartbeat test hygiene"
slug: align-wcp-instance-id-in-tests
kind: spike
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
  - packages/sail-desktop-agent/test/features/infrastructure/heartbeat.feature
depends_on:
  - audit-heartbeat-disconnect-cleanup
integration_branch: ""
branch: test/wcp-heartbeat-hygiene
external_tracker: ""
tags: [fdc3]
---

## Goal

**Investigate first:** Cucumber heartbeat / cleanup failures may be test design (multiple agent inits, validate on one id / disconnect on another) rather than production bugs. Run after or in parallel with `audit-heartbeat-disconnect-cleanup`.

## User or system context

`disconnect-cleanup-p0.feature` scenario 3 uses goodbye (valid production path). Scenario 1 asserts `no heartbeat timers` without starting heartbeat — may pass vacuously.

`mockTransport.lastWcp5ValidatedInstanceId` exists for WCP5 canonical id — use when investigation confirms id mismatch.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 10)
- `plans/work-items/audit-heartbeat-disconnect-cleanup.md`

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

**Phase 1 — minimal repro**

Given a single `DesktopAgent` instance for the scenario
When one validate, one goodbye (or disconnectInstance) for the same logical app
Then `getActiveHeartbeatTimerCount() === 0`

**Phase 2 — fix (test-only unless audit item found a product gap)**

Align steps to WCP5 instance id or tighten scenarios; do not weaken assertions.

## Out of scope

- Production heartbeat cleanup logic (see `audit-heartbeat-disconnect-cleanup`).

## TypeScript interfaces

none

## Out of scope

- Rewriting unrelated BDD features outside heartbeat/WCP instance-id hygiene.

## TypeScript interfaces

none

## Test guidance

Do not assume product bug until minimal scenario passes/fails in isolation. Tighten scenarios to avoid vacuous heartbeat assertions.

## Blocked decisions

Whether any change is test-only vs. handler fix (defer handler fixes to audit item).
