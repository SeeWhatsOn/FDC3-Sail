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

Close the measured gap between merged toolbox burn-down work and harness exports: v4 **31/64**, v5 **53/49** (2026-06-19). Remaining work is client `getResultMetadata`, harness teardown, and blocked findIntent policy items.

## User or system context

Maintainers need a second delivery wave after TB-00–TB-09: v4 shows agent rows still red and ~36 AppTimeout integration failures. This epic sequences work that MockTransport BDD alone cannot close.

## Reference docs

- `plans/prd-toolbox-conformance-v4-follow-up.md`
- `conformance-report-v5.txt`
- `conformance-test-failure-review.md`
- `website/docs/packages/desktop-agent/conformance.md`

## Parent context

v5 export: **53 pass / 49 fail** (102 scenarios). UCR and AppTimeout clusters largely cleared. **New gaps:** `getResultMetadata` client API (4 rows), close-context teardown (26 rows), stale instances inflating findIntent. **Blocked:** TV4-01→04 findIntent / throws until FINOS clarification. **Proceed:** close completed harness items; add TV4-03b (client metadata), teardown tasks (see `conformance-test-failure-review.md` §6).

## Child work items

| Slug | Kind | Depends on | Status |
|------|------|------------|--------|
| record-toolbox-v4-measured-baseline | task | — | in-progress |
| verify-v4-agent-fixes-on-current-branch | task | — | in-progress |
| dedupe-findintent-directory-running-apps | task | — | blocked |
| fix-findintent-empty-apps-noappsfound | task | dedupe-findintent-directory-running-apps | blocked |
| populate-intent-result-metadata-toolbox | task | — | in-progress |
| align-raise-intent-throws-v4-matrix | task | fix-findintent-empty-apps-noappsfound | blocked |
| diagnose-harness-user-cancelled-resolution | spike | — | in-progress (Phase 1 done) |
| extend-wcp-channel-delivery-integration-tests | task | verify-v4-agent-fixes-on-current-branch | in-progress |
| pre-register-conformance1-pending-instance | task | verify-v4-agent-fixes-on-current-branch | in-progress |
| harness-popup-wcp-disconnect-cleanup | task | pre-register-conformance1-pending-instance | in-progress (partial — v5) |

**v5 follow-up epic:** `epic-toolbox-conformance-v5-follow-up` — grouped tasks `fix-toolbox-metadata-client-and-dacp-paths`, `fix-harness-finOs-session-teardown`. See `conformance-test-failure-review.md` §6.

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
