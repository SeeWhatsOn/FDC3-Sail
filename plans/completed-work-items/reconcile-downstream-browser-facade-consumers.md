---
title: "Reconcile downstream consumers of browser facade API"
slug: reconcile-downstream-browser-facade-consumers
kind: task
type: feature
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-platform-api/src/sail-platform.ts
  - packages/sail-platform-api/src/sail-browser-desktop-agent.ts
  - packages/sail-platform-api/src/__tests__/sail-platform-preset-wiring.test.ts
  - packages/sail-conformance-harness/src/main.tsx
depends_on:
  - simplify-browser-desktop-agent-facade-api
integration_branch: v3-pre
branch: cursor/reconcile-downstream-browser-facade-consumers
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: []
---

## Goal

Update `SailPlatform`, `createSailBrowserDesktopAgent`, and the conformance harness to consume `createBrowserDesktopAgent` returning `DesktopAgent` and `getBrowserDesktopAgentSession` for edge internals.

## User or system context

After the facade API, downstream packages must not expect `BrowserDesktopAgentResult` or destructure `wcpConnector` from the factory. Platform keeps `platform.agent` and `platform.connector`; harness uses `onAppConnected` callbacks or session lookup.

## Reference docs

- `plans/work-items/simplify-browser-desktop-agent-facade-api.md`
- `plans/work-items/align-sail-platform-wrapper-with-desktop-agent-preset.md`
- `plans/work-items/update-conformance-harness-desktop-agent-api.md`

## Parent context

Completes PKG-05 and PKG-06 acceptance for the facade return type. May land as a follow-up commit on existing platform/harness PR branches or a new branch after facade merges.

## Behavior spec

Given `SailPlatform.start()`
When it creates the browser desktop
Then it assigns `createBrowserDesktopAgent(...)` to `DesktopAgent` and uses `getBrowserDesktopAgentSession` for WCP events and channel transport.

Given `createSailBrowserDesktopAgent`
When it returns
Then the primary value is `DesktopAgent` (middleware `use` attached if retained).

Given the conformance harness bootstraps
When it creates the agent
Then it uses top-level `createBrowserDesktopAgent`, `onAppConnected` / `onAppDisconnected` callbacks, and does not destructure `wcpConnector` from the factory.

Given platform preset wiring tests
When they mock the factory
Then mocks return `DesktopAgent` and stub `getBrowserDesktopAgentSession` as needed.

## Out of scope

- sail-web UI redesign.
- New platform features beyond API reconciliation.

## TypeScript interfaces

Uses `getBrowserDesktopAgentSession` from `@finos/sail-desktop-agent/browser`.

## Test guidance

Run `npm test -w @finos/sail-platform-api` (preset wiring, channel tests) and harness typecheck/build after changes.

## Blocked decisions

_(empty)_

## Loop history

- 2026-06-10: Archived done — platform-api and conformance harness consume facade API; verified on v3-pre.

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
