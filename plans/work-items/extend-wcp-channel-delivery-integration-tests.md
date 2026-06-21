---
title: "WCP integration tests for two-app channel delivery"
slug: extend-wcp-channel-delivery-integration-tests
kind: task
type: feature
status: waiting_on_user
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-edge-test-helpers.ts
  - packages/sail-desktop-agent/src/app-connection/
depends_on: []
integration_branch: v3-pre
branch: cursor/extend-wcp-channel-delivery-integration-tests
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Add Vitest jsdom WCP integration coverage where two apps connect via `createBrowserDesktopAgent`, join/broadcast on a user or app channel, and the listener receives context with correct `destination.instanceId` routing.

## User or system context

v4 has ~36 `AppTimeout` failures on user/app channels and context metadata. `bdd-wcp-integration-scenario` delivered single-app handshake only; toolbox needs two-app delivery proof before more MockTransport BDD.

## Reference docs

- `plans/prd-toolbox-conformance-v5-follow-up.md` (TV5-02)
- `plans/project-docs.md` (TB-09 `bdd-wcp-integration-scenario` delivered)
- `website/docs/packages/desktop-agent/conformance.md`

## Parent context

Regression net for integration layer per fdc3-conformance-triage skill. Product fixes for routing may follow RED tests. Use host-assigned connection ids and `vi.waitFor` — no wall-clock sleeps per AGENTS.md.

## Behavior spec

Given two WCP-connected app instances A and B with distinct canonical instanceIds
When B joins a user channel and broadcasts a context type A is listening for
Then A receives the broadcast on its context listener within the test wait budget

Given two WCP-connected instances on the same app channel id
When B broadcasts after A adds a typed listener
Then A receives exactly one matching context payload

Given a broadcast is sent
When inspecting the DACP delivery meta
Then destination instanceId matches the listener instance canonical id

## Out of scope

- Full 36-scenario Playwright port
- sail-web iframe cross-origin fixes
- ContextMetadata toolbox rows (may add after basic delivery green)

## TypeScript interfaces

Uses existing browser desktop agent preset and WCP message types from `@finos/fdc3`.

## Test guidance

RED: New cases in `wcp-desktop-agent.integration.test.ts`; two MessagePorts / connectionAttemptUuids; `flushAsyncDelivery` between hops. Fail first on missing delivery, then fix connector routing if product bug confirmed.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

**TV5-02 complete (2026-06-21 grooming audit).** Vitest cases in `wcp-desktop-agent.integration.test.ts`:

- `"delivers user-channel broadcast from app B to app A listener over MessagePort routing"` (~L341)
- `"delivers app-channel broadcast from app B to app A listener over MessagePort routing"` (~L397)
- `broadcastEvent.meta.destination.instanceId` asserted in both broadcast tests
- Temp→canonical handshake and host pre-register / PENDING→WCP4 adopt cases

Shared helpers in `wcp-edge-test-helpers.ts`. Awaiting human `approve` at delivery gate.

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
