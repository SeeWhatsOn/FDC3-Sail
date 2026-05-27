---
title: "Make InMemoryTransport send failures observable"
slug: fix-in-memory-transport-send-failures
type: bug
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/transports/in-memory-transport.ts
  - packages/sail-desktop-agent/src/transports/__tests__/in-memory-transport.test.ts
depends_on: []
integration_branch: ""
branch: fix/in-memory-transport-send-failures
external_tracker: ""
tags: [fdc3]
---

## Goal

Prevent DACP request/response flows from hanging on silent drops when `structuredClone` or peer delivery fails after `send()` already returned success.

## User or system context

`InMemoryTransport.send()` defers clone/delivery via `setTimeout`. Failures are only logged; callers believe the message was accepted. This surfaces as timeouts in DACP flows.

## Reference docs

- `plans/project-docs.md`
- `plans/prd-transport-platform-hardening.md`

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

Given a connected in-memory transport
When `send()` is called with a payload that cannot be `structuredClone`d
Then the caller receives a synchronous failure (rejected promise or thrown error per existing Transport contract — match peer transports)

Given a connected peer whose message handler rejects or throws
When `send()` delivers the message
Then the sender is notified of failure (not silent log-only drop) unless product explicitly documents best-effort sends

Given successful clone and delivery
When `send()` completes
Then behavior matches current happy path (peer receives a deep copy)

## Out of scope

- Queuing, batching, or backpressure for bursty traffic.
- MessagePort transport send semantics.

## TypeScript interfaces

Align with existing `Transport.send` return type in `packages/sail-desktop-agent/src/transports/` — document any intentional best-effort exception in transport README if chosen.

## Test guidance

RED: tests for uncloneable payload (e.g. object with circular ref) and rejecting peer handler; assert caller-visible failure, not only log side effects.

## Blocked decisions

- Choose synchronous clone-before-enqueue vs. async with explicit failure callback — prefer synchronous clone if it matches FDC3 control-plane message sizes.

## Loop history

## Staged for review

## Escalation notes

## Learnings extracted
