---
title: "Prune stale WCP instance identity registry entries"
slug: wcp-identity-registry-pruning
type: bug
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/__tests__/desktop-agent-wcp-routing.test.ts
depends_on:
  - extend-cleanup-source-and-open-with-context
integration_branch: ""
branch: fix/wcp-identity-registry-pruning
external_tracker: ""
tags: [fdc3, wcp]
---

## Goal

Ensure `instanceIdentityRegistry` (WeakMap per transport) does not retain stale identity records after failed WCP4, handshake timeout, or disconnect.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 5)
- `FDC3_2_2_COMPLIANCE_REVIEW.MD` (optional cleanup)

## Behavior spec

Given failed WCP4 or handshake timeout cleanup
When instance will not reconnect
Then identity map has no entry for that instanceId

## Test guidance

Unit test in `desktop-agent-wcp-routing.test.ts` or dedicated wcp-handlers test.

## Blocked decisions

(none)
