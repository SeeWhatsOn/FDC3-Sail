---
title: "Spike browser-first transport simplification"
slug: spike-browser-first-transport-simplification
kind: spike
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/interfaces/transport.ts
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/handlers/types.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/dacp-response-utils.ts
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/presets/create-wcp-client.ts
  - packages/sail-desktop-agent/src/presets/browser-session.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-message-routing.ts
  - packages/sail-desktop-agent/src/transports/in-memory-transport.ts
depends_on: []
integration_branch: v3-pre
branch: cursor/browser-first-transport-simplification
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - desktop-agent
  - architecture
  - spike
---

## Goal

Map current transport usage and decide the smallest browser-local replacement shape before removing remote Desktop Agent assumptions.

## User or system context

The current `Transport` abstraction mixes several concerns: DA runtime placement, internal browser preset wiring, per-app WCP routing, and test injection. This spike separates what must remain (`MessagePort` app communication and instance routing) from what can be removed or hidden (remote/worker/server-hosted DA support).

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `packages/sail-desktop-agent/src/core/interfaces/transport.ts`
- `packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts`
- `packages/sail-desktop-agent/src/app-connection/wcp/wcp-message-routing.ts`
- `website/docs/packages/desktop-agent/composition.md`

## Parent context

Browser-first simplification should not delete WCP `MessagePort` communication. The target is to remove or demote generic "Desktop Agent can live anywhere" transport support while keeping a clean app-connection boundary.

## Behavior spec

Phase 1: Given the current desktop-agent package, when transport usages are inventoried, then each usage is classified as remote-placement support, browser-local app-connection plumbing, test harness seam, or WCP `MessagePort` requirement.

Phase 2: Given the inventory, when direct calls and a tiny internal browser-local dispatcher are compared, then the spike records the chosen target shape, retained invariants, and follow-up edits for child tasks.

Phase 3: Given the chosen target shape, when public exports and docs are reviewed, then remote/worker/server DA support is either marked removable, marked deferred, or escalated with concrete evidence.

## Out of scope

- Implementing the refactor.
- Removing `MessagePortTransport`.
- Designing cross-tab/device sync or native WebSocket protocol support.

## TypeScript interfaces

Potentially affected: `Transport`, `DACPHandlerContext`, `BrowserDesktopAgentSession`, and any replacement response dispatcher shape. The spike should propose exact interface changes but not implement them unless the work is trivially documentary.

## Test guidance

No RED phase required for investigation-only output. Capture evidence from source paths and list the focused tests that later implementation tasks must preserve.

## Blocked decisions

- Choose direct local calls or a tiny browser-local dispatcher for `WCPConnector <-> DesktopAgent`.
- Decide whether `createWCPClient` is deleted, moved to an experimental path, or deferred in docs only.

## Loop history

Not started.

## Staged for review

Not staged.

## Escalation notes

None.

## Learnings extracted

None yet.

