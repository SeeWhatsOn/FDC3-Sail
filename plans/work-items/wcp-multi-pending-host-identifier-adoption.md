---
title: "Regression tests for multi-pending WCP hostIdentifier adoption"
slug: wcp-multi-pending-host-identifier-adoption
kind: task
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/handlers/utils/wcp-host-instance-adoption.ts
  - packages/sail-desktop-agent/src/handlers/__tests__/wcp-host-instance-id.test.ts
  - packages/sail-desktop-agent/src/handlers/utils/__tests__/wcp-host-instance-adoption.test.ts
  - packages/sail-desktop-agent/src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
depends_on:
  - wcp-first-connect-open-with-context-integration
integration_branch: v3-pre
branch: cursor/wcp-multi-pending-host-identifier-adoption-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Prove WCP4 host adoption picks the correct pending instance when **multiple stale PENDING** rows exist for the same `appId`, using `hostIdentifier` (popup `window.name`) — preventing wrong-id open-with-context and `findInstances` mismatch.

## User or system context

v6 shows `findInstances` failure where `IntentResolution.source.instanceId` does not match mock `AppIdentifier`. Late-pack `findIntent apps.length 2 vs 1` is consistent with CONNECTED instances surviving failed teardown. Sole-pending heuristic is insufficient when two `MockAppId` PENDING rows exist; `hostIdentifier` from WCP1 must disambiguate.

## Reference docs

- `plans/prd-conformance-regression-test-net.md` (RT-03)
- `packages/sail-desktop-agent/src/handlers/utils/wcp-host-instance-adoption.ts`
- `packages/sail-desktop-agent/src/handlers/__tests__/wcp-host-instance-id.test.ts`
- `packages/sail-desktop-agent/src/app-connection/wcp/wcp-identity-validation.ts`
- `AGENTS.md` (WCP4 adoption, no sole-pending-only reliance)

## Parent context

Child of `epic-conformance-regression-test-net`. Depends on RT-02 helpers for end-to-end open-with-context assertion after adoption.

## Behavior spec

### Unit: adoption candidate selection

Given two `PENDING` instances `L1` and `L2` for `MockAppId` in agent state
When `tryAdoptHostPreRegisteredInstance` runs with `hostIdentifier: "L2"` and no `instanceId` in WCP4
Then adopted canonical id is `L2`, not `L1` or a newly generated UUID

Given two pendings and WCP4 provides explicit `instanceId: "L1"`
When `hostIdentifier` conflicts or is absent
Then explicit `instanceId` wins per existing adoption rules

### Integration: open-with-context after stale session

Given instance `L1` left `CONNECTED` (simulated failed teardown)
And new launch creates pending `L2` with open-with-context
When WCP4 first connect sends `hostIdentifier: "L2"`
Then listener on `L2` receives context
And `findInstances` for the app does not return both `L1` and `L2` as ambiguous delivery targets for the new open (assert policy: new open targets `L2` only)

## Out of scope

- Harness popup registry (RT-05)
- findIntent merge oracle (`fix-findintent-raise-intent-oracle`)
- Automatic stale instance purge (session soak is RT-06)

## TypeScript interfaces

`HostInstanceAdoptionInput` fields: `hostIdentifier`, `identityUrl`, optional `instanceId` / `instanceUuid`.

## Test guidance

**Unit:** New `wcp-host-instance-adoption.test.ts` with table-driven cases for 2+ pendings + `hostIdentifier`.

**Integration:** One case in `wcp-desktop-agent.integration.test.ts` — setup two pendings, connect second with WCP4, assert open-with-context delivery to correct id.

Extend `wcp-host-instance-id.test.ts` if adoption without `instanceUuid` cases are not already covered.

Run:

```bash
npx vp test run -w @finos/sail-desktop-agent -- src/handlers/utils/__tests__/wcp-host-instance-adoption.test.ts src/handlers/__tests__/wcp-host-instance-id.test.ts src/app-connection/__tests__/wcp-desktop-agent.integration.test.ts
```

## Blocked decisions

_(empty)_

## Loop history

- 2026-06-22: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
