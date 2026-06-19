---
title: "Fix toolbox metadata on client API and harness DACP paths"
slug: fix-toolbox-metadata-client-and-dacp-paths
kind: task
type: bug
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/
  - packages/sail-desktop-agent/src/core/handlers/dacp/app-handlers.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-result-metadata.ts
  - packages/sail-desktop-agent/test/features/intents/intent-result.feature
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/__tests__/
depends_on:
  - populate-intent-result-metadata-toolbox
integration_branch: v3-pre
branch: cursor/fix-toolbox-metadata-client-and-dacp-paths
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Make FINOS toolbox metadata assertions pass for intent results (`getResultMetadata`), app directory metadata (`desktopAgent`), and raised-intent context metadata (app-provided traceId / antiReplay) on the real WCP harness path — not only on MockTransport / DACP wire tests.

## User or system context

v5 shows **4/4** `raiseIntent (Result)` metadata scenarios fail with `expected '' to not equal ''` while void/context/channel **delivery** passes. `populate-intent-result-metadata-toolbox` added `metadata` to `raiseIntentResultResponse` on the wire (Vitest + Cucumber green); the conformance app’s **`IntentResolution.getResultMetadata()`** still returns empty. Separately, **2** `getAppMetadata` rows still miss `desktopAgent` despite merged TB-01 and green Vitest — likely harness DACP response shape or directory-only path. **1** `IntentContextMetadataWithAppMetadata` row expects app traceId `intent-trace-456` but receives a DA-generated UUID.

## Reference docs

- `conformance-test-failure-review.md` (§TB-09, TV4-07 v5)
- `conformance-report-v5.txt` (Result metadata, getAppMetadata, intentContextMetadata)
- `plans/work-items/populate-intent-result-metadata-toolbox.md`
- `plans/completed-work-items/fix-app-metadata-desktop-agent-field.md`
- FDC3 2.2 IntentResult / ContextMetadata / AppMetadata APIs

## Parent context

Child of `epic-toolbox-conformance-v5-follow-up`. Completes TV4-03 for toolbox acceptance. Wire payload work stays in `populate-intent-result-metadata-toolbox`; this item owns **client-visible metadata** and **harness-path DACP gaps**. Deliver before or in parallel with harness teardown — independent agent surface.

## Behavior spec

### Intent result metadata (TV4-03 completion)

Given app B resolves a raised intent with a context, channel, or void result
When app A’s `IntentResolution.getResult()` succeeds
Then `getResultMetadata()` returns a non-empty object
And includes DA-generated `source`, `timestamp`, and `traceId` per toolbox oracle

Given app B returns `ContextWithMetadata` (context + app metadata fields)
When app A calls `getResult()` and `getResultMetadata()`
Then `getResult()` returns plain context without embedded app metadata on the wire shape the toolbox checks
And `getResultMetadata()` merges DA fields with app-provided `signature` / `custom` per toolbox oracle

### AppMetadata desktopAgent (harness path)

Given a connected conformance app requests `getAppMetadata` for a directory app
When the response is returned over WCP/MessagePort
Then `AppMetadata.desktopAgent` equals `implementationMetadata.provider`
And the same holds for `AppInstanceMetadata` on a running instance row

### Intent context metadata on raise

Given app A raises an intent with context carrying app-provided metadata (traceId, signature, antiReplay, custom)
When app B receives the intent event
Then `ContextMetadata` on the raised context includes the app-provided traceId (not replaced by a fresh DA UUID unless spec requires DA generation for that field)
And signature / custom / antiReplay forward per toolbox `IntentContextMetadataWithAppMetadata` oracle

## Out of scope

- Harness close-context teardown (sibling item)
- findIntent dedupe / NoAppsFound (blocked)
- sail-web metadata paths
- Documentation-only changes

## TypeScript interfaces

Trace and extend existing `IntentResult`, `ContextMetadata`, `AppMetadata` shapes from `@finos/fdc3` and DACP response payloads. Document any gap between wire `raiseIntentResultResponse.payload.metadata` and what the FDC3 client proxy exposes to `getResultMetadata()`.

## Test guidance

RED: Vitest reproducing the client metadata path (not only handler wire send) — table cases mirroring v5 scenario names: `RaiseIntentVoidResultMetadata`, `RaiseIntentContextResultMetadata`, `RaiseIntentContextWithMetadataResult`, `RaiseIntentChannelResultMetadata`.

Extend Cucumber `intent-result.feature` only if wire assertions insufficient to catch client regression.

Vitest for `getAppMetadata` harness-equivalent path if a minimal reproduction exists without full browser.

Intent context metadata: Vitest or Cucumber on intent raise event payload when context includes app metadata fields.

Targeted run:

```bash
npm test -w @finos/sail-desktop-agent -- intent-result-metadata intent-result-handlers app-metadata
npx cucumber-js --profile single test/features/intents/intent-result.feature
```

Manual: harness :3001 Result metadata + getAppMetadata slice after fix.

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
