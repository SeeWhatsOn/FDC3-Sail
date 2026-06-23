---
title: "Toolbox conformance v5 follow-up (epic)"
slug: epic-toolbox-conformance-v5-follow-up
kind: epic
type: feature
status: approved
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

Close the measured gap between v5 harness export (**53 pass / 49 fail**, 102 scenarios) and a v6 re-run by fixing harness session teardown and remaining WCP delivery gaps; hold findIntent policy chain blocked until FINOS + teardown.

## User or system context

v4 wave cleared **UserCancelledResolution** (9 → 0) and **AppTimeout** (33 → 0). v5 dominant cluster: **26×** close-context teardown. Metadata client path and harness pre-register/popup disconnect are **delivered**. findIntent apps.length may be stale-instance noise until TV5-01 lands.

## Reference docs

- `plans/prd-toolbox-conformance-v5-follow-up.md`
- `conformance-report-v5.txt`
- `conformance-test-failure-review.md` (§TB-09, §6)

## Parent context

Single active conformance coordinator (v4 PRD and epic **deleted**). See PRD **Work item retention** for delivered v4 slugs.

## Child work items

| Slug | Kind | Status | Notes |
|------|------|--------|-------|
| `fix-harness-finOs-session-teardown` | task | waiting_on_user | TV5-01 — lifecycle merged; close-context + manual v6 |
| `extend-wcp-channel-delivery-integration-tests` | task | waiting_on_user | TV5-02 — implementation complete |
| `fix-findintent-raise-intent-oracle` | task | blocked | TV5-03–05 merged |
| `epic-conformance-regression-test-net` | epic | approved | RT-00 — v6 open-with-context / WCP4 regression net (7 children) |

**Delivered (work items deleted):** `fix-toolbox-metadata-client-and-dacp-paths`, `populate-intent-result-metadata-toolbox`, `pre-register-conformance1-pending-instance`, `harness-popup-wcp-disconnect-cleanup`, `record-toolbox-v4-measured-baseline`, `verify-v4-agent-fixes-on-current-branch`, `diagnose-harness-user-cancelled-resolution`, epic `toolbox-conformance-v4-follow-up`.

**Suggested order:** TV5-01 manual v6 → approve TV5-02 → RT-01–07 regression net (`epic-conformance-regression-test-net`) → manual v7 export → unblock TV5-03–05 if FINOS policy clear.

## Out of scope

- sail-web full-stack (:3000)
- CI toolbox gate
- 61s Mocha timeouts (triage if v6 still red)

## TypeScript interfaces

none

## Test guidance

Targeted Vitest + harness tests per child; manual toolbox at :3001. Success: v6 pass **> 52%**, close-context **down ≥ 20** vs v5.

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
