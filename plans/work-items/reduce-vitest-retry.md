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
tags: [testing]
---

## Goal

Set `retry: 0` (or remove retry) in `vitest.config.ts` once cleanup and transport work items are green so intermittent failures are visible.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 11)
- `FDC3_2_2_COMPLIANCE_REVIEW.MD` (optional cleanup)

## Behavior spec

Given full `npm test -w @finos/sail-desktop-agent`
When run twice locally
Then results are stable without retry masking flakes

## Out of scope

- Flaky Playwright-in-Vitest issue in sail-web.

## Blocked decisions

Depends on transport PRD work items completing first.
