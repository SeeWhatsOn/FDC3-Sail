---
title: "Simplify browser Desktop Agent preset"
slug: simplify-browser-desktop-agent-preset
kind: task
type: chore
status: staged
loop_count: 1
loop_limit: 3
last_agent: cursor
file_manifest:
  - packages/sail-desktop-agent/src/app-connection/browser-da-edge-link.ts
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/presets/browser-session.ts
  - packages/sail-desktop-agent/src/presets/index.ts
  - packages/sail-desktop-agent/src/index.ts
  - packages/sail-desktop-agent/src/app-connection/index.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-pending-source-window.ts
  - packages/sail-platform-api/src/sail-platform.ts
depends_on:
  - spike-browser-first-transport-simplification
  - preserve-wcp-messageport-connectivity
integration_branch: v3-pre
branch: cursor/simplify-browser-desktop-agent-preset
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - desktop-agent
  - preset
---

## Goal

Make `createBrowserDesktopAgent` the canonical Sail composition and remove or defer remote/worker/server Desktop Agent preset support.

## User or system context

Integrators should understand the default as "browser DA plus WCP app adapter," not "a Desktop Agent that might live anywhere." The browser preset should hide internal plumbing and expose grouped host controllers for intent resolver, channels, apps, and lifecycle.

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts`
- `packages/sail-desktop-agent/src/presets/create-wcp-client.ts`
- `packages/sail-desktop-agent/src/presets/browser-session.ts`

## Parent context

Remote DA support is not a near-term product requirement. If a future user needs multi-tab, multi-device, or server-mediated coordination, it should be designed as bridge/relay/sync work rather than being hidden inside the core preset model.

## Behavior spec

Given an integrator imports the browser preset, when they call `createBrowserDesktopAgent`, then they receive the browser-resident Desktop Agent with grouped `intentResolver`, `channels`, and `apps` controllers.

Given the package exports are reviewed, when remote/worker/server DA support is not required by the spike, then remote client preset exports and docs are removed or clearly deferred.

Given the browser preset starts and stops, when lifecycle runs, then WCP app connection startup and cleanup remain coupled to the Desktop Agent lifecycle.

## Out of scope

- Removing WCP `MessagePort` app connection.
- Refactoring every DACP handler response path.
- Designing replacement distributed bridge APIs.

## TypeScript interfaces

Likely affected: `BrowserDesktopAgent`, `BrowserDesktopAgentOptions`, `BrowserDesktopAgentSession`, `WCPClientOptions`, and `WCPClientResult`. Delete remote client types if the spike approves removal; do not add compatibility facades unless explicitly requested.

## Test guidance

Run focused preset and WCP integration tests for `@finos/sail-desktop-agent`. If exports change, include TypeScript/package-boundary coverage already used by the package.

## Blocked decisions

None — spike approved direct in-tab edge link; `createWCPClient` removed from public presets.

## Loop history

- Loop 1: Replaced `createInMemoryTransportPair` in browser preset with `createBrowserDesktopAgentEdgeLink`; removed `createWCPClient` and `connectorTransport` from session/API; updated platform wiring and tests. Vitest: preset (27), WCP integration (19), import smoke (5), platform wiring (2).

## Staged for review

- `BrowserDaEdgeLink` — same-process DA↔WCP delivery (no structuredClone).
- `createBrowserDesktopAgent` uses edge link instead of in-memory transport pair.
- Deleted `create-wcp-client.ts`; dropped `connectorTransport` from `BrowserDesktopAgentSession` / `createBrowserHostControllers`.
- `SailPlatform.ensureStarted` no longer requires connector transport.
- `wcp-pending-source-window` peers edge link endpoints like in-memory pairs.

## Learnings extracted

- Edge link keeps handler `context.transport` until BFDA-03; it is not a remote-DA abstraction.

