# FDC3 Toolbox conformance — failure review

Record of discovery against the official FDC3 conformance toolbox (FINOS), comparing two local result dumps and mapping failures to Sail packages.

## Sources

| File | Notes |
|------|--------|
| `conformance-report.txt` | Earlier toolbox run |
| `conformance-report-v2.txt` | After recent PRs/commits — **18 pass / 56 fail**, ~172s |
| `conformance-report-v3.txt` | Clean-room conformance harness run — **15 pass / 45 fail**, ~155s |
| `conformance-report-v4.txt` | Measured harness export — **31 pass / 64 fail**, ~305s, **95 scenarios** |
| `conformance-report-v5.txt` | Post TV4-03/05/06 batch — **53 pass / 49 fail**, ~516s, **102 scenarios** |
| `conformance-appd.json` | Conformance app directory; merged in `packages/sail-web/src/main.tsx` and loaded by `packages/sail-conformance-harness` (desktop-agent-only clean room) |

The toolbox exercises the **full browser stack** (sail-web → SailPlatform / SailAppLauncher → WCP → `@finos/sail-desktop-agent`), not Cucumber’s `MockTransport` path. In-repo BDD coverage is documented in `website/docs/packages/desktop-agent/conformance.md` (~101 `@conformance2.2` scenarios).

## v1 → v2 delta (high level)

**Improved**

- `fdc3.open`: `AOpensB3`, `AFailsToOpenB3`, `AOpensB4` now pass; fewer 20s timeouts on simple open.

**Regressed / new signals**

- `basicRI1`: was passing in v1 → v2 reports `IntentDeliveryFailed`.
- v2 runs more channel scenarios; almost all report `AppTimeout` (v1 showed fewer channel rows).

**Unchanged themes**

- `findIntent` / `findIntentsByContext` shape and error-code mismatches.
- `getAppMetadata` missing `desktopAgent` property.
- Multi-app `AppTimeout` clusters (channels, open-with-context, context metadata).

---

## Attribution summary

| Layer | Share of pain (v3 measured) | v4 measured (95 scenarios) | Confidence |
|--------|-----------------------------|------------------------------|------------|
| **Integration** (web + WCP + launcher `instanceId` lifecycle) | **Largest** — most `AppTimeout`, multi-app channels/open/metadata | **~33 `AppTimeout`** rows — open-with-context, user/app channels, context metadata, GetInfo2 | High |
| **@finos/sail-desktop-agent** | **Real but narrower** — metadata, intent discovery shape, some error codes | **`desktopAgent` (2)**, **`findIntent` apps.length (2)**, **`getResultMetadata` empty (2)**, wrong-context / raiseIntent throws | High for items below |
| **@finos/sail-web** | Launch context dropped, cross-origin iframes, intent UI not automated | Unchanged for harness (:3001); full-stack (:3000) deferral still applies | High |
| **@finos/sail-platform-api** | Launcher pre-assigns `instanceId` that first WCP connect does not bind | Harness uses desktop-agent preset directly; Conformance1 pre-register was missing (fixed in harness bootstrap) | High |

**Takeaway:** Toolbox failures do **not** imply the desktop agent core is largely unimplemented — many APIs are green in BDD. Failures strongly indicate **browser/WCP integration** and **instance identity** gaps between launcher, iframe host, and WCP4/WCP5.

**v3 → v4 measured delta:** v3 = **15 / 45** (60 scenarios). v4 = **31 / 64** (95 scenarios). Passes **+16**, failures **+19**, scenarios **+35**. Category movement below uses committed exports, not projections.

**v4 → v5 measured delta:** v4 = **31 / 64** (95 scenarios). v5 = **53 / 49** (102 scenarios). Passes **+22**, failures **−15**, scenarios **+7** (new `fdc3.intentListenerConflict` pack — all pass). Duration **305s → 516s** (longer runs, including 61s delay scenarios). Primary symptom shift: **`AppTimeout` (33 → 0)** replaced by **`App didn't return close context within 1 sec` (26)** and explicit Mocha timeouts (6).

---

## 1. `@finos/sail-desktop-agent`

### Likely product issues (fix in library)

| Failure (v2) | Likely cause | Resolution direction |
|--------------|--------------|----------------------|
| **getAppMetadata** — `desktopAgent` missing | `convertDirectoryAppToAppMetadata` in `app-handlers.ts` sets `desktopAgent` only when `instanceId` is present; directory-only responses omit it | Always set `desktopAgent` to `implementationMetadata.provider` on `AppMetadata` responses |
| **findIntent** — all “deeply equal” failures | `createAppIntents` in `intent-helpers.ts` uses `displayName: intentName` instead of directory `displayName` (e.g. `"A Testing Intent"` in `conformance-appd.json`) | Map `intentDef.displayName` from app directory |
| **findIntentsByContext** — length 7 vs 6 | Extra `AppIntent` (duplicate intent/app from directory + running listeners) | Dedupe when building `appIntents`; align with conformance app directory |
| **findIntent wrong context** — expected `NoAppsFound`, got `assert.fail()` | Client does not receive `ResolveError.NoAppsFound` for “intent exists, context doesn’t” | Ensure DACP error type propagates on that path |
| **raiseIntent (throws)** — `NoAppsFound` vs `TargetInstanceUnavailable` / generic rejection | Spec expects `NoAppsFound` in some “bad correlation” cases | Align error mapping with FDC3 conformance matrix (see `plans/prd-desktop-agent-conformance-gaps.md` item 7) |
| **findInstances** — missing `AppIdentifier` in array | `handleFindInstancesRequest` only returns instances in agent state; launched-but-not-connected instances may be absent | Tie launch `instanceId` to WCP5 identity (see integration section) |
| **open-with-context** (when not purely timeout) | `registerOpenWithContext` (`open-with-context.ts`) waits on **launcher** `instanceId`; WCP4 `createAppInstance` (`wcp-handlers.ts`) issues a **new UUID** on first connect unless reconnect reuse succeeds | Pre-register instance on launch, or bind host panel id → WCP5 `instanceId` |

### Probably not desktop-agent alone

Mass **`AppTimeout`** on user/app channels, open-with-context, and context metadata. BDD covers broadcast/join/listeners via `MockTransport`. Traceability doc notes: **no `@conformance2.2` WCP path** — `bdd-wcp-integration-scenario` / platform integration still partial.

---

## 2. `@finos/sail-platform-api`

| Issue | Evidence | Resolution direction |
|--------|----------|----------------------|
| **Launcher vs agent instance IDs** | `SailAppLauncher.launch()` generates and returns `instanceId`; WCP4 `createAppInstance` creates `crypto.randomUUID()` unless reconnect reuse (`reconnectInstanceId` + `instanceUuid` in WCP4 payload) | Contract: host-assigned `instanceId` from launcher must become the WCP5 canonical id |
| **Intent resolution bridge** | `SailPlatform.start()` wires `requestIntentResolution` → `WCPConnector` → UI `intentResolverNeeded` | Headless / auto resolver for conformance (single handler → auto-select) |
| **Origin allowlist** | `wireWcp4OriginAllowlist` in `wcp4-origin-allowlist.ts` — optional; sail-web does not wire it today | Only if deployment restricts origins; default allows `fdc3.finos.org` |

---

## 3. `@finos/sail-web`

| Issue | Evidence | Resolution direction |
|--------|----------|----------------------|
| **Launch context ignored** | `main.tsx` `onLaunchApp`: `void context` — context never passed to panel/iframe | Pass context into panel bootstrap or fix agent open-with-context after instance IDs align |
| **Cross-origin conformance apps** | Apps load from `https://fdc3.finos.org/...`; `wcp1-3-handshake.ts` cannot read `window.name` → `hostIdentifier` undefined (`SecurityError`) | Same-origin proxy, bundled conformance apps, or map `connectionAttemptUuid` ↔ panel without `window.name` |
| **Pre-register instance (TODO)** | Comment in `main.tsx`; `FDC3IframePanel` sets `name={panel.panelId}` but agent does not reserve that id at WCP4 | Register pending instance with desktop agent before iframe load |
| **Intent resolver UI** | `intent-resolver-store.ts` opens dialog; toolbox does not click → **UserCancelledResolution** / timeouts | Auto-resolve when one handler; conformance profile with programmatic resolver |
| **Multi-instance panel linking** | `connection-store.ts` falls back to **appId** when `panelId` missing — wrong instance risk | Fix instance id pipeline first; then strict panel ↔ instance mapping |

---

## 4. Failure groups by symptom (v2)

### A. `AppTimeout` (~33 scenarios in v4) — integration first

**Areas:** `fdc3.open` (with context / specific context / multiple listeners), all listed **appChannels** and **userChannels**, **contextMetadata**, **getInfo** `GetInfo2`, parts of **raiseIntent** (“close context”).

**Pattern:** Target app never receives context or listener in time. Consistent with wrong `meta.destination.instanceId`, apps not fully connected, or cross-origin handshake without host correlation.

**Suggested slice:** Open two conformance channel apps; log launcher `instanceId`, iframe `name`, WCP5 `instanceId`, and one user-channel broadcast end-to-end.

### B. Intent discovery / metadata — desktop-agent

- All **findIntent** deep-equal failures  
- **findIntentsByContext** count + wrong error type  
- **getAppMetadata** `desktopAgent` property  

These are good **library-only** fixes with high signal in a re-run.

### C. Intent raise / resolve — mixed

| Test area | Symptom | Primary layer |
|-----------|---------|----------------|
| **RaiseIntentSingleResolve** | No context received | Integration (instance / delivery) |
| **basicRI1** / **intentContextMetadata** | `IntentDeliveryFailed` | Integration + delivery |
| **basicRI2** | `UserCancelledResolution` | sail-web resolver |
| **raiseIntent (throws)** | Error code mismatches | sail-desktop-agent |
| **RaiseIntentVoidResult** | 20s timeout | Integration + result path |

### D. Improved in v2 (keep regression tests)

- **fdc3.open** without context, AppNotFound, open by `appId` + `instanceId`

---

## 5. BDD blind-spot audit (v3)

The traceability map is useful for API-area coverage, but several `covered` rows are not equivalent to the FINOS toolbox oracle. This matrix separates exact field/assertion gaps from MockTransport-vs-WCP/browser gaps and records the regression owner that must close each non-deferred category before the burn-down epic can be treated as complete.

| v3 failure category | Toolbox symptom | Classification | Owner slug | v4 measured | v5 measured | Required regression net |
|---|---|---|---|---|---|---|
| `getAppMetadata` / `AppInstanceMetadata` missing `desktopAgent` | Metadata validator expected `desktopAgent` | Product bug (harness DACP path?) | **`fix-toolbox-metadata-client-and-dacp-paths`** | **Still failing** (2) | **Still failing** (2) | Harness-path Vitest repro |
| `findIntent` deep-equal / apps.length | `AppIntent.apps.length` N vs 1 | Product bug + session hygiene | `dedupe-findintent-directory-running-apps`; **`fix-harness-finOs-session-teardown`** | **2 vs 1** (2 rows) | **4 vs 1** (2 rows) — stale instances | Teardown first, then blocked dedupe |
| `findIntentsByContext` count | length N vs 1 | Product bug + session hygiene | `dedupe-findintent-directory-running-apps`; **`fix-harness-finOs-session-teardown`** | **2 vs 1** (1 row) | **4 vs 1** (1 row) | Same |
| `findIntent` wrong context | `NoAppsFound` vs `assert.fail()` | Product bug | `fix-findintent-empty-apps-noappsfound` | **Still failing** (1) | **Still failing** (1) | Blocked on FINOS clarification |
| `getResultMetadata` on intent results | `expected '' to not equal ''` | Product bug — client API gap | `populate-intent-result-metadata-toolbox` (wire); **`fix-toolbox-metadata-client-and-dacp-paths`** | **2 rows** (+ UCR on siblings) | **4 rows** — delivery passes, metadata API empty | Client API + harness re-run |
| `raiseIntent (Result)` | `UserCancelledResolution` | Mixed harness / agent | `diagnose-harness-user-cancelled-resolution` | **9 rows** | **0 rows** — cleared | Spike done; no Phase 2 |
| `raiseIntent` throws | Wrong error `message` | Product bug | `align-raise-intent-throws-v4-matrix` | **4 rows** | **4 rows** (different messages) | Blocked with findIntent policy |
| `fdc3.open` / channels / metadata | `AppTimeout` | WCP integration | `pre-register-conformance1-pending-instance`; **`fix-harness-finOs-session-teardown`** | **~33 AppTimeout** | **0 AppTimeout**; **26** close-context; **6** Mocha timeout | Grouped harness teardown task |
| `findInstances` | Missing / wrong instanceId | Integration | **`fix-harness-finOs-session-teardown`** | `IntentDeliveryFailed` | **instanceId mismatch** (1 row) | Launcher ↔ WCP5 correlation |
| `intentContextMetadata` traceId | App traceId not forwarded | Product bug | **`fix-toolbox-metadata-client-and-dacp-paths`** | `IntentDeliveryFailed` | **1 row** — antiReplay/traceId | Intent raise event metadata |

---

## 5.1 Spike: harness `UserCancelledResolution` (TV4-06 Phase 1)

v4 reports **9** `UserCancelledResolution` rows under `fdc3.raiseIntent (Result)`. **v5: 0 rows** — void/context/channel/private-channel delivery scenarios pass (including 5s delays). Phase 2 fix task is **not required** for the UCR symptom.

Remaining Result failures in v5 are **`getResultMetadata` empty (4 rows)** and **61s delay Mocha timeouts (2 rows)** — see §5 matrix.

| Symptom | v4 | v5 | Owner |
|---------|----|----|-------|
| Void/context/channel result → `UserCancelledResolution` | 9 rows | **0** | Cleared by harness resolver + delivery fixes |
| `getResultMetadata` empty while result resolves | 2+ rows | **4 rows** | **New task:** wire metadata to FDC3 client `getResultMetadata()` |
| Channel/private-channel → `IntentDeliveryFailed` | 2 rows | **0** | Cleared |
| 61s delayed result scenarios | UCR / fail | **2×** `Timeout of 80000ms exceeded` | Environment/toolbox budget or agent timeout tuning — triage separately |

**Recommended follow-up:** Close spike `diagnose-harness-user-cancelled-resolution` as done. Open **`wire-intent-result-metadata-to-client-api`** — DACP `raiseIntentResultResponse.payload.metadata` is populated (Vitest/Cucumber green) but conformance app `getResultMetadata()` still returns empty.

---

## TB-08 v4 harness re-run — measured baseline (2026-06)

Manual acceptance step for the toolbox-conformance-burn-down epic. v3-pre merged PRs for TB-01 (`desktopAgent`), TB-02 (`displayName`/dedupe), TB-04b (host↔WCP instance bind), and TB-05 (Cucumber raise-intent launch correlation) before this doc update.

### Procedure

1. From repo root: `nvm use 24`, `npm install` (if needed).
2. Start the clean-room harness: `npm run dev -w @finos/sail-conformance-harness`.
3. Open **http://localhost:3001** in a browser (Conformance1 loads automatically).
4. Run the **full FINOS toolbox export** inside Conformance1 (browser UI — not reliable headless in cloud VM).
5. Save export as `conformance-report-v4.txt` at repo root (committed for TV4-08).
6. Update this doc if counts change on the next export.

See `packages/sail-conformance-harness/README.md` for architecture and instance-identity notes.

### Measured v4 summary

| Metric | v3 | v4 | Source |
|--------|----|----|--------|
| Pass | **15** | **31** | `conformance-report-v3.txt` / `conformance-report-v4.txt` |
| Fail | **45** | **64** | same |
| Scenarios | ~60 | **95** | v4 runs full FINOS pack |
| Duration | ~155s | ~305s | same |
| `AppTimeout` | ~35+ | **~33** | grep v4 export |
| `UserCancelledResolution` | — | **9** | raiseIntent Result rows |
| Agent oracle (metadata / findIntent / getResultMetadata) | — | **8+** | see §5 matrix |

### TV4-07 verification (current `v3-pre` code vs v4 export)

| v4 row | Code on branch | Verdict |
|--------|----------------|---------|
| `GetAppMetadata` / `AppInstanceMetadata` missing `desktopAgent` | `convertDirectoryAppToAppMetadata` always sets `desktopAgent: provider` (`app-handlers.ts`) | **Likely stale v4 export or harness DACP path** — Vitest `app-metadata-desktop-agent.test.ts` green; re-run toolbox before re-opening TB-01 |
| `FindIntentAppD*` apps.length 2 vs 1 | `createAppIntents` still merges directory + running rows | **Open product bug** — owner `dedupe-findintent-directory-running-apps` (blocked) |
| `getResultMetadata` empty | No `metadata` on `raiseIntentResultResponse` before TV4-03 fix | **Open product bug** — fixed in `populate-intent-result-metadata-toolbox` |

**Re-run commands (after delivery batch):**

```bash
nvm use 24
npm run dev -w @finos/sail-conformance-harness   # http://localhost:3001
# Run full toolbox export in Conformance1 UI; save conformance-report-v5.txt
```

Targeted Vitest (changed packages only):

```bash
npm test -w @finos/sail-desktop-agent -- intent-result-metadata wcp-desktop-agent.integration
npm test -w @finos/sail-conformance-harness
```

### Post-merge expected category movement (superseded by measured v4 above)

Merged burn-down items on v3-pre; **expected** harness impact pending maintainer v4 export:

| Item | Merged scope | v3 failure categories affected | Expected v4 movement | Status |
|------|--------------|-------------------------------|----------------------|--------|
| **TB-01** | `AppMetadata.desktopAgent` always set from `implementationMetadata.provider` | `getAppMetadata` / `AppInstanceMetadata` | Both metadata rows pass | expected pending v4 export |
| **TB-02** | Directory `displayName` on intents; `findIntentsByContext` dedupe | All `findIntent` deep-equal rows; `findIntentsByContext` count | Deep-equal rows pass; count 7→6 | expected pending v4 export |
| **TB-04b** | Host-assigned launcher `instanceId` → WCP5 canonical id at WCP4 | `fdc3.open` (with/without context), `findInstances`, channel `AppTimeout` cluster, parts of `raiseIntent` delivery | Fewer `AppTimeout`; `findInstances` complete; no-context open (`AOpensB3`, `AOpensB4`) may return to pass | expected pending v4 export |
| **TB-05** | Cucumber launch-via-raiseIntent `uuid-0` correlation | `basicRI1`, `basicRI2`, `RaiseIntentSingleResolve` (BDD + harness delivery) | Cucumber `@conformance2.2` raise-intent scenarios green; harness may show fewer `IntentDeliveryFailed` if instance routing aligns | expected pending v4 export |

**Not claimed without re-run:** whether TB-01/TB-02/TB-04b fixes cleared rows — v4 measured export still shows those failures; see TV4-07 table.

### Raw export policy

`conformance-report-v4.txt` and `conformance-report-v5.txt` are committed at repo root. Record future exports as `conformance-report-v6.txt` (or update v5 only when human requests).

---

## TB-09 v5 harness re-run — measured baseline (2026-06-19)

Post-delivery batch: Conformance1 pre-register, popup `disconnectInstance`, intent result wire metadata, WCP two-app channel Vitest, harness resolver wiring.

### Measured v5 summary

| Metric | v4 | v5 | Δ |
|--------|----|----|---|
| Pass | **31** | **53** | **+22** |
| Fail | **64** | **49** | **−15** |
| Scenarios | **95** | **102** | +7 (`intentListenerConflict` — all pass) |
| Duration | ~305s | ~516s | longer (61s delay cases run) |
| `AppTimeout` | **~33** | **0** | delivery reaches apps |
| `UserCancelledResolution` | **9** | **0** | resolver + delivery fixed |
| `App didn't return close context within 1 sec` | (subset) | **26** | dominant new failure cluster |
| `getResultMetadata` empty | **2** (+ UCR siblings) | **4** | wire fixed; client API not |
| `findIntent` apps.length | **2 vs 1** | **4 vs 1** | stale instances worse across run |

### v5 wins (batch attribution)

| Area | v4 → v5 |
|------|---------|
| `basicRI1`, `basicRI2` | fail → **pass** |
| `fdc3.open` no-context / AppNotFound / wrong-context / `AOpensB4` | improved |
| `raiseIntent (Result)` delivery (void, context, channel, private channel, 5s) | **pass** |
| `RaiseIntentSingleResolve`, `RaiseIntentTargetedAppResolve`, private channel raiseIntent | **pass** |
| `PrivateChannels*` raiseIntent scenarios | **pass** |
| `fdc3.intentListenerConflict` (7 scenarios) | **new + all pass** |
| `IntentContextMetadata` (base scenario) | **pass** |

### TV4-07 re-verification (v5 export)

| Row | v5 verdict |
|-----|------------|
| `desktopAgent` on getAppMetadata | **Still failing** — not stale export; harness or DACP response path omits field despite merged TB-01 |
| `findIntent` apps.length | **Still failing, worse (4 vs 1)** — stale CONNECTED instances from incomplete teardown inflate count |
| `getResultMetadata` | **Still failing (4 rows)** — `populate-intent-result-metadata-toolbox` fixed wire payload only; client `getResultMetadata()` empty |

**Re-run commands:**

```bash
nvm use 24
npm run dev -w @finos/sail-conformance-harness   # http://localhost:3001
# Full toolbox export in Conformance1 UI → conformance-report-v6.txt
npm test -w @finos/sail-desktop-agent -- intent-result-metadata intent-result-handlers wcp-desktop-agent.integration
npm test -w @finos/sail-conformance-harness
npx cucumber-js --profile single test/features/intents/intent-result.feature -w @finos/sail-desktop-agent
```

---

## 6. Work-item coverage vs v5 remaining failures

### Existing queue — still applies (unblock or extend)

| Slug | Status | Fixes v5 rows? | Notes |
|------|--------|----------------|-------|
| `populate-intent-result-metadata-toolbox` | in-progress | **Partial** | Wire metadata on `raiseIntentResultResponse` — done. Toolbox still red until client API wired. |
| `dedupe-findintent-directory-running-apps` | blocked | **Yes (2–3 rows)** when unblocked | v5 count **4** suggests stale instances dominate — teardown may need to land first |
| `fix-findintent-empty-apps-noappsfound` | blocked | **Yes (1 row)** | Depends on dedupe |
| `align-raise-intent-throws-v4-matrix` | blocked | **Yes (~4 rows)** | Depends on findIntent chain |
| `pre-register-conformance1-pending-instance` | in-progress | **Done for v5** | Open tests improved; mark done after approve |
| `harness-popup-wcp-disconnect-cleanup` | in-progress | **Partial** | Popup disconnect helps; **26** close-context failures remain |
| `extend-wcp-channel-delivery-integration-tests` | in-progress | **Regression net only** | Vitest green; toolbox teardown still fails |
| `diagnose-harness-user-cancelled-resolution` | in-progress | **Done** | UCR cleared in v5 — close spike |
| `record-toolbox-v4-measured-baseline` | in-progress | Docs | Extend with v5 (this doc) |
| `verify-v4-agent-fixes-on-current-branch` | in-progress | Docs | TV4-07 updated for v5 |

### New work items (v5 wave — filed)

| Slug | Kind | v5 rows | Scope |
|------|------|---------|-------|
| **`epic-toolbox-conformance-v5-follow-up`** | epic | — | Coordinates v5 → v6 wave |
| **`fix-toolbox-metadata-client-and-dacp-paths`** | task | ~7 | `getResultMetadata` (4), `desktopAgent` (2), intent context traceId (1) |
| **`fix-harness-finOs-session-teardown`** | task | ~30+ | Close-context (26), stale findIntent inflation, open 20s timeouts, findInstances instanceId |

**No new item needed:** TV4-06 Phase 2 (`UserCancelledResolution`) — v5 cleared the symptom; close spike `diagnose-harness-user-cancelled-resolution`.

**Blocked until FINOS:** `dedupe-findintent-directory-running-apps`, `fix-findintent-empty-apps-noappsfound`, `align-raise-intent-throws-v4-matrix` — still own **~6 agent-oracle rows** once unblocked; stale-instance teardown should land first so toolbox counts are trustworthy.

---

## 7. Recommended investigation order

1. **`fix-toolbox-metadata-client-and-dacp-paths`** — `getResultMetadata`, `desktopAgent`, intent context app metadata.  
2. **`fix-harness-finOs-session-teardown`** — close-context, stale instances, open timeouts, findInstances correlation.  
3. **Unblock findIntent policy** with FINOS — then deliver dedupe + NoAppsFound + throws matrix.  
4. **Re-run toolbox** → `conformance-report-v6.txt`.

## 8. Related repo docs

- `website/docs/packages/desktop-agent/conformance.md` — BDD ↔ FDC3 2.2 areas  
- `plans/prd-desktop-agent-conformance-gaps.md` — Planned hardening (cleanup, WCP BDD, error enums)  
- `AGENTS.md` — WCP temp vs canonical ids, testing conventions  

---

## 9. Bottom line

| Question | Answer |
|----------|--------|
| Did the v4 follow-up batch help? | **Yes — +22 passes.** UCR and AppTimeout clusters largely cleared; intent Result delivery mostly green. |
| Is `populate-intent-result-metadata-toolbox` done? | **Partial** — wire yes; client path owned by **`fix-toolbox-metadata-client-and-dacp-paths`**. |
| Are **any** failures still in sail-desktop-agent? | **Yes** — client metadata API, `desktopAgent` on harness path, findIntent shape (blocked), throws matrix (blocked), intent context traceId. |
| Where is most v5 pain? | **Harness session hygiene** (~26 close-context) + **client metadata wiring** (4 rows). |
| Existing queue enough? | **Partially** — v5 wave filed as `epic-toolbox-conformance-v5-follow-up` (2 grouped tasks); blocked findIntent items still apply after teardown + FINOS. |

*Review date: 2026-06-19. Based on measured **v4** and **v5** exports. Re-run procedure in [TB-09 v5](#tb-09-v5-harness-re-run--measured-baseline-2026-06-19).*
