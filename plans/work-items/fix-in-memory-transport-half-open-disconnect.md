---
title: "Fix half-open peer state on InMemoryTransport disconnect"
slug: fix-in-memory-transport-half-open-disconnect
type: bug
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/transports/in-memory-transport.ts
  - packages/sail-desktop-agent/src/transports/__tests__/in-memory-transport.test.ts
depends_on: []
integration_branch: ""
branch: fix/in-memory-transport-half-open-disconnect
external_tracker: ""
tags: [fdc3]
---

## Goal

Ensure disconnecting one side of an in-memory transport pair fully tears down both endpoints so browser agent stop/restart and reuse are not fragile.

## User or system context

`createBrowserDesktopAgent()` uses `createInMemoryTransportPair()`. Today `disconnect()` only marks the local side disconnected while the peer may still report `isConnected() === true`, misleading lifecycle state after `stop()`.

## Reference docs

- `plans/project-docs.md`
- `plans/prd-transport-platform-hardening.md`
- `.cursor/issues-discovered.md` (InMemoryTransport section)

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

Given a connected in-memory transport pair
When endpoint A calls `disconnect()`
Then endpoint A is disconnected, endpoint B is disconnected, peer references are cleared, and each side's disconnect handler runs at most once

Given a connected pair where B already disconnected
When A calls `disconnect()` again
Then the operation is idempotent and handlers do not run again

Given a browser desktop agent created with the default in-memory pair
When `stop()` then a new agent is started
Then the new pair has no stale peer references from the previous session

## Out of scope

- Send-failure signaling (separate work item).
- Backpressure or message batching.
- MessagePort / WCP changes.

## TypeScript interfaces

Reuse existing `Transport` / `InMemoryTransport` public surface; internal idempotent close path may be private.

## Test guidance

RED: extend `in-memory-transport.test.ts` with peer `isConnected()` after local disconnect and remove stale comment claiming peer notification is unimplemented. Add browser-agent stop/start reuse test if harness exists; otherwise pair-level tests are minimum bar.

## Blocked decisions

(none)

## Loop history

- 2026-05-27: approved by human (validation gaps waived)

## Staged for review

## Escalation notes

## Learnings extracted
