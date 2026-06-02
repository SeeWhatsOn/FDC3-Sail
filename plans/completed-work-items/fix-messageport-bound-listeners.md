---
title: "Fix MessagePortTransport listener removal"
slug: fix-messageport-bound-listeners
merged_pr: "v3-pre@417eae09 #23"
type: bug
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts
  - packages/sail-desktop-agent/src/browser/__tests__/message-port-transport.test.ts
depends_on: []
integration_branch: ""
branch: fix/messageport-bound-listeners
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/23
external_tracker: ""
tags: [fdc3]
---

## Goal

Store stable bound handler references so `removeEventListener` actually detaches `message` and `messageerror` listeners, reducing retention under iframe churn.

## User or system context

Listeners are added and removed with fresh `.bind(this)` calls, so identities never match. `port.close()` mitigates delivery but closures can linger while `recentDisconnected` holds port references.

## Reference docs

- `plans/project-docs.md`
- Pattern reference: `WCPConnector.boundHandleWindowMessage`

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

Given a MessagePortTransport with listeners attached
When `disconnect()` or centralized cleanup runs
Then `removeEventListener` is called with the same function references used in `addEventListener`

Given disconnect after messages were received
When inspecting the port (test spy)
Then no `message` or `messageerror` handlers remain attached before GC

## Out of scope

- Reentrancy and error close logic (sibling work items; integrate without conflict).

## TypeScript interfaces

```typescript
// Illustrative — match project style
private readonly boundHandleMessage = ...
private readonly boundHandleError = ...
```

## Test guidance

RED: spy `addEventListener` / `removeEventListener` and assert referential equality of handler arguments.

## Blocked decisions

(none)

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (417eae09 #23; fix(sail-desktop-agent): stable MessagePortTransport listener removal)

- 2026-05-27: approved by human (validation gaps waived)

## Staged for review

## Escalation notes

## Learnings extracted
