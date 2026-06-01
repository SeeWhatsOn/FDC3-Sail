---
title: "Toolbox conformance burn-down (epic)"
slug: toolbox-conformance-burn-down
kind: epic
type: feature
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest: []
depends_on: []
integration_branch: v3-pre
branch: ""
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Close FINOS toolbox failures exposed by `@finos/sail-conformance-harness` by fixing agent library gaps, WCP instance-id integration, and BDD holes — measured by harness re-run vs v3 baseline.

## User or system context

Lead maintainer and conformance engineers need to separate desktop-agent bugs from sail-web/platform integration using the harness clean room (`:3001`) and drive fixes with BDD coverage before manual toolbox runs.

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md`
- `conformance-test-failure-review.md`
- `conformance-report-v2.txt`, `conformance-report-v3.txt`
- `packages/sail-desktop-agent/docs/conformance-traceability.md`

## Parent context

FINOS toolbox failures split into agent library bugs (metadata, intent discovery, error enums) and real-browser WCP integration (instance id lifecycle, multi-iframe delivery). Cucumber MockTransport is largely green but does not assert toolbox-checked fields and fails on launch+validate instance correlation.

Before delivering the remaining child fixes, run the blind-spot audit so each toolbox failure category has an explicit classification, owner, and regression-net expectation. This prevents `@conformance2.2` scenario volume from being treated as equivalent to the FINOS toolbox oracle.

## Child work items

| Slug | Kind | Depends on | Status |
|------|------|------------|--------|
| conformance-bdd-blind-spot-audit | task | — | done |
| fix-app-metadata-desktop-agent-field | task | — | pr_awaiting |
| fix-intent-discovery-displayname-dedupe | task | — | pr_awaiting |
| fdc3-error-enum-boundary-tests | task | conformance-traceability-map | pr_awaiting |
| toolbox-bdd-metadata-assertions | task | fix-app-metadata-desktop-agent-field, fix-intent-discovery-displayname-dedupe | approved |
| investigate-launcher-wcp-instance-id | spike | — | pr_awaiting |
| bind-host-instance-id-at-wcp4 | task | investigate-launcher-wcp-instance-id | pr_awaiting |
| fix-cucumber-raise-intent-launch-correlation | task | bind-host-instance-id-at-wcp4 | approved |
| context-metadata-conformance-bdd | task | — | approved |
| bdd-wcp-integration-scenario | task | bind-host-instance-id-at-wcp4 | approved |
| harness-toolbox-rerun-baseline | task | conformance-bdd-blind-spot-audit, fix-app-metadata-desktop-agent-field, fix-intent-discovery-displayname-dedupe, bind-host-instance-id-at-wcp4 | approved |

## Out of scope

- sail-web / sail-platform-api product shell fixes (separate workload)
- CI gate running full FINOS toolbox
- Same-origin proxy of fdc3.finos.org (unless spike mandates)

## TypeScript interfaces

none

## Test guidance

Deliver `conformance-bdd-blind-spot-audit` first. Then deliver children in dependency order; TB-08 (harness re-run) is manual acceptance after the audit, agent fixes, and WCP fixes land.

## Blocked decisions

_(empty)_

## Loop history

- 2026-05-31: approved by human (batch approve all child items)

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
