---
title: "BDD or integration scenario through real WCPConnector"
slug: bdd-wcp-integration-scenario
type: enhancement
status: pr_awaiting
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - packages/sail-desktop-agent/src/browser/__tests__/wcp-desktop-agent.integration.test.ts
depends_on:
  - extend-cleanup-source-and-open-with-context
integration_branch: v3-pre
branch: cursor/bdd-wcp-integration-scenario
pr_url: "https://github.com/SeeWhatsOn/FDC3-Sail/pull/53"
external_tracker: ""
tags: [fdc3]
---

## Goal

Add at least one test that exercises **WCPConnector ↔ DesktopAgent** wiring (not `MockTransport` only) for the toolbox blind spots that Cucumber cannot prove: host instance-id adoption, open/findInstances visibility, multi-instance channel delivery, and launch-via-intent delivery.

## User or system context

Vitest (`wcp-connector.test.ts`) covers WCP units. Cucumber uses `MockTransport` and does not catch bridge regressions between browser WCP and core agent.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 9)

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md` and the TB-00 blind-spot audit: `@conformance2.2` MockTransport scenarios cover API behavior, but toolbox rows still fail in the real browser/WCP path with `AppTimeout`, `IntentDeliveryFailed`, missing opened instances, and `GetInfo2` timeouts.

## Behavior spec

Given an app is opened through the browser/WCP connector after `bind-host-instance-id-at-wcp4`
When the WCP handshake completes
Then the WCP5 canonical instanceId matches the host-assigned instanceId
And `findInstances()` includes the opened instance

Given two WCP-connected app instances are on the same user or app channel
When one instance broadcasts context
Then the other instance receives the context over the real WCPConnector path

Given an intent raises and launches a target app through WCP
When the target validates and registers its listener
Then intent delivery does not fail with `AppTimeout` or `IntentDeliveryFailed`

## Out of scope

- Full FINOS conformance pack over WCP in this package.
- sail-web resolver UI automation.

## TypeScript interfaces

none

## Test guidance

Prefer Vitest with `createBrowserDesktopAgent` or an existing browser/WCP harness over Cucumber if jsdom WCP is more stable there. Validation command: `npm test -w @finos/sail-desktop-agent` or a narrower package Vitest command for the new WCP integration file followed by the full package test before staging.

## Blocked decisions

_(empty)_

## Loop history

- 2026-05-27: approved by human (validation gaps waived)
- 2026-06-01: TB-00 audit updated scope from generic WCP coverage to exact toolbox blind spots: host id adoption, `findInstances`, channel delivery, `raiseIntent` launch delivery, and `GetInfo2` browser bootstrap.
