---
title: "WCP integration tests for first-connect open-with-context"
slug: wcp-first-connect-open-with-context-integration
kind: task
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-edge-test-helpers.ts
depends_on:
  - reject-pending-open-on-source-disconnect
integration_branch: v3-pre
branch: cursor/wcp-first-connect-open-with-context-integration-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Add Vitest jsdom WCP integration cases that exercise **FINOS-realistic WCP4** (no `instanceUuid` on first connect) through open-with-context delivery — proving `openResponse` and listener broadcast settle within the test wait budget.

## User or system context

Cucumber and existing WCP integration tests inject perfect WCP4 (`instanceId` + `instanceUuid` + `wcpSourceWindow`). FINOS get-agent / toolbox often omits `instanceUuid` on first connect. v6 rows `AOpensBWithContext3`, `AOpensBWithSpecificContext`, `AOpensBMultipleListen` fail with 20s hang when pending bucket instance id ≠ listener instance id. RT-02 is the core agent regression net.

## Reference docs

- `plans/prd-conformance-regression-test-net.md` (RT-02)
- `packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts`
- `packages/sail-desktop-agent/src/app-connection/__tests__/wcp-edge-test-helpers.ts`
- `packages/sail-desktop-agent/src/handlers/utils/wcp-host-instance-adoption.ts`
- `website/docs/packages/desktop-agent/conformance.md`

## Parent context

Child of `epic-conformance-regression-test-net`. Depends on RT-01 so source-disconnect during pending does not leave ambiguous hang behavior. Builds on TV5-02 two-app channel delivery helpers.

## Behavior spec

### First connect without instanceUuid

Given host pre-registers pending instance `L` for `MockAppId` and launcher opens with context pending on `L`
When app B completes WCP4 with `identityUrl` only (no `instanceUuid`, optional no `instanceId` when sole pending)
And WCP5 adopts canonical id `L`
And B adds a context listener matching the pending context type
Then A receives `openResponse` success within `vi.waitFor` budget
And B receives `broadcastEvent` with the opened context
And `pendingWithContext` for `L` is empty

### Specific context type (AOpensBWithSpecificContext shape)

Given B listens only for `fdc3.instrument`
When A opens with `fdc3.instrument` context
Then delivery succeeds
When A opens with `fdc3.country` only (separate scenario or negative case)
Then no delivery to wrong listener; pending times out or rejects per spec

### Multiple listeners (AOpensBMultipleListen shape)

Given B registers a non-matching listener first, then a matching listener
When A opens with context
Then only the matching listener receives broadcast
And A receives a single successful `openResponse`

### Negative: identity mismatch without adoption

Given pending on launcher id `L` but listener registered on different id `W` with no adoption link
When WCP4 does not adopt `L`
Then A receives `openResponse` error within agent timeout (not silent hang)

## Out of scope

- Real cross-origin iframe (jsdom single origin is sufficient)
- MetadataApp / GetInfo2 (optional RT-08)
- Harness `AppLauncher` wiring (RT-04)

## TypeScript interfaces

Extend `connectWcpApp` helpers with `connectWcpAppFirstConnect()` variant — parameters to omit `hostInstanceId` / `instanceUuid` unless test opts in. Reuse `createGenericContextListenerMessage`, `flushAsyncDelivery`, `vi.waitFor`.

## Test guidance

**RED:** Add `describe("open-with-context (first-connect WCP4)")` block in `wcp-desktop-agent.integration.test.ts` with cases above. New helper in `wcp-edge-test-helpers.ts` for WCP4 payload without `instanceUuid`.

**Assertions:**
- Spy or collect DACP messages on source connection for `openResponse`
- Assert `broadcastEvent` on target connection
- Use `vi.waitFor` with reasonable timeout (< 15s wall clock in CI)

Run:

```bash
npx vp test run -w @finos/sail-desktop-agent -- src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
```

If RED exposes product bug in adoption or open-with-context routing, fix in same work item (minimal diff).

Optional: add one traceability row to `conformance.md` mapping RT-02 cases to toolbox scenario names.

## Blocked decisions

_(empty)_

## Loop history

- 2026-06-22: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
