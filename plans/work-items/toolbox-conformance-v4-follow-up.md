---
title: "Toolbox conformance v4 follow-up (epic)"
slug: toolbox-conformance-v4-follow-up
kind: epic
type: feature
status: draft
loop_count: 0
loop_limit: 3
last_agent: ""
file_manifest: []
depends_on: []
integration_branch: v3-pre
branch: ""
pr_url: ""
merged_pr: ""
external_tracker: ""
tags: [fdc3]
---

## Goal

Close the measured gap between merged toolbox burn-down work and `conformance-report-v4.txt` (31/64) via agent oracle fixes, WCP multi-app delivery tests, and an updated failure-review baseline.

## User or system context

Maintainers need a second delivery wave after TB-00–TB-09: v4 shows agent rows still red and ~36 AppTimeout integration failures. This epic sequences work that MockTransport BDD alone cannot close.

## Reference docs

- `plans/prd-toolbox-conformance-v4-follow-up.md`
- `conformance-report-v4.txt`
- `conformance-test-failure-review.md`
- `website/docs/packages/desktop-agent/conformance.md`

## Parent context

v4 export ran 95 scenarios (31 pass). Agent fixes (#47–#48) and WCP bind (#49) merged but v4 still reports `desktopAgent`, `apps.length`, and channel timeouts. **Parallel tracks:** TV4-01→02→04 (findIntent / raiseIntent throws) blocked on FINOS clarification; proceed with TV4-03, TV4-05–08 and spike TV4-06 independently.

## Child work items

| Slug | Kind | Depends on | Status |
|------|------|------------|--------|
| record-toolbox-v4-measured-baseline | task | — | draft |
| verify-v4-agent-fixes-on-current-branch | task | — | draft |
| dedupe-findintent-directory-running-apps | task | — | blocked |
| fix-findintent-empty-apps-noappsfound | task | dedupe-findintent-directory-running-apps | blocked |
| populate-intent-result-metadata-toolbox | task | — | draft |
| align-raise-intent-throws-v4-matrix | task | fix-findintent-empty-apps-noappsfound | blocked |
| diagnose-harness-user-cancelled-resolution | spike | — | draft |
| extend-wcp-channel-delivery-integration-tests | task | verify-v4-agent-fixes-on-current-branch | draft |

## Out of scope

- sail-web full-stack fixes
- Full Playwright toolbox reimplementation
- CI toolbox gate

## TypeScript interfaces

none

## Test guidance

Deliver `record-toolbox-v4-measured-baseline` and `verify-v4-agent-fixes-on-current-branch` first. **Blocked:** TV4-01–04 until `findIntent` apps[] policy confirmed with FINOS. **Proceed:** TV4-03, TV4-05–08, spike TV4-06. Re-run toolbox manually after TV4-01–05 land.

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
