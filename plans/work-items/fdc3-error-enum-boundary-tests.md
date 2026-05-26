---
title: "FDC3 error enum boundary tests"
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
depends_on: []
integration_branch: ""
branch: test/fdc3-error-enums
external_tracker: ""
tags: [fdc3, conformance2.2]
---

## Goal

Lock standard FDC3 error enum values on DACP error responses and promise rejection paths so regressions cannot return wrong strings or generic casts.

## Reference docs

- `plans/prd-desktop-agent-conformance-gaps.md` (item 7)
- `FDC3_2_2_COMPLIANCE_REVIEW.MD` (Needs test: standard enum messages)

## Behavior spec

Representative matrix: `MalformedContext`, `NoAppsFound`, `TargetAppUnavailable`, `IntentDeliveryFailed`, `AppTimeout`, `UserCancelledResolution` — assert `msg.payload.error` or rejection `errorType` matches `@finos/fdc3` enum.

## Out of scope

- Full combinatorial exhaust of every handler branch.

## Test guidance

Prefer extending existing feature files over duplicating scenarios; add Vitest table tests for pure mapping helpers if any.

## Blocked decisions

Whether to assert exact error **message** strings from spec or only enum values.
