---
title: "Close MessagePort on error-driven disconnect"
slug: fix-messageport-error-disconnect-cleanup
type: bug
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-connection-management.ts
  - packages/sail-desktop-agent/src/browser/__tests__/message-port-transport.test.ts
depends_on:
  - fix-messageport-disconnect-reentrancy
integration_branch: ""
branch: fix/messageport-error-disconnect-cleanup
external_tracker: ""
tags: [fdc3]
---

## Goal

Ensure error-driven disconnect (`postMessage` failure, etc.) always removes listeners, closes the port once, and cooperates with WCP map cleanup even when `connected` is already false.

## User or system context

`handleDisconnect()` flips `connected` and calls the handler but may not close the port. A re-entrant `disconnectApp()` then calls `appTransport.disconnect()` which no-ops, leaving an open port with listeners.

## Reference docs

- `plans/project-docs.md`
- `.cursor/issues-discovered.md`

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

Given a connected MessagePortTransport
When `postMessage` throws or fails
Then listeners are removed, the port is closed exactly once, and WCP no longer routes to that instance

Given `connected` is already false
When centralized cleanup runs
Then port close and listener removal still execute if not yet done (idempotent)

## Out of scope

- `messageerror` policy decision (separate work item).
- InMemoryTransport changes.

## TypeScript interfaces

Internal cleanup method with idempotent guard flag recommended.

## Test guidance

RED: simulate `postMessage` failure and assert `port.close` and listener removal; spy WCP map deletion.

## Blocked decisions

(none)

## Loop history

- 2026-05-27: approved by human (validation gaps waived)

## Staged for review

## Escalation notes

## Learnings extracted
