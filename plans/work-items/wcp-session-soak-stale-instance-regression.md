---
title: "WCP session soak regression for stale CONNECTED instances"
slug: wcp-session-soak-stale-instance-regression
kind: task
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
depends_on:
  - wcp-multi-pending-host-identifier-adoption
integration_branch: v3-pre
branch: cursor/wcp-session-soak-stale-instance-regression-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Add one Vitest **session soak** case: leave a stale `CONNECTED` mock instance in agent state, then run a second open-with-context + first-connect WCP4 flow — asserting correct adoption/delivery and bounded `findInstances` / instance cardinality.

## User or system context

Cucumber uses a **fresh** `DesktopAgent` per scenario; toolbox runs **one long session**. Failed teardown leaves CONNECTED rows that inflate `findIntent apps.length` and break open-with-context late in the pack. RT-06 documents expected behavior when hygiene fails.

## Reference docs

- `plans/prd-conformance-regression-test-net.md` (RT-06)
- `conformance-report-v6.txt` (`findIntent` apps.length, `findInstances` id mismatch)
- RT-02 / RT-03 work items

## Parent context

Child of `epic-conformance-regression-test-net`. Deliver after RT-03; informs whether additional harness disconnect fixes are needed beyond RT-05.

## Behavior spec

Given mock app A was opened earlier and remains `CONNECTED` with id `L-stale` (disconnect not called — simulate failed teardown)
When a second open-with-context targets the same `appId` with new launcher id `L2`
And WCP4 first connect uses `hostIdentifier: "L2"`
Then open-with-context delivers to `L2` within wait budget
And `findInstances` / running-instance queries for the open flow reference `L2`, not `L-stale`, as the resolution source

Given both `L-stale` and `L2` remain CONNECTED after the scenario
When querying apps running for intent discovery (if exposed in test harness)
Then document actual cardinality — test may assert `>= 2` CONNECTED with comment linking to findIntent oracle work, **or** assert harness must disconnect `L-stale` before second open (product decision: prefer explicit assertion that second open still succeeds)

## Out of scope

- Automatic purge of all stale instances (product policy)
- findIntent merge oracle
- Multi-hour toolbox soak

## TypeScript interfaces

none

## Test guidance

Single `describe("session carry-over")` block in `wcp-desktop-agent.integration.test.ts`. Reuse RT-02/RT-03 helpers.

**Important:** If soak test proves agent cannot disambiguate without teardown, file follow-up under TV5-01 rather than weakening assertion.

Run:

```bash
npx vp test run -w @finos/sail-desktop-agent -- src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
```

## Blocked decisions

- Whether to assert strict `findInstances` count vs “second open succeeds” only — resolve during RED if agent behavior unclear

## Loop history

- 2026-06-22: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
