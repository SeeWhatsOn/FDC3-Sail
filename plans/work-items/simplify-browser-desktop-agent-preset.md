---
title: "Simplify browser Desktop Agent preset"
slug: simplify-browser-desktop-agent-preset
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/presets/create-wcp-client.ts
  - packages/sail-desktop-agent/src/presets/browser-session.ts
  - packages/sail-desktop-agent/src/presets/index.ts
  - packages/sail-desktop-agent/src/index.ts
  - packages/sail-desktop-agent/package.json
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

Depends on `spike-browser-first-transport-simplification` for whether a tiny internal dispatcher remains and how `createWCPClient` is handled.

## Loop history

Not started.

## Staged for review

Not staged.

## Escalation notes

None.

## Learnings extracted

None yet.

