---
title: "Collapse browser app connection into DesktopAgent"
slug: collapse-browser-app-connection-into-desktop-agent
kind: task
type: feature
status: in-progress
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/app-connection/wcp-connector.ts
  - packages/sail-desktop-agent/src/app-connection/browser-da-edge-link.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-message-routing.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp1-3-handshake.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/dacp-response-utils.ts
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/presets/browser-session.ts
depends_on:
  - simplify-dacp-handler-response-plumbing
  - preserve-wcp-messageport-connectivity
integration_branch: v3-pre
branch: cursor/collapse-browser-app-connection-into-desktop-agent
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - desktop-agent
  - architecture
  - wcp
---

## Goal

Make `DesktopAgent` the browser-resident DA runtime that owns WCP listener lifecycle, per-app `MessagePort` routing, DA core handler dispatch, state updates, and outbound app delivery without a browser-path `Transport` / `BrowserDaEdgeLink` hop.

## User or system context

Maintainers want the product shape to be one browser-resident `DesktopAgent`, not `createBrowserDesktopAgent` plus `WCPConnector` plus `BrowserDaEdgeLink` plus a transport abstraction. FDC3 web apps still connect through WCP and per-app `MessagePort`; those browser mechanics become DA-owned app connection plumbing rather than a separate connector product.

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `plans/work-items/epic-browser-first-desktop-agent-simplification.md`
- `packages/sail-desktop-agent/src/core/desktop-agent.ts`
- `packages/sail-desktop-agent/src/app-connection/wcp-connector.ts`
- `packages/sail-desktop-agent/src/app-connection/browser-da-edge-link.ts`
- `packages/sail-desktop-agent/src/app-connection/wcp/wcp-message-routing.ts`
- `website/versioned_docs/version-2.2/api/specs/browserResidentDesktopAgents.md` from FINOS FDC3 v2.2
- `website/versioned_docs/version-2.2/api/specs/webConnectionProtocol.md` from FINOS FDC3 v2.2
- `website/versioned_docs/version-2.2/api/specs/desktopAgentCommunicationProtocol.md` from FINOS FDC3 v2.2

## Parent context

Sail should be browser-first: one browser-resident `DesktopAgent` owns local FDC3 state and app connection lifecycle for a host page. Web apps still communicate through WCP and per-app `MessagePort`; that is the app boundary. The complexity to remove is the remaining internal browser-path `Transport` hop and public/compositional mental model where a host wires a DA to a standalone WCP connector.

## Behavior spec

Given a host creates and starts a browser-resident `DesktopAgent`, when an app sends `WCP1Hello` from an iframe or popup, then the DA-owned browser app connection creates the `MessageChannel`, returns `WCP3Handshake`, tracks the pending temp instance id, and waits for `WCP4ValidateAppIdentity`.

Given an app sends `WCP4ValidateAppIdentity` or any later DACP request over its `MessagePort`, when the message reaches Sail, then `DesktopAgent` core handlers process the message, update DA state, and produce the appropriate WCP/DACP response or event.

Given a DA handler sends an outbound response or event, when the message has a destination instance id, then the DA-owned browser app connection routes it to the correct app `MessagePort`, including after temp-to-canonical instance id migration from `WCP5ValidateAppIdentityResponse`.

Given an app disconnects via `WCP6Goodbye`, host disconnect, heartbeat timeout, popup close, or failed identity validation, when cleanup runs, then DA core state and browser app connection maps are both pruned for the resolved instance id.

Given existing handler-only tests use `MockTransport` or similar seams, when this refactor lands, then those tests either keep a deliberate handler-only seam or move to a narrow test adapter; do not require browser `MessagePort` setup for every isolated DACP handler test.

## Out of scope

- Removing per-app `MessagePort`; it is the FDC3 browser app boundary.
- Implementing native WebSocket app connectivity, cross-tab sync, Agent Bridging, or remote/server-hosted DA support.
- Collapsing all WCP/browser app connection code physically into `desktop-agent.ts`.
- Preserving a public `WCPConnector` or `BrowserDaEdgeLink` compatibility facade on `v3-pre` unless the human explicitly asks for one.
- Designing observability hooks; BFDA-07 follows this runtime shape.
- Rewriting docs; BFDA-06 follows this runtime shape.

## TypeScript interfaces

Expected shape: remove browser-path `Transport` usage between DA core and app connection routing. If an internal boundary remains, make it narrow and DA-owned, for example an app edge callback/dispatcher that can receive inbound app messages and send outbound messages by `instanceId`. Do not expose this as normal product composition.

## Test guidance

Start with focused WCP integration coverage around the existing fragile paths before removing the edge link: WCP1-5 connection, temp-to-canonical instance migration, outbound routing by destination instance id, pending source window / instance identity reuse, WCP6 cleanup, failed WCP4 cleanup, and at least one channel or broadcast DACP round trip over `MessagePort`.

Use handler-only tests for DA core semantics where browser routing is irrelevant. Use jsdom WCP integration tests for browser app connection behavior. Preserve async delivery or ordering expectations that were previously provided by `BrowserDaEdgeLink` / transport delivery if any test or runtime behavior depends on them.

## Blocked decisions

None. Direction confirmed 2026-06-22: `DesktopAgent` is the full browser-resident DA product surface; browser app connection plumbing is internally owned by it.

## Loop history

- 2026-06-22: Delivery started (`status: in-progress`).
- 2026-06-22: Phase A RED — 8 failing tests in `wcp-desktop-agent-owned-connection.integration.test.ts`; architecture invariant fails because `BrowserDaEdgeLink` still wired.

## RED evidence

- **Test files changed:** `wcp-desktop-agent-owned-connection.integration.test.ts`, `wcp-owned-connection-test-helpers.ts`, `wcp-desktop-agent.integration.fixtures.ts`
- **Command:** `npm test -w @finos/sail-desktop-agent -- src/app-connection/__tests__/wcp-desktop-agent-owned-connection.integration.test.ts`
- **Failure summary:** All 8/8 fail at `assertCollapsedBrowserArchitecture()` — `createBrowserDesktopAgent()` still uses `BrowserDaEdgeLink` + `WCPConnector` transport hop.
- **Expected reason:** Correct RED; target is DA-owned WCP/MessagePort without edge link.
- **Unrelated tests:** Healthy (352 passed in same run).

## Staged for review

Not staged.

## Escalation notes

None.

## Learnings extracted

None yet.
