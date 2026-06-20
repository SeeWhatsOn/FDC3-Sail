---
title: "Align raiseIntent throws error messages with v4 toolbox matrix"
slug: align-raise-intent-throws-v4-matrix
kind: task
type: bug
status: blocked
loop_count: 0
loop_limit: 3
last_agent: top-level-approval-workflow
file_manifest:
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-intent.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/intent-raise-shared.ts
  - packages/sail-desktop-agent/src/core/handlers/dacp/intent-handlers/__tests__/
depends_on:
  - fix-findintent-empty-apps-noappsfound
integration_branch: v3-pre
branch: cursor/align-raise-intent-throws-v4-matrix
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Map remaining v4 raiseIntent **throws** failures to the correct FDC3 client error `message` values (`NoAppsFound`, `IntentDeliveryFailed`, `TargetAppUnavailable`) instead of `UserCancelledResolution` or generic rejection strings.

## User or system context

v4 reports mismatches on `RaiseIntentFailedResolve`, `RaiseIntentFailTargetedAppInstanceResolve1`, `RaiseIntentFailTargetedAppResolve1`. PR #44 delivered enum boundary tests; harness paths may still diverge.

## Reference docs

- `plans/prd-toolbox-conformance-v5-follow-up.md` (TV5-05)
- `plans/project-docs.md` (item 7 `fdc3-error-enum-boundary-tests` delivered)
- `conformance-report-v4.txt` (fdc3.raiseIntent throws error)

## Parent context

Extend TB-03 where v4 still red. Depends on findIntent NoAppsFound fix so error propagation patterns are consistent. Does not fix harness resolver cancellations.

## Behavior spec

Given raiseIntent targets intent-a with context and intent that do not correlate per conformance matrix
When the raise is rejected before delivery
Then the promise rejects with message NoAppsFound (per scenario table in toolbox)

Given a targeted app instance that cannot handle the intent
When raiseIntent fails at resolve time
Then the rejection message matches the toolbox expectation for that scenario (NoAppsFound or IntentDeliveryFailed as specified)

## Out of scope

- Scenarios that require app close context within 1s (integration timeout — WCP item)
- UserCancelledResolution on successful resolve paths

## TypeScript interfaces

none

## Test guidance

RED: Extend Vitest error-boundary table from fdc3-error-enum work with v4 scenario names as case labels; add Cucumber throws scenarios only where toolbox matrix differs from existing coverage.

## Blocked decisions

**2026-06-11 — Blocked on findIntent dependency chain**

- `fix-findintent-empty-apps-noappsfound` → `dedupe-findintent-directory-running-apps` (blocked on FINOS `findIntent` apps[] clarification).
- Do not deliver TV4-04 until upstream findIntent items are unblocked.

## Loop history

- 2026-06-11: blocked — transitive dependency on `dedupe-findintent-directory-running-apps`.

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
