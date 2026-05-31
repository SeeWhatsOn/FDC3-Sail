---
title: "BDD coverage for ContextMetadata on broadcast and intent"
slug: context-metadata-conformance-bdd
kind: task
type: enhancement
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/test/features/context/broadcast.feature
  - packages/sail-desktop-agent/test/features/intents/raise-intent.feature
  - packages/sail-desktop-agent/docs/conformance-traceability.md
depends_on: []
integration_branch: v3-pre
branch: cursor/context-metadata-conformance-bdd
pr_url: ""
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

Exact FDC3 2.2 ContextMetadata field names — verify against @finos/fdc3 types before asserting.

## Loop history

- 2026-05-31: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
