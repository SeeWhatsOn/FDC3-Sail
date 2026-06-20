---
title: "Add getCurrentContextWithMetadata and clearContext handlers"
slug: add-fdc3-3-0-channel-metadata-apis
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/context-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/index.ts
  - packages/sail-desktop-agent/src/core/state/
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/
depends_on:
  - audit-fdc3-3-0-handler-delta
  - add-fdc3-3-0-local-types-and-dep-upgrade
integration_branch: v3-pre
branch: cursor/add-fdc3-3-0-channel-metadata-apis-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Implement FDC3 3.0 channel APIs `getCurrentContextWithMetadata` and `clearContext` on the DACP handler tree with user-channel and app-channel coverage per FINOS spec.

## User or system context

3.0 apps need last-broadcast context plus metadata on joined channels and explicit channel context clear. Sail stores channel context in agent state today for 2.2 `getCurrentContext`; extend to retain metadata for 3.0 reads.

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md` (F30-06)
- FINOS FDC3 3.0 channel API reference (external)
- `packages/sail-desktop-agent/src/core/handlers/dacp/context-handlers.ts`
- `user-channels-runtime-ssot` patterns in agent state

## Parent context

Child of `epic-fdc3-3-0-dual-version`. Should-have slice after metadata wire tasks. Register handlers in `dacp/index.ts` with local request/response types until `@finos/fdc3` 3.x.

## Behavior spec

Scenario: getCurrentContextWithMetadata on user channel
  Given app joined a user channel after a broadcast with metadata
  When app requests current context with metadata for that channel
  Then response includes context and metadata matching the last relevant broadcast

Scenario: clearContext on app channel
  Given app channel has stored context
  When owning app calls clearContext
  Then channel context is cleared and listeners receive appropriate events per spec

Scenario: No context on channel
  Given joined channel with no prior broadcast
  When getCurrentContextWithMetadata is requested
  Then agent returns spec-correct empty or error response

Scenario: 2.2 getCurrentContext unchanged
  Given 2.2 client using getCurrentContext without metadata API
  When request is processed
  Then existing behavior is preserved

## Out of scope

- Private channel sync hook removal audit (separate if needed)
- sail-web channel selector UI
- Storing metadata history beyond last context per channel

## TypeScript interfaces

Local DACP message types for getCurrentContextWithMetadata request/response and clearContext; wire to channel state selectors/mutators.

## Test guidance

RED: Vitest handler tests in `dacp/__tests__/`; add `@conformance3.0` scenarios via `expand-conformance3-0-bdd-coverage`. MockTransport with pre-registered instances per AGENTS.md conventions.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
