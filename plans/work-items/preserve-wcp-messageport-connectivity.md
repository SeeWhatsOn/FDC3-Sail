---
title: "Preserve WCP MessagePort connectivity"
slug: preserve-wcp-messageport-connectivity
kind: task
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/app-connection/wcp-connector.ts
  - packages/sail-desktop-agent/src/app-connection/message-port-transport.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-message-routing.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-connection-management.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/__tests__/wcp-desktop-agent.integration.test.ts
depends_on:
  - spike-browser-first-transport-simplification
integration_branch: v3-pre
branch: cursor/preserve-wcp-messageport-connectivity
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - desktop-agent
  - wcp
---

## Goal

Preserve browser app WCP `MessagePort` connectivity and instance routing before simplifying internal Desktop Agent transport assumptions.

## User or system context

The KISS refactor removes remote DA complexity, not the app communication mechanism. Iframe/window apps still need WCP1-5 handshake, per-app `MessagePort`, WCP5 temp-to-canonical instance migration, WCP6 cleanup, and DACP routing by `instanceId`.

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `packages/sail-desktop-agent/src/app-connection/wcp/wcp-message-routing.ts`
- `packages/sail-desktop-agent/src/app-connection/message-port-transport.ts`
- `packages/sail-desktop-agent/src/__tests__/wcp-desktop-agent.integration.test.ts`

## Parent context

Web apps must continue to communicate through WCP and per-app `MessagePort`. The simplification targets the internal generic transport and remote DA deployment story, not WCP app connectivity.

## Behavior spec

Given a browser host creates one browser Desktop Agent, when an iframe/window app completes WCP1 through WCP5, then the app is connected with a canonical `instanceId` and messages route over its `MessagePort`.

Given two connected app instances, when the Desktop Agent sends a targeted event or response, then the WCP adapter delivers it only to the app whose `meta.destination.instanceId` matches.

Given a connected app sends WCP6 goodbye or its `MessagePort` disconnects, when cleanup runs, then the WCP adapter and Desktop Agent remove the instance without orphaning route maps.

## Out of scope

- Replacing the internal DA-to-WCP adapter.
- Implementing native WebSocket protocol support.
- Adding distributed cross-tab/device routing.

## TypeScript interfaces

Existing `MessagePortTransport`, WCP message types, and WCP connector event types. Add or update only the minimal test/helper interfaces needed for the chosen target shape.

## Test guidance

Use focused `@finos/sail-desktop-agent` WCP integration coverage. Prefer extending `wcp-desktop-agent.integration.test.ts` or nearby WCP tests rather than adding MockTransport-only BDD for browser routing.

## Blocked decisions

Depends on `spike-browser-first-transport-simplification` for the exact internal adapter shape.

## Loop history

Not started.

## Staged for review

Not staged.

## Escalation notes

None.

## Learnings extracted

None yet.

