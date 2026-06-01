---
title: "BDD coverage for ContextMetadata on broadcast and intent"
slug: context-metadata-conformance-bdd
kind: task
type: enhancement
status: done
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/test/features/context/broadcast.feature
  - packages/sail-desktop-agent/test/features/intents/raise-intent.feature
  - packages/sail-desktop-agent/docs/conformance-traceability.md
depends_on: []
integration_branch: v3-pre
branch: cursor/context-metadata-conformance-bdd
pr_url: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/50"
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Add @conformance2.2 scenarios for ContextMetadata (source + timestamp) matching toolbox fdc3.contextMetadata and fdc3.intentContextMetadata areas.

## User or system context

Traceability map has no ContextMetadata row; broadcast.feature asserts originatingApp only. Toolbox UCContextMetadataOnBroadcast and IntentContextMetadata fail with AppTimeout (integration) but BDD should cover DACP metadata shape on MockTransport.

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md` (TB-07)
- `packages/sail-desktop-agent/docs/conformance-traceability.md`

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Closes BDD gap for metadata shape; update traceability map row from missing/partial to covered.

## Behavior spec

Given App2 listens on a user channel
When App1 broadcasts context on that channel
Then App2 receives broadcastEvent context with metadata including source and timestamp

Given an intent is raised and delivered to a handler
When the handler receives the intent context
Then context metadata includes source and timestamp

## Out of scope

- Toolbox UI automation
- Changing metadata schema beyond FDC3 2.2

## TypeScript interfaces

none

## Test guidance

Extend broadcast.feature and/or raise-intent.feature; tag @conformance2.2. Update conformance-traceability.md in same PR.

## Blocked decisions

Resolved for BDD: `@finos/fdc3-standard` `ContextMetadata` defines `source` (`AppIdentifier` with `appId` / `instanceId`). No `timestamp` on that interface in 2.2.0 — toolbox expects timestamp on listener metadata; DACP events already carry `meta.timestamp` (ISO string). GREEN should add `payload.metadata` with `source` + `timestamp` for MockTransport assertions (or document mapping from `originatingApp` + `meta.timestamp`).

## Loop history

- 2026-05-31: approved by human
- 2026-06-01: RED — two `@conformance2.2` scenarios added; both fail (no `payload.metadata`)

## Staged for review

RED Cucumber scenarios committed on `cursor/context-metadata-conformance-bdd`. Run:

```bash
npx cucumber-js test/features/context/broadcast.feature --name "Broadcast Event Includes ContextMetadata With Source And Timestamp"
npx cucumber-js test/features/intents/raise-intent.feature --name "Intent Event Includes ContextMetadata With Source And Timestamp"
```

Failure: `broadcastEvent` / `intentEvent` payloads have `originatingApp` only; `msg.payload.metadata` is absent.

## Escalation notes

_(empty)_

## Learnings extracted

- FDC3 2.2 `ContextMetadata` (`@finos/fdc3-standard`) has only `source`; DACP wire schema uses `originatingApp` on event payloads, not `metadata`.
- Event `meta.timestamp` is already populated (ISO string); conformance toolbox also expects timestamp on listener `ContextMetadata` — GREEN must align payload shape for BDD.
- Timestamp assertion uses literal `ISO8601-timestamp-required` until GREEN adds `{isoTimestamp}` resolver or copies `meta.timestamp` into `payload.metadata.timestamp`.
- 2026-06-01: reconcile — PR merged (batch 2)
