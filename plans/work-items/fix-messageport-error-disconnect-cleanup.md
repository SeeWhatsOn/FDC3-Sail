---
title: "Close MessagePort on error-driven disconnect"
slug: fix-messageport-error-disconnect-cleanup
type: bug
status: in-progress
loop_count: 1
loop_limit: 3
last_agent: test-engineer
file_manifest:
  - packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-connection-management.ts
  - packages/sail-desktop-agent/src/browser/__tests__/message-port-transport.test.ts
depends_on:
  - fix-messageport-disconnect-reentrancy
integration_branch: v3-pre
branch: cursor/fix-messageport-error-disconnect-cleanup-32fd
review_via: pr
relies_on_pr: "23, 25"
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
- 2026-05-28: RED — six new assertions in `message-port-transport.test.ts` for error-driven disconnect. Vitest (`npx vitest run src/browser/__tests__/message-port-transport.test.ts`): **5 failed / 23 passed** (28 total). Failures: `handleDisconnect()` sets `connected=false` and fires handler but never calls `port.close()` or `removeEventListener`; `disconnect()` early-returns when `connected` is already false so `disconnectApp()` cleanup leaves an open port with listeners. WCP map deletion via `disconnectApp` **passes** (reentrancy fix prerequisite met).

## Staged for review

## Escalation notes

## Learnings extracted

### Proposed (pending GREEN)

- **Root cause:** `handleDisconnect()` duplicates part of `disconnect()` (flips `connected`, calls handler) but skips listener removal and `port.close()`. `send()` catch path calls `handleDisconnect()` only. When `disconnectApp()` then calls `disconnect()`, the `if (!this.connected) return` guard prevents deferred cleanup.
- **Smallest fix:** Extract shared idempotent `disposePort()` (or fold into `handleDisconnect`) with a `portDisposed` guard; call from both `handleDisconnect()` and `disconnect()`. `disconnect()` should run port cleanup even when `connected` is already false if `portDisposed` is false.
- **WCP maps:** With reentrancy fix (maps cleared before `disconnect()`), `onDisconnect` → `disconnectApp` already removes `messagePortTransports` / `transportToInstanceId` / `connections` and emits `appDisconnected` once — no WCP-layer change required for map hygiene; transport must close the port on the error path.
- **Test harness:** `createListenerTracker()` spies `addEventListener`/`removeEventListener` to assert zero remaining handlers; `createMinimalWCPContext()` wires `disconnectApp` through `onDisconnect` for integration-style RED without full `WCPConnector`.
