---
title: "BDD or integration scenario through real WCPConnector"
slug: bdd-wcp-integration-scenario
type: enhancement
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/test/
  - packages/sail-desktop-agent/src/browser/browser-desktop-agent.ts
  - packages/sail-desktop-agent/src/browser/__tests__/
depends_on:
  - extend-cleanup-source-and-open-with-context
integration_branch: ""
branch: test/wcp-integration-path
external_tracker: ""
tags: [fdc3, wcp]
---

## Goal

Prove at least one end-to-end path: WCP1 → WCP4 → DACP (e.g. getInfo or addContextListener) without `MockTransport`, so wiring regressions between `WCPConnector` and `DesktopAgent` are caught.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 9)
- `FDC3_2_2_REMEDIATION_PLAN.MD` Task 6 (platform integration — coordinate to avoid duplicate)

## Behavior spec

Option A: Vitest integration test with `createBrowserDesktopAgent` + synthetic `postMessage` WCP1Hello.
Option B: Cucumber profile with jsdom/window mock — only if stable in CI.

## Out of scope

- Full FINOS conformance pack over WCP.

## Blocked decisions

Vitest-only vs. Cucumber; whether platform Task 6 satisfies this item for release sign-off.
