---
title: "Record FDC3 3.0 toolbox harness baseline"
slug: record-fdc3-3-0-toolbox-baseline
kind: task
type: chore
status: blocked
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - packages/sail-conformance-harness/package.json
  - packages/sail-conformance-harness/results/
  - packages/sail-conformance-harness/README.md
depends_on:
  - expand-conformance3-0-bdd-coverage
  - configurable-fdc3-version-advertisement
integration_branch: v3-pre
branch: cursor/record-fdc3-3-0-toolbox-baseline-8a9f
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Run FINOS FDC3 3.0 conformance toolbox against the clean-room harness and record a measured baseline export when `@finos/fdc3` 3.x client and 3.0 scenario pack are available.

## User or system context

Phase B/C of dual-version PRD requires proof before flipping default `fdc3Version` to `"3.0"`. Harness today uses `@finos/fdc3` ^2.2.3 on port 3001.

## Reference docs

- `plans/prd-fdc3-3-0-dual-version-support.md` (F30-10)
- `packages/sail-conformance-harness/results/conformance-test-failure-review.md`
- FINOS fdc3-conformance toolbox (external)

## Parent context

Child of `epic-fdc3-3-0-dual-version`. **Could-have** — blocked until FINOS publishes npm 3.x and 3.0 toolbox scenarios. May start with spike notes if pack lags implementation.

## Behavior spec

Scenario: Harness dependency ready
  Given `@finos/fdc3` 3.x is published and compatible with harness
  When harness package.json is bumped and built
  Then Conformance1 iframe connects with fdc3Version reflecting agent config

Scenario: Baseline export
  Given agent advertises `"3.0"` and Must-have handlers landed
  When manual toolbox run completes on :3001
  Then `conformance-report-v3.0-*.txt` and failure review section exist under `results/`

Scenario: 2.2 baseline preserved
  Given 3.0 run recorded
  When 2.2 export is re-run with fdc3Version `"2.2"`
  Then v6+ 2.2 pass rate is documented for regression comparison

## Out of scope

- CI gate on 3.0 toolbox
- Changing mock app implementations beyond dependency bump
- sail-web full-stack run

## TypeScript interfaces

none

## Test guidance

Manual harness run primary. Optional harness Vitest if dependency bump needs smoke test. Document commands in README. No new Cucumber in desktop-agent for this slice.

## Blocked decisions

- **Blocked on:** `@finos/fdc3` 3.x npm and FINOS 3.0 toolbox scenario pack availability — revisit after F30-03–09 land.

## Loop history

_(empty)_

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
