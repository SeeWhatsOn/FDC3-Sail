---
title: "Diagnose harness UserCancelledResolution on intent results"
slug: diagnose-harness-user-cancelled-resolution
kind: spike
type: chore
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-conformance-harness/src/intent-resolver-wiring.ts
  - packages/sail-conformance-harness/README.md
  - conformance-test-failure-review.md
depends_on: []
integration_branch: v3-pre
branch: cursor/diagnose-harness-user-cancelled-resolution
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Determine why ~9 v4 `raiseIntent (Result)` scenarios report `UserCancelledResolution` despite `createHarnessIntentResolver()` and document the fix owner (harness, agent, or timeout).

## User or system context

Harness README claims programmatic resolver. v4 still fails void/context/channel result scenarios including delayed (5s/61s) variants. Blocks toolbox pass rate on result metadata paths.

## Reference docs

- `plans/prd-toolbox-conformance-v4-follow-up.md` (TV4-06)
- `conformance-report-v4.txt` (fdc3.raiseIntent Result)
- `packages/sail-conformance-harness/src/intent-resolver-wiring.test.ts`

## Parent context

Spike only — deliverable is a short decision record in the spike work item and optional follow-up task slug(s). May spawn `fix-harness-intent-resolver-delayed-results` task after Phase 1.

## Behavior spec

Phase 1 — Investigate

Given conformance-report-v4 UserCancelledResolution rows listed
When tracing harness preset from WCP hello through raiseIntent to resolver callback
Then document whether resolver is invoked, returns a selection, or times out
And classify each failure row as harness config, agent cancellation, or delivery timeout

Phase 2 — Fix (only if Phase 1 identifies code change)

Given Phase 1 names agent or harness as owner
When the follow-up task is approved separately
Then implement the fix with Vitest/harness unit test where applicable

## Out of scope

- Implementing fixes in this spike without Phase 1 conclusion
- sail-web resolver modal

## TypeScript interfaces

none

## Test guidance

Phase 1: no executable RED. Optional harness unit test extensions if repro is local. Phase 2 deliverable is a separate approved task.

Deliverable via /ww-deliver: **no** for full spike — human may approve for Phase 1 documentation only, or split Phase 2 into a new task.

## Blocked decisions

_(empty)_

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
