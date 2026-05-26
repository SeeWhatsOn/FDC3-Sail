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
  - packages/sail-platform-api/
depends_on:
  - extend-cleanup-source-and-open-with-context
integration_branch: ""
branch: test/wcp-integration-path
external_tracker: ""
tags: [fdc3, wcp]
---

## Goal

Add at least one test that exercises **WCPConnector ↔ DesktopAgent** wiring (not `MockTransport` only), **or** document release sign-off that `FDC3_2_2_REMEDIATION_PLAN.MD` Task 6 platform integration tests are sufficient.

## User or system context

Vitest (`wcp-connector.test.ts`) covers WCP units. Cucumber uses `MockTransport` and does not catch bridge regressions between browser WCP and core agent.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 9)

## Behavior spec

**Option A (preferred for this package):** Vitest integration with `createBrowserDesktopAgent` + synthetic `postMessage` WCP1Hello.

**Option B:** Explicit deferral note in PRD/compliance review pointing to `sail-platform-api` Task 6 acceptance criteria.

**Option C:** Cucumber + jsdom — only if stable in CI.

## Out of scope

- Full FINOS conformance pack over WCP in this package.

## Test guidance

Coordinate with platform team to avoid duplicating Task 6 suite.

## Blocked decisions

Owner: `@finos/sail-desktop-agent` vs `@finos/sail-platform-api` for release gate.
