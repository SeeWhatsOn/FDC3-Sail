---
title: "Harness headless open-with-context regression tests"
slug: harness-open-with-context-regression-tests
kind: task
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-conformance-harness/src/__tests__/harness-open-with-context.harness.ts
  - packages/sail-conformance-harness/src/harness-open-with-context.test.ts
  - packages/sail-conformance-harness/src/__tests__/harness-instance-correlation.harness.ts
depends_on:
  - wcp-first-connect-open-with-context-integration
integration_branch: v3-pre
branch: cursor/harness-open-with-context-regression-tests-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Add conformance-harness Vitest coverage for **open-with-context** through real harness `AppLauncher` + `prepareLaunchedHostInstance` wiring and realistic WCP4 — catching launcher/registry bugs that agent-only integration tests miss.

## User or system context

`instance-identity-correlation.test.ts` proves launcher id ↔ WCP5 correlation for **plain open** using `DacpTestAppConnection`. Toolbox failures involve harness `createHarnessBootstrap()`, popup `window.name`, and open **with** context. RT-04 closes the harness-layer gap documented as partial in `conformance.md`.

## Reference docs

- `plans/prd-conformance-regression-test-net.md` (RT-04)
- `packages/sail-conformance-harness/src/__tests__/harness-instance-correlation.harness.ts`
- `packages/sail-conformance-harness/src/instance-identity-correlation.test.ts`
- `packages/sail-conformance-harness/src/harness-bootstrap.ts`
- `packages/sail-conformance-harness/conformance-appd.json` (`MockAppId`)

## Parent context

Child of `epic-conformance-regression-test-net`. Depends on RT-02 agent behavior being correct; this item validates harness composition. Can deliver in parallel with RT-03.

## Behavior spec

Given `createHarnessBootstrap()` (or equivalent test harness factory) with `DacpTestAppConnection` / jsdom popup stubs
When Conformance1 analogue sends `openRequest` with `fdc3.instrument` context to `MockAppId`
And harness launcher assigns instance id `L` and pre-registers pending host instance
And mock app B completes WCP4 without `instanceUuid` (first connect)
And B adds matching context listener on adopted id
Then source receives successful `openResponse`
And target receives context broadcast

Given WCP5 canonical id differs from initial launcher registry key only before `onAppConnected` remap
When open-with-context completes
Then pending and listener share the same canonical id (no 20s hang signature in test wait)

## Out of scope

- Full FINOS toolbox Mocha pack
- Real `BrowserAppConnection` MessagePort in jsdom (use existing harness test doubles unless spike proves feasible)
- MetadataApp scenarios (RT-08)

## TypeScript interfaces

Reuse harness types from `harness-instance-correlation.harness.ts`; extend with open-with-context DACP message builders.

## Test guidance

**Pattern:** Mirror `instance-identity-correlation.test.ts` — harness module under `src/__tests__/`, thin `*.test.ts` importer.

**RED cases:**
1. Happy path open-with-context + first-connect WCP4
2. Assert `openResponse` + `broadcastEvent` within `vi.waitFor`

Run:

```bash
npm test -w @finos/sail-conformance-harness
```

Keep harness package tests fast; no wall-clock sleeps.

## Blocked decisions

_(empty — if `BrowserAppConnection` jsdom test is too heavy, document headless `DacpTestAppConnection` limit in test file header)_

## Loop history

- 2026-06-22: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
