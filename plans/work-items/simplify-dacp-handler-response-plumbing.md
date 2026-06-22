---
title: "Simplify DACP handler response plumbing"
slug: simplify-dacp-handler-response-plumbing
kind: task
type: chore
status: staged
loop_count: 1
loop_limit: 3
last_agent: cursor
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/types.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/dacp-response-utils.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/index.ts
  - packages/sail-desktop-agent/test/support/dacp-handler-context.ts
depends_on:
  - spike-browser-first-transport-simplification
  - preserve-wcp-messageport-connectivity
integration_branch: v3-pre
branch: cursor/simplify-dacp-handler-response-plumbing
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - desktop-agent
  - dacp
---

## Goal

Simplify DACP handler response plumbing so handlers no longer carry generic remote-placement assumptions when a narrower browser-local response path is sufficient.

## User or system context

Today `DACPHandlerContext` exposes `transport`, and response helpers send directly through that generic transport. That centralizes routing but makes handlers feel like they are always writing to an arbitrary remote pipe. Browser-first architecture should prefer a narrow response dispatcher or return-based handler result if it makes handler behavior clearer without breaking WCP routing.

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `packages/sail-desktop-agent/src/core/handlers/types.ts`
- `packages/sail-desktop-agent/src/core/handlers/dacp/utils/dacp-response-utils.ts`
- `packages/sail-desktop-agent/src/core/desktop-agent.ts`

## Parent context

The Desktop Agent should be understood as a browser-resident stateful object. Handler code should still preserve FDC3 behavior and route responses/events to app instances, but it should not expose "server/worker/WebSocket DA location" as a normal handler concern.

## Behavior spec

Given a DACP request from a connected app, when the relevant handler creates a response, then the response is delivered to the requesting app with the same FDC3 payload and correct destination instance id.

Given a handler emits an app event such as a channel or intent event, when the event targets an app instance, then the WCP adapter still receives enough routing information to deliver it to the correct `MessagePort`.

Given the refactor touches shared handler context, when tests run, then existing channel, intent, open, listener, and WCP identity behavior remains unchanged.

## Out of scope

- Changing FDC3 semantics.
- Rewriting every handler in one unreviewable batch if a vertical slice is safer.
- Removing WCP app routing metadata where the adapter still needs it.

## TypeScript interfaces

Likely affected: `DACPHandlerContext`, `sendDACPResponse`, `sendDACPErrorResponse`, and any replacement `ResponseDispatcher` or handler result type approved by the spike.

## Test guidance

Start with the smallest vertical slice approved by BFDA-01, such as WCP connect plus channel join/broadcast. Run targeted `@finos/sail-desktop-agent` Vitest/Cucumber coverage for touched handler areas.

## Blocked decisions

None — handlers use `DacpResponseDispatcher`; WCP registries keep `responses.edgeTransport`.

## Loop history

- Loop 1: Replaced `DACPHandlerContext.transport` with `responses: DacpResponseDispatcher` (`sendToInstance`, `sendOutbound`, `getInboundInstanceId`, `edgeTransport` for WCP identity/pending-window keys). Updated all DACP handlers, router, cleanup, DesktopAgent context builder, Cucumber `dacp-handler-context`, and Vitest harness (`withResponseDispatcher`). Vitest: 122 passed across DACP handler + WCP integration suites.

## Staged for review

- `DacpResponseDispatcher` on handler context replaces generic `Transport`.
- `createDacpResponseDispatcher(edgeTransport)` factory in `dacp-response-utils.ts`.
- Handler events with pre-built routing use `responses.sendOutbound`.
- WCP4/WCP identity paths use `responses.edgeTransport` only where WeakMap keys require it.

## Learnings extracted

- `edgeTransport` is intentionally narrow — handlers should not call it for normal DACP responses.

