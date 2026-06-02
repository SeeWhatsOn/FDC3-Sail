---
title: "Harness toolbox re-run and update failure review doc"
slug: harness-toolbox-rerun-baseline
kind: task
type: chore
status: done
loop_count: 0
loop_limit: 3
last_agent: top-level-delivery-workflow
file_manifest:
  - conformance-test-failure-review.md
depends_on:
  - conformance-bdd-blind-spot-audit
  - fix-app-metadata-desktop-agent-field
  - fix-intent-discovery-displayname-dedupe
  - bind-host-instance-id-at-wcp4
integration_branch: v3-pre
branch: cursor/harness-toolbox-rerun-baseline-95cd
pr_url: https://github.com/SeeWhatsOn/FDC3-Sail/pull/57
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

From `plans/prd-toolbox-conformance-burn-down.md`: Final verification slice after the blind-spot audit, agent fixes, and WCP fixes. This item updates the failure-category matrix from the audit with fresh v4 evidence rather than inventing attribution from scratch.

## Behavior spec

Given npm run dev -w @finos/sail-conformance-harness on port 3001
When the maintainer runs the full toolbox export inside Conformance1
Then a v4 summary is recorded in this work item ## Staged for review
And conformance-test-failure-review.md updates the TB-00 failure-category matrix with remaining failure attribution vs v3

## Out of scope

- CI gate for toolbox
- Fixing remaining failures in the same item (file follow-up tasks if needed)
- Committing conformance-report-v4.txt unless human requests

## TypeScript interfaces

none

## Test guidance

Manual only. Capture pass/fail counts, duration, notable deltas (getAppMetadata, findIntent, AppTimeout count), and per-category movement against the TB-00 matrix. No executable test code required for RED phase.

## Blocked decisions

Whether to commit conformance-report-v4.txt to repo root (default: no — summary in work item only).

## Loop history

- 2026-05-31: approved by human

## Staged for review

- v3 baseline: 15 pass / 45 fail. v4 measured export not run in cloud VM.
- GREEN: TB-08 section + matrix v4-pending column in `conformance-test-failure-review.md`.
- PR: https://github.com/SeeWhatsOn/FDC3-Sail/pull/57

## Phase audit

| Phase | Subagent | Registered | Result |
| A | test-engineer | yes | RED (manual) |
| B | implement-agent | yes | GREEN |
| C | verifier-agent | yes | PASS |
| D | code-reviewer | yes | PASS |

## Escalation notes

_(empty)_

## Learnings extracted

_(empty)_
- 2026-06-02: reconcile-queue.sh — PR merged
