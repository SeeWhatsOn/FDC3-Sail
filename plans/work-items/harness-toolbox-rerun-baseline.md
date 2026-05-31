---
title: "Harness toolbox re-run and update failure review doc"
slug: harness-toolbox-rerun-baseline
kind: task
type: chore
status: approved
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest:
  - conformance-test-failure-review.md
depends_on:
  - fix-app-metadata-desktop-agent-field
  - fix-intent-discovery-displayname-dedupe
  - bind-host-instance-id-at-wcp4
integration_branch: v3-pre
branch: cursor/harness-toolbox-rerun-baseline
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Run FINOS toolbox inside Conformance1 at :3001 after agent/integration fixes; record pass/fail summary and update conformance-test-failure-review.md vs v3 baseline.

## User or system context

Manual acceptance for the toolbox-conformance-burn-down epic. Harness must be running (`npm run dev -w @finos/sail-conformance-harness`). Compare against conformance-report-v3.txt (15 pass / 45 fail).

## Reference docs

- `plans/prd-toolbox-conformance-burn-down.md` (TB-08)
- `packages/sail-conformance-harness/README.md`
- `conformance-report-v3.txt`

## Parent context

From `plans/prd-toolbox-conformance-burn-down.md`: Final verification slice; documents remaining failure attribution after agent and WCP fixes.

## Behavior spec

Given npm run dev -w @finos/sail-conformance-harness on port 3001
When the maintainer runs the full toolbox export inside Conformance1
Then a v4 summary is recorded in this work item ## Staged for review
And conformance-test-failure-review.md reflects remaining failure attribution vs v3

## Out of scope

- CI gate for toolbox
- Fixing remaining failures in the same item (file follow-up tasks if needed)
- Committing conformance-report-v4.txt unless human requests

## TypeScript interfaces

none

## Test guidance

Manual only. Capture pass/fail counts, duration, and notable deltas (getAppMetadata, findIntent, AppTimeout count). No executable test code required for RED phase.

## Blocked decisions

Whether to commit conformance-report-v4.txt to repo root (default: no — summary in work item only).

## Loop history

- 2026-05-31: approved by human

## Staged for review

_(empty)_

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
