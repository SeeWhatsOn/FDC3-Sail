---
title: "Consolidate temp to canonical instance id resolver"
slug: consolidate-temp-instance-id-resolver
kind: task
type: chore
status: approved
loop_count: 0
loop_limit: 3
last_agent: spec-planner
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/heartbeat-runtime.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/resolve-context-listener-instance-id.ts
  - packages/sail-desktop-agent/src/app-connection/wcp-connector.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-connection-management.ts
  - packages/sail-desktop-agent/test/support/mock-transport.ts
depends_on:
  - wire-wcp5-connected-instance-lifecycle
integration_branch: v3-pre
branch: cursor/consolidate-temp-instance-id-resolver
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
  - fdc3
  - wcp
---

## Goal

Replace scattered temp→canonical instance id logic with one documented resolver contract used by WCP connector (browser), DA cleanup, and DACP routing — without breaking remote-DA or MockTransport test paths.

## User or system context

WCP4 routes under `temp-{connectionAttemptUuid}`; WCP5 assigns canonical `instanceId`. Today multiple modules maintain parallel maps, increasing disconnect and adoption bug risk.

## Reference docs

- `plans/prd-desktop-agent-state-hardening.md` (PRD-04d)
- ARCH REVIEW PASS: single contract, browser + DA bindings
- `AGENTS.md` WCP4 temp vs WCP5 canonical ids

## Parent context

Depends on lifecycle slice so canonical ids and `CONNECTED` are stable before refactoring identity maps.

## Behavior spec

Scenario: Cleanup resolves temp id to canonical instance
  Given an app validated WCP5 under a temp connection id with heartbeat started
  When disconnect cleanup runs using the temp connection id as handler context
  Then cleanup targets the canonical instance id and removes that instance's state

Scenario: Browser connector migrates routing keys on WCP5
  Given a WCP connection established with a temp instance id
  When WCP5 success is sent with the canonical instance id
  Then subsequent DACP messages route using the canonical id

Scenario: MockTransport tests register temp to canonical mapping
  Given a Cucumber scenario using WCP4 validate with a temp connection id
  When WCP5 assigns a canonical instance id
  Then test harness mapping resolves temp ids the same way as production

## Out of scope

- Changing FDC3 WCP message shapes
- FIFO message queue
- Lifecycle enum work (prerequisite child)

## TypeScript interfaces

Introduce a small module or transport contract, e.g.:

```typescript
/** Resolve WCP4 temp connection id to canonical WCP5 instance id, if linked. */
function resolveCanonicalInstanceId(routingId: string): string | undefined
function linkTempToCanonical(tempId: string, canonicalId: string): void
function unlinkCanonical(canonicalId: string): void
```

Browser preset wires connector map; DA wires heartbeat link at WCP5.

## Test guidance

RED: add failing tests in `cleanup.test.ts` and `wcp-desktop-agent.integration.test.ts` that fail if temp id cleanup misses canonical instance. Preserve `MockTransport.registerWcp5Mapping` behavior via the shared contract. Run existing WCP host adoption tests.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
