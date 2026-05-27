---
title: "Reduce Vitest retry after suite stabilization"
slug: reduce-vitest-retry
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/vitest.config.ts
depends_on:
  - extend-cleanup-source-and-open-with-context
integration_branch: ""
branch: chore/vitest-no-retry
external_tracker: ""
tags: []
---

## Goal

Set `retry: 0` (or remove retry) in `vitest.config.ts` once cleanup and transport work items are green so intermittent failures are visible.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 11)
- `FDC3_2_2_COMPLIANCE_REVIEW.MD` (optional cleanup)

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

Given full `npm test -w @finos/sail-desktop-agent`
When run twice locally
Then results are stable without retry masking flakes

## TypeScript interfaces

none

## Out of scope

- Flaky Playwright-in-Vitest issue in sail-web.

## Test guidance

After `retry: 0`, run `npm test -w @finos/sail-desktop-agent` twice locally; results must be stable without retry masking flakes.

## Blocked decisions

Depends on transport PRD work items completing first.
