---
title: "WCP1Hello origin allowlist before handshake"
slug: wcp1-hello-origin-allowlist
type: enhancement
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/browser/wcp/wcp-connector.ts
  - packages/sail-desktop-agent/src/browser/wcp/wcp-types.ts
  - packages/sail-desktop-agent/src/browser/__tests__/wcp-connector.test.ts
  - packages/sail-platform-api/src/sail-browser-desktop-agent.ts
depends_on: []
integration_branch: ""
branch: feature/wcp-origin-allowlist
external_tracker: ""
tags: [fdc3, security, wcp]
---

## Goal

Reject or ignore `WCP1Hello` from origins not on a host-supplied allowlist before creating MessageChannel and temp connections.

## User or system context

Today any origin can start handshake; WCP4 blocks DACP but handshake window allows resource exhaustion.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 4)

## Behavior spec

Given `allowedOrigins: ["https://trusted.example.com"]`
When `postMessage` WCP1Hello from another origin
Then no channel created, optional `handshakeFailed` event, no temp instance in maps

Given empty allowlist / undefined
When configured as permissive mode for dev
Then document default: allow all (current behavior) vs. deny all — pick one for production composition in `sail-platform-api`

## Out of scope

- Replacing WCP4 identityUrl / MessageEvent.origin checks.

## Test guidance

Vitest on `WCPConnector` with spy on `MessageChannel` constructor.

## Blocked decisions

Allowlist on `WCPConnectorOptions` vs. platform-only wrapper.
