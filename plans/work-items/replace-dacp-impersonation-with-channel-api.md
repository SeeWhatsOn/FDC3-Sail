---
title: "Replace sendDACPMessageOnBehalfOf with intention-level channel API"
slug: replace-dacp-impersonation-with-channel-api
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-platform-api/src/sail-browser-desktop-agent.ts
  - packages/sail-platform-api/src/sail-platform.ts
  - packages/sail-platform-api/src/index.ts
  - packages/sail-platform-api/README.md
  - packages/sail-desktop-agent/src/browser/wcp/wcp-connector.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-message-routing.ts
  - packages/sail-desktop-agent/src/core/dacp-protocol/dacp-messages.ts
depends_on: []
integration_branch: ""
branch: feature/platform-channel-api-no-impersonation
external_tracker: ""
tags: [api, fdc3, security]
---

## Goal

Remove authority-bypass risk from raw `(instanceId, message: unknown)` DACP impersonation and expose typed, lifecycle-safe channel operations aligned with WCP validation.

## User or system context

`sail-browser-desktop-agent.ts` exposes `sendDACPMessageOnBehalfOf`, casts private `DesktopAgent.handleMessage`, and bypasses `bridgeTransports` validation/enrichment. UI or plugins could fabricate any app-originated protocol message. `SailPlatform.changeAppChannel` is the preferred direction but needs tightening.

## Reference docs

- `plans/project-docs.md`
- `plans/prd-transport-platform-hardening.md`
- `dacp-messages.ts` for `AppRequestMessage` unions

## Parent context

From `plans/prd-transport-platform-hardening.md`: Harden InMemory/MessagePort transports and replace platform DACP impersonation for reliable disconnect and authority-safe APIs.

## Behavior spec

Given a started Sail browser platform and a connected app instance
When the consumer calls `platform.channels.setAppChannel(instanceId, channelId)` or equivalent public API
Then the agent updates membership using validated app-originated request construction (metadata generated internally) and the call resolves or rejects with a clear error

Given platform not started
When any channel mutation API is invoked
Then the call rejects before mutating Desktop Agent state (`ensureStarted` semantics)

Given a need to dispatch app requests from the connector layer
When an internal or public escape hatch is required
Then it lives in `@finos/sail-desktop-agent` (e.g. `wcpConnector.dispatchAppRequest`) with type narrowing and disallowed message classes — not in platform-api as raw `unknown`

Given `sendDACPMessageOnBehalfOf` existed on the public surface
When this work ships
Then it is removed or deprecated with migration notes and call sites updated in-repo

## Out of scope

- Full `platform.channels.onChanged` event surface (follow-up unless required by in-repo call sites).
- Server/worker transport implementations beyond what existing tests cover.

## TypeScript interfaces

```typescript
// Target shape (illustrative — align with existing SailPlatform)
setAppChannel(instanceId: string, channelId: string | null): Promise<void>
// Optional future: createSelectionRequest(instanceId) — not required unless PRD call sites need it
```

Use `AppRequestMessage` / narrowed unions from `dacp-messages.ts` for any low-level dispatch in desktop-agent.

## Test guidance

RED: platform-api unit tests for started/not-started, invalid instanceId, success path; desktop-agent/WCP tests if dispatch moves to connector. Grep repo for `sendDACPMessageOnBehalfOf` and update consumers.

## Blocked decisions

- Whether a documented low-level `dispatchAppRequest` is required in v1 or only intention-level channel API suffices.
- Deprecation window if external consumers exist outside repo.

## Loop history

## Staged for review

## Escalation notes

## Learnings extracted
