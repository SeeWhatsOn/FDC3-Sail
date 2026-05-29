---
title: "Make InMemoryTransport send failures observable"
slug: fix-in-memory-transport-send-failures
merged_pr: "v3-pre@78cc9afe #24"
type: bug
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/transports/in-memory-transport.ts
  - packages/sail-desktop-agent/src/transports/__tests__/in-memory-transport.test.ts
  - packages/sail-desktop-agent/src/core/interfaces/transport.ts
depends_on: []
integration_branch: ""
branch: fix/in-memory-transport-send-failures
external_tracker: ""
tags: [fdc3]
---

## Goal

Stop `InMemoryTransport.send()` from **lying by returning successfully** when the message never reaches the peer — so DACP request/response flows fail fast instead of hanging until timeout.

## User or system context

### What this work item is about (plain language)

The browser Desktop Agent talks to the WCP connector through a **pair of in-memory pipes** (`createInMemoryTransportPair()`). When app code calls `transport.send(dacpMessage)`, it expects the message to be delivered to the other side’s `onMessage` handler.

**Today, `send()` can return while the message is never delivered**, because delivery is deferred:

```text
Caller: transport.send(msg)
  → send() checks connected / peer (sync) ✓
  → send() schedules setTimeout(0) and RETURNS immediately
  → (later) setTimeout runs:
        - structuredClone(msg) may THROW → only consoleLogger.error
        - peer handler may reject → only consoleLogger.error
```

The DACP layer has already moved on (e.g. waiting for a response with `withDACPTimeout`). No response ever arrives → **hang until DACP timeout** — hard to debug because `send()` appeared to succeed.

This is **not** about logging redaction or disconnect cleanup (other work items). It is specifically about **delivery guarantees** for the default in-browser transport.

### Where it shows up

- `createBrowserDesktopAgent()` → in-memory pair between Desktop Agent and connector
- Any DACP handler that `transport.send()`s a request/response/event and assumes delivery (intents, context broadcast, heartbeat, WCP responses, etc.)

### Current code (v3-pre)

`packages/sail-desktop-agent/src/transports/in-memory-transport.ts` — `send()` uses `setTimeout(..., 0)`; clone/handler errors are caught and logged only (lines ~78–89).

`Transport.send` is typed `void` (not `Promise<void>`), so callers do not `await` delivery today.

## Reference docs

- `plans/project-docs.md`
- `plans/prd-transport-platform-hardening.md`
- `.cursor/issues-discovered.md` (InMemoryTransport section)

## Parent context

Transport hardening PRD: make the default browser path trustworthy for FDC3 control-plane messages. Pairs with `fix-in-memory-transport-half-open-disconnect` (lifecycle) and optional lifecycle tests — this item is **delivery / error surfacing** only.

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

**A — Uncloneable message (fail fast, synchronous)**

Given a connected in-memory pair
When `transportA.send(message)` is called with a payload `structuredClone` cannot copy (e.g. circular reference, function property)
Then `send()` **throws before returning** (or rejects if API changes to async — see blocked decisions)
And the peer’s `onMessage` is **never** invoked
And no “success” is implied to the caller

**B — Peer handler throws or rejects (delivery failure visible)**

Given the peer’s `onMessage` handler throws synchronously or returns a rejected Promise
When `transportA.send(validMessage)` runs delivery
Then the failure is **observable to the sender** — not only `consoleLogger.error`
And the chosen mechanism is documented on `Transport` / `InMemoryTransport` (see blocked decisions: void + throw vs. Promise vs. optional `onSendError` callback)

**C — Happy path unchanged**

Given a cloneable message and a peer handler that completes successfully
When `send()` is called
Then the peer receives a **deep copy** (no shared references)
And timing remains async (`setTimeout(0)`) unless blocked decision chooses sync clone-before-schedule

**D — Already-handled sync errors (unchanged)**

Given transport disconnected or peer disconnected
When `send()` is called
Then existing synchronous `throw new Error("Cannot send message: ...")` behavior remains

### Example scenarios

| Scenario | Today | After this item |
|----------|--------|-----------------|
| App sends DACP request over in-memory pair | `send()` returns; clone fails in timer → log only | Caller gets throw (or documented error path); DACP can fail request immediately |
| Peer handler throws on broadcast | Log only; source may think event was sent | Sender notified per spec B |
| Normal intent raise/response | Works | Still works (spec C) |

## Out of scope

- Queuing, batching, or backpressure.
- MessagePort / Socket.IO send semantics (only `InMemoryTransport` + documenting contract if `Transport` type changes).
- Changing DACP timeout values.

## TypeScript interfaces

- **`Transport.send`**: today `void`. Delivery work item must either (1) keep `void` and throw synchronously for spec A; document that async handler failures use an agreed pattern for spec B, or (2) propose `send(message): void | Promise<void>` with migration note — **decide at implementation** per blocked decisions.
- Add TSDoc on `InMemoryTransport.send` describing delivery vs. acceptance semantics (when throw happens, async delivery caveats).

## Test guidance

RED in `in-memory-transport.test.ts`:

1. Circular reference object → `expect(() => transport.send(obj)).toThrow()` (or await rejection if API becomes async).
2. Peer handler `() => { throw new Error("handler failed") }` → assert sender-visible failure per chosen spec B mechanism.
3. Happy path: peer receives clone, references not shared.

Optional integration: DACP test that would previously timeout now fails fast — only if cheap; unit tests are minimum bar.

## Blocked decisions

1. **Clone timing:** clone **before** `setTimeout` (fail sync, easy with `void` send) vs. clone inside timer (needs async error channel).
2. **Handler rejection with `void` send:** options — (a) optional `onDeliveryError` on transport config, (b) extend `Transport.send` to `Promise<void>` for in-memory only with overload, (c) document in-memory as best-effort for async handler errors only fix clone path in v1.
3. **Default recommendation for v1:** spec A synchronous throw is required; spec B at minimum log + invoke optional error callback if added without breaking `Transport` implementers.

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (78cc9afe #24; fix(sail-desktop-agent): observable InMemoryTransport send failures)

- 2026-05-27: revised per human — expand plain-language explanation, examples, and delivery vs. acceptance semantics
- 2026-05-27: approved by human

## Staged for review

## Escalation notes

## Learnings extracted
