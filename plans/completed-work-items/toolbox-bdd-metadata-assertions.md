---
title: "BDD assertions for toolbox-checked AppMetadata and intent displayName"
slug: toolbox-bdd-metadata-assertions
kind: task
type: enhancement
status: done
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/test/features/apps/apps.feature
  - packages/sail-desktop-agent/test/features/intents/find-intent.feature
  - packages/sail-desktop-agent/test/step-definitions/
depends_on:
  - fix-app-metadata-desktop-agent-field
  - fix-intent-discovery-displayname-dedupe
integration_branch: v3-pre
branch: cursor/toolbox-bdd-metadata-assertions
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/52
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Extend Cucumber so MockTransport BDD catches toolbox failures for desktopAgent and directory displayName before manual harness runs.

## User or system context

Green BDD today does not assert fields the FINOS toolbox checks. This closes the gap between MockTransport coverage and conformance-appd.json semantics.

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md` (TB-06)
- `packages/sail-desktop-agent/docs/conformance-traceability.md`

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Depends on agent fixes TB-01/TB-02; adds regression net for metadata and intent discovery shape.

## Behavior spec

Given the agent serves app metadata from the directory
When getAppMetadata is requested for a non-running app
Then the DACP response appMetadata includes desktopAgent matching the test agent provider

Given a test app directory entry with explicit intent displayName distinct from intent name
When findIntent is requested for that intent
Then the response intent.displayName matches the directory displayName

## Out of scope

- Full conformance-appd.json import into all scenarios
- WCP browser path

## TypeScript interfaces

none

## Test guidance

May land in same PR as TB-01/TB-02 or immediately after. Tag new scenarios `@conformance2.2` where they map to pack areas.

## Blocked decisions

_(empty)_

## Loop history

- 2026-05-31: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
- 2026-06-01: reconcile — PR merged (batch 1)
