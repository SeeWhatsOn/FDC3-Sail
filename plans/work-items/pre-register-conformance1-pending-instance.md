---
title: "Pre-register Conformance1 PENDING instance for WCP4 host bind"
slug: pre-register-conformance1-pending-instance
kind: task
type: bug
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-conformance-harness/src/main.tsx
  - packages/sail-conformance-harness/src/main.test.ts
depends_on:
  - verify-v4-agent-fixes-on-current-branch
integration_branch: v3-pre
branch: cursor/pre-register-conformance1-pending-instance
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Make the Conformance1 iframe use the same host-assigned instanceId contract as `fdc3.open` popup apps so FINOS open-test teardown (`closeWindow` on `app-control`) routes DACP to a real instance bucket.

## User or system context

Harness sets `iframe name={conformance1InstanceId}` but does not pre-register that id in agent state. WCP4 mints a unrelated canonical id while `meta.hostInstanceId` still carries the iframe name. Symptom on host: `broadcastRequest` → `Instance not found`, `contextListenerUnsubscribe` → `ListenerNotFound`, cascade `AppTimeout` on later opens. Popup targets already pre-register via `openRequest` (`bind-host-instance-id-at-wcp4`); Conformance1 is the missing leg.

## Reference docs

- `plans/completed-work-items/bind-host-instance-id-at-wcp4.md`
- `plans/completed-work-items/investigate-launcher-wcp-instance-id.md`
- `plans/prd-toolbox-conformance-v4-follow-up.md` (TV4-05 / Open-Tests teardown)
- FDC3 2.2 WCP + DACP: `website/versioned_docs/version-2.2/api/specs/webConnectionProtocol.md`, `desktopAgentCommunicationProtocol.md`

## Parent context

From `plans/work-items/toolbox-conformance-v4-follow-up.md`: Real-browser WCP failures include AppTimeout on open teardown and stale instances. MockTransport BDD cannot catch Conformance1↔popup `app-control` routing. This unblocks manual toolbox Open-Tests slice without sail-web.

## Behavior spec

Given the conformance harness starts with Conformance1 iframe `name` set to `conformance1InstanceId`
When the harness creates the browser desktop agent
Then agent state includes a PENDING instance for appId `Conformance1` with `instanceId === conformance1InstanceId`

Given Conformance1 completes WCP4 with `window.name === conformance1InstanceId`
When WCP5 validates identity
Then canonical `instanceId` is `conformance1InstanceId` (no unrelated UUID from `createAppInstance`)
And `findInstances` for Conformance1 includes that id once CONNECTED

Given Conformance1 adds an `app-control` context listener and a mock app opened via `fdc3.open` broadcasts `fdc3-conformance-opened`
When Conformance1 broadcasts `{ type: "closeWindow", testId: … }` on `app-control`
Then the mock app receives the broadcast (no host `Instance not found` on `broadcastRequest`)
And Conformance1 can unsubscribe its listeners without `ListenerNotFound`

## Out of scope

- sail-web / platform-api iframe launcher changes
- Changing WCP4 adoption logic in `wcp-handlers.ts` (reuse existing `canAdoptPendingHostInstance`)
- DACP error enum changes for missing instance on add (not FDC3 2.2 normative — see epic notes)

## TypeScript interfaces

Uses existing `connectInstance` / `AppInstanceState.PENDING` from `@finos/sail-desktop-agent` (via preset state or public agent API available to harness — match how `openRequest` pre-registers in `app-handlers.ts`).

## Test guidance

Unit: extend `main.test.ts` to assert Conformance1 panel id is pre-registered in agent state after `createHarness()` (may require exposing a test hook or reading `desktopAgent.getState()`).

Manual: run harness on :3001, Open-Tests slice — host console must not show `Instance not found` on `closeMockAppWindow`.

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
