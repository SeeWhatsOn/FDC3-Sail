---
title: "Expand @conformance3.0 Cucumber coverage"
slug: expand-conformance3-0-bdd-coverage
kind: task
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/test/features/
  - packages/sail-desktop-agent/test/step-definitions/
depends_on:
  - wire-open-request-context-metadata
  - wire-broadcast-intent-metadata-3-0
  - add-fdc3-3-0-channel-metadata-apis
integration_branch: v3-pre
branch: cursor/expand-conformance3-0-bdd-coverage-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Add `@conformance3.0` Cucumber scenarios for each landed 3.0 API so MockTransport BDD documents dual-version contracts alongside existing `@conformance2.2` pack.

## User or system context

Only `close.feature` is tagged `@conformance3.0` today (~2 scenarios). Each implementation slice needs BDD traceability before toolbox 3.0 baseline. Tags filter via `cucumber-js --tags '@conformance3.0'`.

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md` (F30-08)
- `packages/sail-desktop-agent/test/features/apps/close.feature`
- `AGENTS.md` (Cucumber tags, no test-only production APIs)

## Parent context

Child of `epic-fdc3-3-0-dual-version`. Runs after handler tasks land. Reuse production DACP paths and `createHandlerContextForWorld` / MockTransport patterns — no `*ForTesting` on DesktopAgent.

## Behavior spec

Scenario: Close scenarios remain green
  Given existing `@conformance3.0` close.feature
  When full 3.0 tag suite runs
  Then close self-close and ErrorOnClose scenarios pass

Scenario: Open metadata scenario
  Given wire-open-request-context-metadata delivered
  When new feature or scenario tagged `@conformance3.0`
  Then open-with-metadata listener delivery is asserted via messaging table

Scenario: Broadcast metadata scenario
  Given wire-broadcast-intent-metadata-3-0 delivered
  When scenario runs
  Then contextEvent metadata fields are asserted

Scenario: Channel metadata APIs scenario
  Given channel metadata handlers delivered
  When getCurrentContextWithMetadata scenario runs
  Then response payload matches spec-shaped expectations

## Out of scope

- Duplicating entire 2.2 pack under 3.0 tags
- Toolbox oracle equivalence claims (BDD is contract documentation)
- Playwright or harness E2E in this slice

## TypeScript interfaces

none

## Test guidance

RED: new `.feature` files or scenarios fail until handlers exist (may land same PR as handler tasks if coordinated). Run `npm test -w @finos/sail-desktop-agent -- --tags '@conformance3.0'`. Update `website/docs/packages/desktop-agent/conformance.md` scenario counts if doc mentions totals.

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
