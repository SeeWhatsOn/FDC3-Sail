---
title: "Extend cleanupDACPHandlers for source pending intents and open-with-context"
slug: extend-cleanup-source-and-open-with-context
merged_pr: "v3-pre@b835210f #28"
kind: task
type: bug
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/open-with-context.ts
  - packages/sail-desktop-agent/src/core/desktop-agent.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/cleanup.test.ts
  - packages/sail-desktop-agent/test/features/apps/disconnect-cleanup-p0.feature
depends_on: []
integration_branch: ""
branch: fix/cleanup-source-and-open-with-context
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/28
external_tracker: ""
tags: [fdc3]
---

## Goal

Finish disconnect cleanup for pending intents and open-with-context. **Items 1–2 are implemented on `v3-pre`** (Vitest green in `cleanup.test.ts`). Remaining: optional source-side open-with-context cancel.

## User or system context

**Done on v3-pre:**
- Pending intents cleared when disconnecting instance is source or target.
- `open.pendingWithContext[targetInstanceId]` and module timeouts cleared when **target** disconnects.

**Optional gap (not unbounded memory):** pending opens are keyed by target; if the **source** disconnects first, entries remain until `openContextListenerTimeoutMs` (default 15s) fires. Timeout self-heals state; may attempt error response to a gone source. Promote to required only if product wants immediate cancel.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (items 1–2)
- `packages/sail-desktop-agent/src/core/handlers/dacp/cleanup.ts`

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

**Done — source pending intent**

Given `intents.pending[requestId]` with `sourceInstanceId === instanceId` being cleaned up
When `cleanupDACPHandlers` runs
Then that pending entry is removed, `pendingIntentPromises` entry cleared, timeouts cleared, `reject` called if a promise entry exists

**Done — open-with-context target**

Given `open.pendingWithContext[targetInstanceId]` has entries
When `cleanupDACPHandlers` runs for `instanceId === targetInstanceId`
Then that bucket is empty and `pendingOpenWithContextTimeouts` has no handles for those `requestUuid` values

**Optional — open-with-context source**

Given pending open entries where `sourceInstanceId === instanceId`
When source disconnects
Then pending removed, timeouts cleared, and no error sent to disconnected source (add Vitest + Cucumber before implementing)

## Out of scope

- Re-implementing heartbeat cleanup (already calls `cleanupDACPHandlers`).
- Changing `openContextListenerTimeoutMs` default (15s minimum per FDC3).

## TypeScript interfaces

none

## Test guidance

If implementing optional source cancel: RED Vitest in `cleanup.test.ts` first, then implement scan of all `pendingWithContext` buckets by `sourceInstanceId`.

## Blocked decisions

Whether source-side open-with-context cancel is required for v3 or deferred (recommend defer — 15s TTL bounds memory).

## Loop history

- 2026-05-29: /ww-reconcile — shipped on v3-pre (b835210f #28; fix(sail-desktop-agent): clear open-with-context pending when source disconnects)

- 2026-05-27: items 1–2 verified implemented on v3-pre; item 3 remains optional
- 2026-05-27: approved by human
