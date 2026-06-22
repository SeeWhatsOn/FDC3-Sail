---
title: "Define browser DA observability hooks"
slug: define-browser-da-observability-hooks
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/interfaces/logger.ts
  - packages/sail-desktop-agent/src/app-connection/wcp-connector.ts
  - packages/sail-desktop-agent/src/app-connection/wcp/wcp-message-routing.ts
  - packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/host-contracts
depends_on:
  - simplify-dacp-handler-response-plumbing
integration_branch: v3-pre
branch: cursor/define-browser-da-observability-hooks
pr_url: ""
merged_pr: ""
external_tracker: ""
tags:
  - api
---

## Goal

Define lightweight middleware, logging, and OTEL hook points for the browser-first Desktop Agent without depending on generic transport wrapping.

## User or system context

Removing the remote transport mental model should not block plugin-style behavior or observability. Hooks should attach to named FDC3/domain events such as app request handling, channel changes, intent resolution, app lifecycle, and WCP routing.

## Reference docs

- `plans/prd-browser-first-desktop-agent-simplification.md`
- `packages/sail-desktop-agent/src/core/interfaces/logger.ts`
- `packages/sail-desktop-agent/src/app-connection/wcp/wcp-message-routing.ts`
- `packages/sail-desktop-agent/src/presets/create-browser-desktop-agent.ts`

## Parent context

Browser-first observability can be clearer than transport send/receive logging because spans and events can use domain names: inbound app request, handler latency, channel change, intent resolver request, app connect/disconnect, and outbound app delivery.

## Behavior spec

Given a host configures observability hooks, when an app request enters the browser Desktop Agent, then the hook can observe request type, instance id, timing, and outcome without mutating FDC3 payloads.

Given a channel or intent resolver event occurs, when hooks are enabled, then the host can log or emit OTEL spans/events with domain-specific names.

Given WCP app delivery fails, when hooks are enabled, then the host can observe the destination instance id, message type, and error without reaching into raw connector internals.

## Out of scope

- Adding an OTEL dependency unless an approved implementation task explicitly chooses one.
- Recreating a generic transport decorator layer.
- Designing a large plugin framework before there are concrete plugin use cases.

## TypeScript interfaces

Likely new or changed hook option types on browser preset or Desktop Agent configuration. Keep them minimal and domain-specific.

## Test guidance

Use focused unit tests for hook invocation if runtime hooks are implemented. Do not assert on external OTEL libraries unless the package explicitly adopts one.

## Blocked decisions

None — `DacpResponseDispatcher` delivered (BFDA-03, 2026-06-21).

## Loop history

Not started.

## Staged for review

Not staged.

## Escalation notes

None.

## Learnings extracted

None yet.

