---
title: "Simplify browser Desktop Agent facade API"
slug: simplify-browser-desktop-agent-facade-api
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/connectors/browser/browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/connectors/browser/browser-desktop-agent-session.ts
  - packages/sail-desktop-agent/src/presets/browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/protocols/wcp/wcp-types.ts
  - packages/sail-desktop-agent/src/connectors/browser/wcp-connector.ts
  - packages/sail-desktop-agent/src/connectors/browser/index.ts
  - packages/sail-desktop-agent/src/index.ts
depends_on:
  - add-top-level-browser-desktop-agent-preset
integration_branch: v3-pre
branch: cursor/simplify-browser-desktop-agent-facade-api
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

`createBrowserDesktopAgent` returns a `DesktopAgent` with the WCP browser edge coupled to `start()` / `stop()`; advanced edge access via `getBrowserDesktopAgentSession`.

## User or system context

Integrators should not destructure `{ desktopAgent, wcpConnector, start, stop }`. The preset is a facade: one object for FDC3 host APIs; edge runs when the agent starts. Framework authors and tests use `getBrowserDesktopAgentSession` from `/browser` when they need `wcpConnector` or `connectorTransport`.

## Reference docs

- `packages/sail-desktop-agent/docs/browser-edge-and-da.md`
- `plans/work-items/add-top-level-browser-desktop-agent-preset.md`
- `plans/prd-desktop-agent-composable-package.md`

## Parent context

Supersedes the session-object return type in PKG-03. Manual composition (`new DesktopAgent` + `new WCPConnector`) remains explicit for advanced hosts.

## Behavior spec

Given `createBrowserDesktopAgent({ appLauncher })` is called
When the factory returns
Then the return type is `DesktopAgent` (not a destructured session bag).

Given `autoStart` is omitted (default true)
When the factory returns
Then `desktopAgent.start()` has already run and the WCP edge is listening.

Given `desktopAgent.start()` is called on a preset instance
When the edge is not yet started
Then `WCPConnector.start()` runs before the core agent transport handlers wire up.

Given `desktopAgent.stop()` is called
When teardown completes
Then both WCP edge and core agent are stopped.

Given `wcpOptions` is omitted
When WCP3Handshake is sent
Then `intentResolverUrl` and `channelSelectorUrl` are `false`.

Given static `intentResolverUrl` / `channelSelectorUrl` on `wcpOptions`
When WCP3Handshake is built
Then payload uses those values (FDC3 field names); getters override when both are set.

Given `onAppConnected` / `onAppDisconnected` / `onHandshakeFailed` options
When the corresponding WCP event fires
Then the host callback is invoked.

Given `getBrowserDesktopAgentSession(desktopAgent)` on a preset instance
When called
Then it returns `{ wcpConnector, connectorTransport }`.

Given `getBrowserDesktopAgentSession` on a hand-built `DesktopAgent`
When called
Then it throws a clear error.

## Out of scope

- Changing `createWCPClient` return shape (remote mode stays edge-only).
- `HostInstanceBinding` proposed API (separate future work item).
- sail-platform-api / harness updates (see `reconcile-downstream-browser-facade-consumers`).

## TypeScript interfaces

```typescript
// createBrowserDesktopAgent(options?): DesktopAgent

export interface BrowserDesktopAgentOptions {
  // ... existing host options
  autoStart?: boolean // default true
  intentResolverUrl?: string | false | true
  channelSelectorUrl?: string | false | true
  onAppConnected?: (metadata: AppConnectionMetadata) => void
  onAppDisconnected?: (instanceId: string) => void
  onHandshakeFailed?: (error: Error, connectionAttemptUuid: string) => void
}

// @finos/sail-desktop-agent/browser
export function getBrowserDesktopAgentSession(desktopAgent: DesktopAgent): BrowserDesktopAgentSession
```

Remove public export of `BrowserDesktopAgentResult`.

## Test guidance

RED: preset and browser factory tests expect `DesktopAgent` return; lifecycle tests use `desktopAgent.start()` / `stop()`; `getBrowserDesktopAgentSession` coverage. Run `npm test -w @finos/sail-desktop-agent` focused on `browser-desktop-agent` and preset tests.

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
