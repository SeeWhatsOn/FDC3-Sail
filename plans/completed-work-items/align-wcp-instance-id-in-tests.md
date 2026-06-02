---
title: "Investigate WCP and heartbeat test hygiene"
slug: align-wcp-instance-id-in-tests
kind: spike
type: bug
status: done
branch: cursor/align-wcp-instance-id-in-tests-f2c8
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/41
merged_pr: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/41"
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
- 2026-05-29: auto-deliver — WCP5 canonical id in BDD; 7 scenarios pass; branch pushed
- 2026-05-29: human approve all — PR #41
- 2026-06-01: reconcile — PR merged (batch 2)
