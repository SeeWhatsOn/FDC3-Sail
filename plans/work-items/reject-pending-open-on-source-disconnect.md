---
title: "Reject pending open-with-context when source disconnects"
slug: reject-pending-open-on-source-disconnect
kind: task
type: bug
status: in-progress
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/handlers/utils/open-with-context.ts
  - packages/sail-desktop-agent/src/handlers/cleanup.ts
  - packages/sail-desktop-agent/src/handlers/__tests__/cleanup.test.ts
depends_on: []
integration_branch: v3-pre
branch: cursor/reject-pending-open-on-source-disconnect-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3, api]
---

## Goal

When the open-with-context **source** instance disconnects while a pending delivery is registered, send an `openResponse` error to that source before clearing state — so `fdc3.open()` promises settle instead of hanging until Mocha’s 20s budget.

## User or system context

FINOS toolbox v6 still shows **20s Mocha timeouts** on `AOpensBWithContext*` (signature: ~20010ms, not agent’s 15s `openContextListenerTimeoutMs`). One contributor is `clearPendingOpenWithContextForSourceInstance`, which clears pending entries **without** notifying the gone source. `cleanup.test.ts` currently **asserts zero** `openResponse` errors on source disconnect — that codifies the hang. This is RT-01 / first item in the regression net; RT-02 depends on settled open semantics.

## Reference docs

- `plans/prd-conformance-regression-test-net.md` (RT-01)
- `packages/sail-desktop-agent/src/handlers/utils/open-with-context.ts` (`clearPendingOpenWithContextForSourceInstance` JSDoc)
- `packages/sail-desktop-agent/src/handlers/__tests__/cleanup.test.ts` (~L240–304, source disconnect case)
- `AGENTS.md` (open-with-context, cleanup paths)

## Parent context

Child of `epic-conformance-regression-test-net`. Smallest product fix with highest leverage on 20s hang signature. WCP4 adoption fixes (already on branch) help identity correlation; this fix ensures **promise settlement** when the caller dies mid-open.

## Behavior spec

Given app A has registered a pending open-with-context targeting app B
When app A disconnects (WCP6, heartbeat timeout, or harness teardown) before B’s listener delivers
Then app A receives exactly one `openResponse` with `OpenError.AppTimeout` (or spec-aligned open error)
And pending entries for that source are removed from all target buckets
And pending timeout timers for those requests are cleared

Given app A disconnects with **no** pending open-with-context sourced from A
When cleanup runs
Then no spurious `openResponse` is sent

Given the existing cleanup test “source disconnect during pending open”
When updated to match new contract
Then it expects **one** error `openResponse`, not zero

## Out of scope

- Changing `openContextListenerTimeoutMs` default (15s)
- Target-instance disconnect behavior (already has timeout path)
- Harness `app-control` close-context handshake (TV5-01)

## TypeScript interfaces

Uses `DACPHandlerContext`, `BrowserTypes.OpenResponse`, existing `registerOpenWithContext` / `sendOpenResponse` helpers in open handlers.

## Test guidance

**RED:** Flip `cleanup.test.ts` source-disconnect case — expect `openResponse` with `error: "AppTimeout"` (or current enum string), `requestUuid` matching the pending `openRequest`.

**GREEN:** Implement in `clearPendingOpenWithContextForSourceInstance` (or call shared helper used by timeout path) to dispatch error to `sourceInstanceId` via `context.responses` before state mutation.

Run:

```bash
npx vp test run -w @finos/sail-desktop-agent -- src/handlers/__tests__/cleanup.test.ts
```

Use `MockTransport` / `createDACPTestContext` only — no new test-only production APIs.

## Blocked decisions

_(empty — default to `OpenError.AppTimeout` unless spec review prefers a distinct “source disconnected” code; document choice in PR description)_

## Loop history

- 2026-06-22: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
