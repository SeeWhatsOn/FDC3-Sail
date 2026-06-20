---
title: "Harness popup disconnect cleanup after fdc3.open"
slug: harness-popup-wcp-disconnect-cleanup
kind: task
type: chore
status: in-progress
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-conformance-harness/src/main.tsx
  - packages/sail-conformance-harness/src/main.test.ts
depends_on:
  - pre-register-conformance1-pending-instance
integration_branch: v3-pre
branch: cursor/harness-popup-wcp-disconnect-cleanup
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Prevent stale WCP instances after FINOS open-test teardown by disconnecting popup tabs when the browser closes them or WCP6 goodbye fires.

## User or system context

Failed `closeWindow` teardown leaves mock popups and CONNECTED instances in agent state, inflating later `findIntent` `apps.length` and causing `AppTimeout` on subsequent opens. Harness must not override `window.close` on real popups; poll `window.closed` / use `onAppDisconnected` and call `disconnectInstance` per AGENTS.md harness conventions.

## Reference docs

- `AGENTS.md` (conformance harness teardown, no `window.close` override)
- `plans/completed-work-items/conformance-harness-host.md`
- FINOS conformance utils: `closeMockAppWindow` / `app-control` channel

## Parent context

Hygiene follow-up after `pre-register-conformance1-pending-instance` so failed or partial toolbox runs do not poison the harness session. Complements WCP integration tests in `extend-wcp-channel-delivery-integration-tests`.

## Behavior spec

Given a popup launched via harness `AppLauncher` for `fdc3.open`
When the popup browsing context closes (`window.closed === true`) or WCP disconnects that instance
Then the harness removes the panel entry
And calls `desktopAgent.disconnectInstance(canonicalInstanceId)` when the instance is still CONNECTED

Given Conformance1 successfully completes `closeMockAppWindow` for a popup
When the mock app calls `window.close()`
Then the harness detects closure within a reasonable poll budget and disconnects the instance

Given no popups remain open
When querying agent state for mock app instances from the completed test
Then stale CONNECTED/PENDING mock rows from that test are not retained

## Out of scope

- Heartbeat timeout tuning
- Changing FINOS toolbox teardown protocol
- sail-web launcher

## TypeScript interfaces

none

## Test guidance

Unit tests in `main.test.ts` with mocked `Window` (`closed` flag) and spy on `disconnectInstance`. Use `vi.waitFor` — no wall-clock sleeps in production code paths beyond minimal poll interval.

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
