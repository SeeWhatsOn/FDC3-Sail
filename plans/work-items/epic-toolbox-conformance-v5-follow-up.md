---
title: "Toolbox conformance v5 follow-up (epic)"
slug: epic-toolbox-conformance-v5-follow-up
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

Close the measured gap between v5 harness export (**53 pass / 49 fail**, 102 scenarios) and a v6 re-run by fixing harness session teardown, client-side metadata surfaces, and remaining agent-oracle rows not covered by the blocked findIntent policy chain.

## User or system context

v4 follow-up batch cleared **UserCancelledResolution** (9 → 0) and **AppTimeout** (33 → 0) but exposed two new dominant clusters: **`App didn't return close context within 1 sec` (~26 rows)** and **`getResultMetadata` empty (4 rows)** despite DACP wire metadata. `findIntent` apps.length worsened (2 → 4) from stale instances across the full toolbox run. Maintainers need a grouped v5 wave before re-opening blocked TV4-01–04 items.

## Reference docs

- `conformance-report-v5.txt`
- `conformance-test-failure-review.md` (§TB-09, §6)
- `plans/work-items/toolbox-conformance-v4-follow-up.md`
- `plans/prd-toolbox-conformance-v4-follow-up.md`

## Parent context

Extends TV4-00 epic after v5 export. **Parallel tracks:** (A) harness session hygiene — proceed immediately; (B) metadata client/DACP paths — proceed immediately; (C) findIntent dedupe / NoAppsFound / throws matrix — remain blocked on FINOS until (A) makes toolbox counts trustworthy.

## Behavior spec

_(Epic — see child work items.)_

## Child work items

| Slug | Kind | Depends on | Status | v5 rows targeted |
|------|------|------------|--------|------------------|
| `fix-harness-finOs-session-teardown` | task | `harness-popup-wcp-disconnect-cleanup` | draft | ~26 close-context; findIntent 4 vs 1; open 20s timeouts; findInstances instanceId |
| `fix-toolbox-metadata-client-and-dacp-paths` | task | `populate-intent-result-metadata-toolbox` | draft | 4 getResultMetadata; 2 desktopAgent; 1 intent context traceId |

**Suggested delivery order:** metadata client task first (smaller, agent-only, 4 quick wins), then harness session teardown (larger integration surface), then manual v6 toolbox export.

**After this epic:** Re-run blocked `dedupe-findintent-directory-running-apps` only when FINOS clarifies policy and stale-instance noise is reduced.

## Out of scope

- sail-web full-stack (:3000)
- CI toolbox gate
- FINOS findIntent apps[] policy (existing blocked items)
- 61s delay Mocha timeouts (toolbox budget — triage separately if v6 still red)

## TypeScript interfaces

none

## Test guidance

Targeted Vitest + harness unit tests per child; manual toolbox at :3001 for acceptance. Success: v6 pass rate **> 52%** and close-context cluster **down ≥ 20** vs v5.

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
