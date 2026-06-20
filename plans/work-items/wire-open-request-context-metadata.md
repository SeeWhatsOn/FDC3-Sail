---
title: "Wire openRequest optional ContextMetadata (FDC3 3.0)"
slug: wire-open-request-context-metadata
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/utils/open-with-context.ts
  - packages/sail-desktop-agent/src/core/dacp/dacp-message-creators.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/
depends_on:
  - audit-fdc3-3-0-handler-delta
  - add-fdc3-3-0-local-types-and-dep-upgrade
integration_branch: v3-pre
branch: cursor/wire-open-request-context-metadata-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Accept optional `payload.metadata` on DACP `openRequest` and deliver it with open-with-context broadcasts so 3.0 apps receive `ContextMetadata` without breaking 2.2 opens that omit metadata.

## User or system context

`handleOpenRequest` today reads `payload.context` only. FDC3 3.0 allows `open(app, context, metadata)` and `open(app, null, metadata)`. Required for metadata-on-open conformance and distinct from GetInfo2 (2.2 open-with-context integration).

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md` (F30-03)
- `packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts`
- `packages/sail-desktop-agent/src/core/handlers/dacp/utils/open-with-context.ts`
- `intent-result-metadata.ts` (metadata merge patterns)

## Parent context

Child of `epic-fdc3-3-0-dual-version`. Wire-forward: missing metadata behaves as today. Uses `resolveDacpHandlerInstanceId` and existing pending open-with-context flow.

## Behavior spec

Scenario: Open with context and metadata
  Given app B is connected and listening for context type T
  When app A sends openRequest with context and caller ContextMetadata
  Then app B's context listener receives an event whose payload includes metadata with source and timestamp

Scenario: Open without context but with metadata
  Given FDC3 3.0 open(app, null, metadata) on the wire
  When openRequest has metadata and no context
  Then openResponse succeeds and metadata is available per spec (broadcast or stored per audit)

Scenario: 2.2 open unchanged
  Given openRequest with context only and no metadata field
  When the handler processes the request
  Then delivery matches existing `@conformance2.2` open-with-context behavior

Scenario: Invalid metadata shape
  Given openRequest with malformed metadata
  When validation runs
  Then agent responds with appropriate OpenError without crashing

## Out of scope

- Harness GetInfo2 / MetadataApp popup debugging (v5 2.2 track)
- `fdc3Version` bump to `"3.0"`
- Security signature verification on metadata

## TypeScript interfaces

Optional `metadata` on extended `OpenRequest` payload; align with local types from `add-fdc3-3-0-local-types-and-dep-upgrade`.

## Test guidance

RED: Vitest in `dacp/__tests__/` for open-with-context + metadata delivery via MockTransport; optional `@conformance3.0` Cucumber scenario in follow-up `expand-conformance3-0-bdd-coverage`. Assert toolbox-relevant fields on delivered contextEvent metadata.

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
