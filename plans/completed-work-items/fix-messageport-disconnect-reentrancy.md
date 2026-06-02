---
title: "Prevent duplicate appDisconnected on MessagePort disconnect"
slug: fix-messageport-disconnect-reentrancy
merged_pr: "v3-pre@cffc8174 #25"
type: bug
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/browser/wcp/message-port-transport.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-connection-management.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-message-routing.ts
  - packages/sail-desktop-agent/src/browser/__tests__/message-port-transport.test.ts
  - packages/sail-desktop-agent/src/browser/__tests__/wcp-connector.test.ts
depends_on: []
integration_branch: ""
branch: fix/messageport-disconnect-reentrancy
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/25
external_tracker: ""
tags: [fdc3]
---

## Goal

Stop WCP from emitting duplicate `appDisconnected` events when owner-initiated disposal re-enters `disconnectApp()` via the transport disconnect handler.

## User or system context

`MessagePortTransport.disconnect()` invokes `disconnectHandler` synchronously while `disconnectApp()` has not yet removed map entries. Paths: `connector.stop()`, WCP6 goodbye timeout, handshake timeout, `disconnectAppByInstanceId()`.

## Reference docs

- `plans/project-docs.md`
- `.cursor/issues-discovered.md` (MessagePortTransport section)

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

Given a connected WCP app instance
When `disconnectApp(instanceId)` runs from an owner-initiated path
Then `appDisconnected` (or equivalent listener) fires exactly once for that instance

Given `MessagePortTransport.disconnect()` is invoked as part of `disconnectApp`
When the disconnect handler calls back into WCP cleanup
Then maps and handlers do not cause a second disconnect notification for the same instance

## Out of scope

- Port close on error path (separate work item).
- Bound listener identity fix (separate work item).

## TypeScript interfaces

Optional internal flag or `disconnect({ notify: false })` on transport — keep public API minimal; document if added.

## Test guidance

RED: update WCP connector tests to assert `toHaveBeenCalledTimes(1)` on disconnect listeners, not only `toHaveBeenCalledWith`.

## Blocked decisions

- Preferred fix: delete reverse lookup before `appTransport.disconnect()` vs. non-notifying dispose path — implementer picks smallest correct diff.

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (cffc8174 #25; fix(sail-desktop-agent): prevent duplicate appDisconnected on MessagePort disconnect)

- 2026-05-27: approved by human (validation gaps waived)

## Staged for review

## Escalation notes

## Learnings extracted
