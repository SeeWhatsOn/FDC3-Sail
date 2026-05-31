---
title: "Investigate and prune WCP instance identity registry entries"
slug: wcp-identity-registry-pruning
kind: spike
type: bug
status: pr_awaiting
branch: cursor/wcp-identity-registry-pruning-f2c8
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/42
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/wcp-handlers.ts
  - packages/sail-desktop-agent/src/core/__tests__/desktop-agent-wcp-routing.test.ts
depends_on:
  - extend-cleanup-source-and-open-with-context
integration_branch: ""
branch: fix/wcp-identity-registry-pruning
external_tracker: ""
tags: [fdc3]
---

## Goal

**Investigate first**, then prune if needed: `instanceIdentityRegistry` inner maps use `identityMap.set` but no `identityMap.delete` in `wcp-handlers.ts` today.

## User or system context

Compliance review lists this as optional cleanup. Outer registry is `WeakMap<Transport, Map<string, InstanceIdentityRecord>>` — not the same as an unbounded global leak. Confirm with tests or profiling on long-lived transports before treating as P1 bug.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 5)

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

**Phase 1 — investigate**

Given failed WCP4, handshake timeout, or `cleanupDACPHandlers` for an instance
When cleanup completes
Then document whether `identityMap` still holds that `instanceId`

**Phase 2 — fix (only if investigation confirms leak)**

Delete identity entries on the same paths that remove the instance from agent state.

## Out of scope

- Production identity map changes before Phase 1 investigation confirms a leak.

## TypeScript interfaces

none

## Test guidance

Add a focused unit test that simulates failed handshake / disconnect and asserts inner map size or key absence. Downgrade work item if WeakMap + transport lifecycle makes retention acceptable.

## Blocked decisions

Severity after investigation — may close as no-op or optional cleanup.

## Loop history

- 2026-05-27: approved by human (validation gaps waived)
<<<<<<< HEAD
- 2026-05-29: Phase 1 — confirmed inner `Map` retained entries after disconnect/heartbeat/WCP6 cleanup; failed WCP4 paths never set entries. Outer `WeakMap` bounds lifetime to transport. Phase 2 — added `pruneInstanceIdentity` on `cleanupDACPHandlers` paths; 7 focused Vitest cases in `wcp-identity-registry.test.ts`.
=======
- 2026-05-29: auto-deliver — pruneInstanceIdentity on cleanup; branch pushed
- 2026-05-29: human approve all — PR #42
>>>>>>> origin/v3-pre
