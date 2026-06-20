---
title: "Populate getResultMetadata for toolbox intent results"
slug: populate-intent-result-metadata-toolbox
kind: task
type: bug
status: in-progress
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/
  - packages/sail-desktop-agent/test/features/intents/intent-result.feature
depends_on: []
integration_branch: v3-pre
branch: cursor/populate-intent-result-metadata-toolbox
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Ensure `IntentResolution.getResultMetadata()` returns non-empty DA-generated metadata for context, channel, and void results per FINOS toolbox rows that currently assert `expected '' to not equal ''`.

## User or system context

v4 fails `RaiseIntentContextWithMetadataResult` and `RaiseIntentChannelResultMetadata` on empty metadata while result resolution may succeed. MockTransport intent-result.feature may not assert toolbox-required metadata fields.

## Reference docs

- `plans/prd-toolbox-conformance-v4-follow-up.md` (TV4-03)
- FDC3 2.2 IntentResult / metadata API
- `packages/sail-desktop-agent/test/features/intents/intent-result.feature`

## Parent context

Distinct from ContextMetadata on intent **events** (TB-07 BDD). This item is **result** metadata returned to the raising app after resolve completes.

## Behavior spec

Given App B resolves a raised intent with a Context result
When App A calls getResultMetadata on the IntentResult
Then metadata is a non-empty object
And includes DA-generated fields required by the conformance toolbox for that scenario

Given App B resolves with a Channel result
When App A calls getResultMetadata
Then metadata is non-empty

Given a void intent result
When getResultMetadata is called
Then metadata is non-empty per toolbox void-metadata scenario (if applicable on harness re-run)

## Out of scope

- UserCancelledResolution / resolver UI (spike item)
- Merging handler-returned ContextWithMetadata (separate toolbox row may need follow-up)
- WCP delivery of intent events

## TypeScript interfaces

Document relevant `IntentResult` / DACP intent resolution response shapes discovered during RED; no new public API unless required by FDC3 types.

## Test guidance

RED: Vitest on intent result handler/builder path; extend Cucumber intent-result scenarios to assert `getResultMetadata()` keys non-empty using `@conformance2.2`. Use conformance-appd intent-c handlers where applicable.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

Wire metadata on `raiseIntentResultResponse` landed in this item (Vitest + Cucumber). v5 toolbox still fails `getResultMetadata()` — **client API follow-up:** `fix-toolbox-metadata-client-and-dacp-paths`. Mark this item **done** after human approve of wire-only scope, or extend into child task delivery.
