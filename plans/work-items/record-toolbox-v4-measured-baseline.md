---
title: "Record measured toolbox v4 baseline in failure review"
slug: record-toolbox-v4-measured-baseline
kind: task
type: chore
status: in-progress
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - conformance-test-failure-review.md
depends_on: []
integration_branch: v3-pre
branch: cursor/record-toolbox-v4-measured-baseline
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Replace "v4 pending export" language in the failure review with measured pass/fail counts and symptom-category totals from `conformance-report-v4.txt`.

## User or system context

TB-08 closed with expected deltas; v4 is now committed at repo root. Maintainers need an authoritative v3→v4 comparison for the follow-up epic.

## Reference docs

- `plans/prd-toolbox-conformance-v4-follow-up.md` (TV4-08)
- `conformance-report-v4.txt`
- `conformance-report-v3.txt`
- `plans/completed-work-items/harness-toolbox-rerun-baseline.md`

## Parent context

From v4 PRD: baseline hygiene before prioritizing fixes. No product code — update attribution table with measured AppTimeout / UserCancelledResolution / agent-oracle counts.

## Behavior spec

Given conformance-report-v4.txt exists at repo root with passes 31 failures 64
When the maintainer updates conformance-test-failure-review.md
Then the attribution summary cites v4 measured 31/64 (95 scenarios)
And failure groups A–C reference v4 symptom counts not "pending export"
And each remaining category lists owner slug from TV4-01–06 work items

## Out of scope

- Committing additional report files beyond what human requests
- Fixing failures in this item
- Running the toolbox again

## TypeScript interfaces

none

## Test guidance

Docs-only: no executable RED phase. Validate by human review of markdown accuracy against `conformance-report-v4.txt` line items.

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
