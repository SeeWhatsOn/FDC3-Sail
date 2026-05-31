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

## Child work items

| Slug | Kind | Depends on | Status |
|------|------|------------|--------|
| fix-app-metadata-desktop-agent-field | task | — | approved |
| fix-intent-discovery-displayname-dedupe | task | — | approved |
| fdc3-error-enum-boundary-tests | task | conformance-traceability-map | pr_awaiting |
| toolbox-bdd-metadata-assertions | task | fix-app-metadata-desktop-agent-field, fix-intent-discovery-displayname-dedupe | approved |
| investigate-launcher-wcp-instance-id | spike | — | approved |
| bind-host-instance-id-at-wcp4 | task | investigate-launcher-wcp-instance-id | approved |
| fix-cucumber-raise-intent-launch-correlation | task | bind-host-instance-id-at-wcp4 | approved |
| context-metadata-conformance-bdd | task | — | approved |
| bdd-wcp-integration-scenario | task | bind-host-instance-id-at-wcp4 | approved |
| harness-toolbox-rerun-baseline | task | fix-app-metadata-desktop-agent-field, fix-intent-discovery-displayname-dedupe, bind-host-instance-id-at-wcp4 | approved |

## Out of scope

- sail-web / sail-platform-api product shell fixes (separate workload)
- CI gate running full FINOS toolbox
- Same-origin proxy of fdc3.finos.org (unless spike mandates)

## TypeScript interfaces

none

## Test guidance

Deliver children in dependency order; TB-08 (harness re-run) is manual acceptance after agent and WCP fixes land.

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
