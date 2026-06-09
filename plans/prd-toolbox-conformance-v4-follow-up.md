# PRD: Toolbox conformance v4 follow-up (measured baseline)

## Persona / user

- **Lead maintainer** closing the gap between merged burn-down PRs and the **measured** `conformance-report-v4.txt` export (31 pass / 64 fail).
- **Conformance engineer** extending WCP integration guards where MockTransport BDD cannot catch `AppTimeout` clusters.

## Goal / outcome

Drive harness toolbox pass rate above the v4 baseline by fixing **remaining agent-oracle bugs** proven in v4, extending **WCP multi-app delivery** regression nets for channel/open/metadata timeouts, and recording an **accurate v3→v4 delta** in `conformance-test-failure-review.md`. Success is a v5 export with cleared agent rows (`getAppMetadata`, `findIntent` apps count, wrong-context `NoAppsFound`, `getResultMetadata`) and a **material reduction** in `AppTimeout` / `IntentDeliveryFailed` after WCP delivery tests guide product fixes.

## Relationship to other plans

| Existing plan / artifact | Status | This PRD |
|--------------------------|--------|----------|
| `plans/prd-toolbox-conformance-burn-down.md` | Epic + TB-00–TB-09 **done** | **Extends** — v4 proves burn-down incomplete for toolbox pass |
| `conformance-report-v4.txt` | 31 / 64, 95 scenarios | **Baseline** for success criteria |
| `conformance-test-failure-review.md` | v4 marked "pending export" | **Update** with measured v4 (TV4-08) |
| `plans/completed-work-items/fix-app-metadata-desktop-agent-field.md` | done (#48) | **Verify** — v4 still reports missing `desktopAgent` (TV4-07) |
| `plans/completed-work-items/fix-intent-discovery-displayname-dedupe.md` | done (#47) | **Extends** — v4 still reports `apps.length` 2 vs 1 (TV4-01) |
| `plans/completed-work-items/fdc3-error-enum-boundary-tests.md` | done (#44) | **Extends** — v4 raiseIntent throws + wrong-context findIntent gaps (TV4-02, TV4-03) |
| `plans/completed-work-items/bdd-wcp-integration-scenario.md` | done (#53) | **Extends** — single-path WCP test; no two-app channel delivery (TV4-05) |
| `plans/prd-desktop-agent-conformance-gaps.md` | P1 hardening | **No duplicate** for completed cleanup items |

## Evidence summary (v4 measured)

| Metric | v3 harness | v4 export |
|--------|------------|-----------|
| Pass / fail | 15 / 45 (60 scenarios) | **31 / 64 (95 scenarios)** |
| `AppTimeout` | ~35+ | **~36** (user/app channels, open-with-context, context metadata, GetInfo2) |
| `UserCancelledResolution` | reduced vs sail-web | **~9** (raiseIntent Result — harness has programmatic resolver; investigate) |
| Agent oracle | metadata, findIntent shape | **Still failing:** `desktopAgent`, `AppIntent.apps.length`, wrong-context error, `getResultMetadata` empty |

**Interpretation:** More scenarios ran in v4 (+35). Passes doubled (+16) but failures also rose (+19). Remaining work is **not** "more MockTransport BDD" alone — integration + residual agent bugs.

## In scope

| ID | Summary | Kind |
|----|---------|------|
| TV4-00 | Epic coordinating v4 follow-up delivery order | epic |
| TV4-01 | Dedupe `AppIntent.apps` when directory entry and running instance represent same app | task |
| TV4-02 | `findIntent` / `findIntentsByContext` return `NoAppsFound` when intent matches but context/apps empty (not success + `assert.fail()`) | task |
| TV4-03 | Populate `getResultMetadata` for context/channel/void intent results (toolbox non-empty) | task |
| TV4-04 | Align remaining raiseIntent **throws** error `message` with FDC3 matrix on paths still red in v4 | task |
| TV4-05 | WCP Vitest: two connected apps — user-channel and app-channel broadcast delivery | task |
| TV4-06 | Spike: why harness `UserCancelledResolution` persists despite `createHarnessIntentResolver` | spike |
| TV4-07 | Verify v4 agent fixes on current `v3-pre` + document if export predates merge | task |
| TV4-08 | Record measured v4 baseline and v3→v4 category delta in failure review doc | task |

## Out of scope

- sail-web / full-stack (:3000) resolver and launch-context fixes.
- CI gate running full FINOS toolbox.
- Same-origin proxy of `fdc3.finos.org` apps (unless TV4-06 mandates).
- Re-opening completed P1 cleanup unless regression found in TV4-07.

## Success criteria

- TV4-08: `conformance-test-failure-review.md` cites **31/64** and category counts from `conformance-report-v4.txt` (not "pending").
- TV4-01 + TV4-02: Vitest and Cucumber with `conformance-appd.json` assert toolbox fields; toolbox `FindIntentAppD*`, `FindIntentByContextSingleContext`, `FindIntentAppDWrongContext` pass on re-run.
- TV4-03: `RaiseIntentContextWithMetadataResult` / channel metadata rows pass or move to integration owner with evidence.
- TV4-05: New WCP integration tests fail before fix and pass after `meta.destination.instanceId` / routing fix.
- TV4-06: Written recommendation — agent vs harness resolver vs timeout.
- Re-run toolbox (manual): pass rate **> 33%** and `AppTimeout` count **down ≥ 10** vs v4 (stretch); agent-oracle block cleared.

## BDD scenarios (product-level)

```text
# TV4-01
Given intent-a is in the app directory for aTestingIntent
And a running intent-a instance has registered an intent listener
When a connected app calls fdc3.findIntent({ name: "aTestingIntent", context: { type: "testContextX" } })
Then appIntent.apps has length 1 (directory-only OR instance row, not both for the same appId)

# TV4-02
Given aTestingIntent exists in the directory for testContextX only
When findIntent is called with context type that no handler accepts
Then the promise rejects with error message NoAppsFound

# TV4-03
Given App B resolves a raised intent with a Channel result
When App A calls getResultMetadata on the IntentResult
Then metadata is non-empty and includes DA-generated fields per FDC3 conformance

# TV4-05
Given App A and App B are connected via WCP with distinct canonical instanceIds
When App A joins a user channel and App B broadcasts context on that channel
Then App A listener receives the context within the toolbox timeout budget
```

## Architecture / implementation direction

1. **Agent first (TV4-01–04):** `createAppIntents` in `intent-handlers/intent-helpers.ts` merges directory apps and running listeners — collapse same `appId` when `instanceId` is the only difference. `handleFindIntentRequest` must treat `appIntents[0].apps.length === 0` as `NoAppsFound`. Intent result metadata: trace `IntentResult` / DACP response builders.
2. **WCP second (TV4-05):** Extend `wcp-desktop-agent.integration.test.ts` with two `connectionAttemptUuid` / host-assigned ids; assert broadcast `meta.destination.instanceId`.
3. **Harness investigation (TV4-06):** `packages/sail-conformance-harness/src/intent-resolver-wiring.ts` vs delayed-result scenarios (`5secs`, `61secs`, channel/private channel results).
4. **Baseline hygiene (TV4-07–08):** Confirm v4 export branch/sha; update review doc matrix owners for remaining categories.

## Risks / unknowns

- v4 export may predate merged PRs #47–#49 — TV4-07 may show "re-run only" without code changes.
- TV4-06 may find agent emits `UserCancelledResolution` before resolver runs.
- Channel `AppTimeout` fixes may require harness host correlation beyond agent DACP.

## Commands

```bash
nvm use 24
npm test -w @finos/sail-desktop-agent
npm run dev -w @finos/sail-conformance-harness   # :3001 manual toolbox
```

## Parent context summary

Burn-down epic closed planning for TB-00–TB-09, but **v4 measured 31/64** shows agent dedupe/error/metadata gaps plus **~36 AppTimeout** integration failures. `@conformance2.2` green does not imply toolbox pass. This PRD sequences agent quick wins, WCP two-app delivery tests, harness resolver spike, and documented baseline before the next toolbox export.

## PRD accuracy gate (2026-06-04 / v3-pre + v4 export)

| ID | Classification | Evidence | Work item slug |
|----|----------------|----------|----------------|
| TV4-01 | task | verified-red: v4 `FindIntentAppD` apps.length 2 vs 1; `createAppIntents` pushes directory + running rows | dedupe-findintent-directory-running-apps |
| TV4-02 | task | verified-red: v4 `FindIntentAppDWrongContext` NoAppsFound vs `assert.fail()`; handler only checks `appIntents.length` | fix-findintent-empty-apps-noappsfound |
| TV4-03 | task | verified-red: v4 `getResultMetadata` `''` on context/channel metadata rows | populate-intent-result-metadata-toolbox |
| TV4-04 | task | verified-red: v4 raiseIntent throws wrong `message` (4 scenarios) | align-raise-intent-throws-v4-matrix |
| TV4-05 | task | verified-gap: v4 ~36 AppTimeout; WCP integration test is single-app handshake only | extend-wcp-channel-delivery-integration-tests |
| TV4-06 | spike | verified-red: v4 ~9 UserCancelledResolution; harness claims programmatic resolver | diagnose-harness-user-cancelled-resolution |
| TV4-07 | task | verified-gap: v4 still shows `desktopAgent` missing while `app-handlers.ts` sets provider | verify-v4-agent-fixes-on-current-branch |
| TV4-08 | task | verified-gap: review doc says v4 "pending" | record-toolbox-v4-measured-baseline |
| TV4-00 | epic | coordinates TV4-01–08 | toolbox-conformance-v4-follow-up |
