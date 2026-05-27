---
title: "Extend FDC3 error enum boundary tests"
slug: fdc3-error-enum-boundary-tests
type: enhancement
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/
  - packages/sail-desktop-agent/src/core/errors/fdc3-errors.ts
  - packages/sail-desktop-agent/test/features/
  - packages/sail-desktop-agent/src/core/handlers/dacp/__tests__/
depends_on:
  - conformance-traceability-map
integration_branch: ""
branch: test/fdc3-error-enums
external_tracker: ""
tags: [fdc3]
---

## Goal

**Extend and lock** standard FDC3 error enum values on DACP error responses and promise rejection paths. Reduce ad-hoc string casts at handler boundaries.

## User or system context

Many features already assert errors (e.g. `MalformedContext`, `NoAppsFound`, `IntentDeliveryFailed` in intent/app features). Gap is **coverage completeness and consistency**, not absence of error tests.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 7)
- `FDC3_2_2_COMPLIANCE_REVIEW.MD` (Needs test: standard enum messages)

## Parent context

From `plans/prd-desktop-agent-conformance-gaps.md`: Close lifecycle cleanup, conformance evidence, validation boundaries, and test trust before P1 sign-off and v3 release.

## Behavior spec

Build a small matrix (table-driven Vitest and/or Cucumber) for representative operations:
- broadcast / open / raiseIntent / findIntent / channel listener errors
- Assert `msg.payload.error` or rejection type matches `@finos/fdc3` enum

## Out of scope

- Wiring Zod validator in platform (remediation Task 6).

## TypeScript interfaces

none

## Test guidance

Audit existing feature files first; only add scenarios for uncovered enum/surface pairs.

## Blocked decisions

Assert enum only vs. exact spec error message strings.
