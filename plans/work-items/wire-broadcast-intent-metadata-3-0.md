---
title: "Wire broadcast and intent raise optional metadata (FDC3 3.0)"
slug: wire-broadcast-intent-metadata-3-0
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/context-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/
  - packages/sail-desktop-agent/src/core/dacp/dacp-message-creators.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/
depends_on:
  - audit-fdc3-3-0-handler-delta
  - add-fdc3-3-0-local-types-and-dep-upgrade
integration_branch: v3-pre
branch: cursor/wire-broadcast-intent-metadata-3-0-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Complete optional `ContextMetadata` passthrough on broadcast and intent-raise DACP paths so listeners and intent targets receive app-provided metadata alongside DA-generated fields.

## User or system context

Intent **result** metadata path exists (`intent-result-metadata.ts`). Gaps remain on inbound broadcast metadata and raiseIntent wire fields. v5 toolbox had contextMetadata and getResultMetadata clusters — this task covers agent-side broadcast/raise ingress; result path may need verification only.

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md` (F30-04)
- `packages/sail-desktop-agent/src/core/handlers/dacp/context-handlers.ts`
- `packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-shared.ts`
- `intent-context-metadata-on-raise.test.ts`

## Parent context

Child of `epic-fdc3-3-0-dual-version`. Reuse `buildContextMetadataFromOriginatingApp` and `cloneIntentResultContextMetadata` patterns; avoid shared object refs on MessagePort `structuredClone`.

## Behavior spec

Scenario: Broadcast with app metadata
  Given apps subscribed on a user channel
  When app A broadcasts context with optional ContextMetadata
  Then subscribers receive contextEvent with payload.metadata including source, timestamp, and app-provided fields

Scenario: RaiseIntent forwards metadata to intentEvent
  Given a target app listening for intent I
  When caller raises intent with context and metadata
  Then intentEvent payload.metadata includes merged DA and app fields

Scenario: 2.2 broadcast without metadata
  Given broadcastRequest without metadata
  When event is delivered
  Then behavior matches existing `@conformance2.2` channel scenarios

Scenario: MessagePort clone safety
  Given metadata on broadcast or intent result response
  When message crosses InMemoryTransport or MessagePort
  Then no DataCloneError from circular shared refs

## Out of scope

- `getCurrentContextWithMetadata` / `clearContext` (separate task)
- Toolbox harness session teardown
- `@experimental` anti-replay enforcement

## TypeScript interfaces

Optional metadata on broadcast and raiseIntent request payloads per local 3.0 types.

## Test guidance

RED: extend Vitest tables in `dacp/__tests__/` mirroring `intent-context-metadata-on-raise.test.ts` for broadcast; verify raiseIntent ingress. Run targeted `npm test -w @finos/sail-desktop-agent` on changed paths.

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
