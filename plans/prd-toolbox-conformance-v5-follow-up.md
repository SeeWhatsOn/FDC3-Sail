# PRD: Toolbox conformance v5 follow-up (harness hygiene + residual agent rows)

## Persona / user

- **Lead maintainer** driving harness toolbox pass rate above the **v5 measured baseline** (`conformance-report-v5.txt`: 53 pass / 49 fail, 102 scenarios).
- **Conformance engineer** extending WCP integration guards and fixing harness session teardown where MockTransport BDD cannot catch toolbox failures.

## Goal / outcome

Close the gap between v5 export and a v6 re-run by fixing **harness FINOS session teardown** (dominant `close context within 1 sec` cluster), finishing **WCP multi-app delivery** regression nets, and holding **findIntent policy** work blocked until FINOS clarifies `AppIntent.apps.length` rules. Success is v6 with close-context cluster **down ≥ 20**, pass rate **> 52%**, and trustworthy findIntent counts after teardown (not stale-instance inflation).

## Relationship to other plans

| Prior plan | Status | This PRD |
|------------|--------|----------|
| Toolbox burn-down TB-00–TB-09 | **done** — work items deleted | Historical; see `plans/project-docs.md` delivered index |
| v4 follow-up wave (TV4-03–08, harness pre-register/popup, metadata client) | **done** — work items deleted | Absorbed below in **Work item retention** |
| `conformance-test-failure-review.md` | v4 + v5 baselines recorded | **Extend** for v6 after delivery |
| `plans/prd-desktop-agent-state-hardening.md` | separate | **No duplicate** unless regression |
| `plans/prd-browser-preset-host-api.md` | separate | **No duplicate** |

## Evidence summary (v4 → v5)

| Metric | v4 | v5 |
|--------|----|----|
| Pass / fail | 31 / 64 (95 scenarios) | **53 / 49** (102 scenarios) |
| `AppTimeout` | ~33 | **0** |
| `UserCancelledResolution` | ~9 | **0** |
| Dominant v5 failures | — | **26×** close-context; **4×** `getResultMetadata` empty (latter **delivered**); findIntent apps.length inflated by stale instances |

**Interpretation:** v4→v5 batch cleared integration timeouts and resolver cancellation. Remaining pain is **session hygiene between toolbox scenarios** and **blocked findIntent oracle** rows until teardown is trustworthy and FINOS policy is clear.

## In scope

| ID | Summary | Kind | Work item slug |
|----|---------|------|----------------|
| TV5-00 | Epic coordinating v5 follow-up | epic | `epic-toolbox-conformance-v5-follow-up` |
| TV5-01 | Harness FINOS session teardown (`closeWindow` / `app-control` close context) | task | `fix-harness-finOs-session-teardown` |
| TV5-02 | WCP Vitest: two connected apps — user/app channel broadcast delivery | task | `extend-wcp-channel-delivery-integration-tests` |
| TV5-03 | Dedupe `AppIntent.apps` when directory + running instance overlap | task | `dedupe-findintent-directory-running-apps` |
| TV5-04 | `findIntent` wrong-context → `NoAppsFound` (not `assert.fail()`) | task | `fix-findintent-empty-apps-noappsfound` |
| TV5-05 | Align raiseIntent throws `message` with FDC3 matrix | task | `align-raise-intent-throws-v4-matrix` |

## Out of scope

- sail-web full-stack (:3000)
- CI toolbox gate
- Re-opening completed burn-down / v4 delivery unless v6 regression proves it
- 61s delay Mocha timeouts (triage separately if v6 still red)

## Success criteria

- v6 manual export: close-context failures **down ≥ 20** vs v5 (26 baseline).
- v6 pass rate **> 52%**.
- TV5-02: WCP integration tests cover two-app channel delivery before/after routing fixes.
- TV5-03–05: implement only after harness teardown lands **and** FINOS `findIntent` apps[] policy is confirmed (currently **blocked**).

## Architecture / implementation direction

1. **Harness first (TV5-01):** FINOS scenario teardown via `app-control` `closeWindow` → mock close context → `fdc3.close()`; disconnect popups/WCP instances between scenarios; see `conformance-test-failure-review.md` §TB-09.
2. **WCP second (TV5-02):** Extend `wcp-desktop-agent.integration.test.ts` with two host-assigned instance ids; assert `meta.destination.instanceId` on broadcasts.
3. **Agent oracle last (TV5-03–05):** `intent-helpers.ts` merge policy — **blocked** pending FINOS clarification (spec example shows duplicate `appId` rows; toolbox enforces `apps.length === 1`).

## Commands

```bash
nvm use 24
npm test -w @finos/sail-desktop-agent
npm run dev -w @finos/sail-conformance-harness   # :3001 manual toolbox → conformance-report-v6.txt
```

## PRD accuracy gate (2026-06-20 / v3-pre + v5 export)

| ID | Status | Evidence | Work item slug |
|----|--------|----------|----------------|
| TV5-01 | **active** | v5: 26× close-context; stale instances inflate findIntent | `fix-harness-finOs-session-teardown` |
| TV5-02 | **active** | v5: AppTimeout cleared; need two-app WCP channel path | `extend-wcp-channel-delivery-integration-tests` |
| TV5-03 | **blocked** | FINOS apps[] policy ambiguous; v5 findIntent 4 vs 1 may be stale state | `dedupe-findintent-directory-running-apps` |
| TV5-04 | **blocked** | depends TV5-03 policy | `fix-findintent-empty-apps-noappsfound` |
| TV5-05 | **blocked** | depends TV5-04 | `align-raise-intent-throws-v4-matrix` |
| TV5-00 | **active** | coordinates TV5-01–05 | `epic-toolbox-conformance-v5-follow-up` |

## Work item retention

**Policy:** Delivered work item `.md` files are **deleted**; this section is the durable record.

### v4 wave (superseded by this PRD — PRD deleted)

| Slug | Status |
|------|--------|
| `record-toolbox-v4-measured-baseline` | done — work item deleted (TV4-08 in `conformance-test-failure-review.md`) |
| `verify-v4-agent-fixes-on-current-branch` | done — work item deleted (TV4-07 verified in review doc + v5 export) |
| `populate-intent-result-metadata-toolbox` | done — work item deleted |
| `fix-toolbox-metadata-client-and-dacp-paths` | done — work item deleted |
| `diagnose-harness-user-cancelled-resolution` | done — spike complete (v5: 0 UCR) |
| `pre-register-conformance1-pending-instance` | done — work item deleted |
| `harness-popup-wcp-disconnect-cleanup` | done — work item deleted |
| `toolbox-conformance-v4-follow-up` (epic) | done — superseded by TV5-00; work item deleted |

### Burn-down TB-00–TB-09

All delivered — slugs listed in `plans/project-docs.md` **Delivered work index**.
