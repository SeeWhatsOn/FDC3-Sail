# FDC3 Toolbox conformance — failure review

Record of discovery against the official FDC3 conformance toolbox (FINOS), comparing two local result dumps and mapping failures to Sail packages.

## Sources

| File | Notes |
|------|--------|
| `conformance-report.txt` | Earlier toolbox run |
| `conformance-report-v2.txt` | After recent PRs/commits — **18 pass / 56 fail**, ~172s |
| `conformance-report-v3.txt` | Clean-room conformance harness run — **15 pass / 45 fail**, ~155s |
| `conformance-appd.json` | Conformance app directory; merged in `packages/sail-web/src/main.tsx` and loaded by `packages/sail-conformance-harness` (desktop-agent-only clean room) |

The toolbox exercises the **full browser stack** (sail-web → SailPlatform / SailAppLauncher → WCP → `@finos/sail-desktop-agent`), not Cucumber’s `MockTransport` path. In-repo BDD coverage is documented in `packages/sail-desktop-agent/docs/conformance-traceability.md` (~101 `@conformance2.2` scenarios).

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

| Layer | Share of pain | Confidence |
|--------|----------------|------------|
| **Integration** (web + WCP + launcher `instanceId` lifecycle) | **Largest** — most `AppTimeout`, multi-app channels/open/metadata | High |
| **@finos/sail-desktop-agent** | **Real but narrower** — metadata, intent discovery shape, some error codes | High for items below |
| **@finos/sail-web** | Launch context dropped, cross-origin iframes, intent UI not automated | High |
| **@finos/sail-platform-api** | Launcher pre-assigns `instanceId` that first WCP connect does not bind | High |

**Takeaway:** Toolbox failures do **not** imply the desktop agent core is largely unimplemented — many APIs are green in BDD. Failures strongly indicate **browser/WCP integration** and **instance identity** gaps between launcher, iframe host, and WCP4/WCP5.

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

### A. `AppTimeout` (~35+ scenarios) — integration first

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

| v3 failure category | Toolbox symptom | Classification | Existing owner | Required regression net |
|---|---|---|---|---|
| `getAppMetadata` / `AppInstanceMetadata` missing `desktopAgent` | Metadata validator expected `desktopAgent` in both directory and instance metadata | Product bug + BDD assertion blind spot | `fix-app-metadata-desktop-agent-field`; `toolbox-bdd-metadata-assertions` | Cucumber or handler-level assertion for directory-only and running-instance `AppMetadata.desktopAgent`; harness rerun confirms toolbox rows |
| `findIntent` deep-equal failures | `intent.displayName` and app-intent shape differ from `conformance-appd.json` | Product bug + BDD assertion blind spot | `fix-intent-discovery-displayname-dedupe`; `toolbox-bdd-metadata-assertions` | Vitest/BDD using directory display names distinct from intent names; harness rerun confirms all `findIntent` deep-equal rows |
| `findIntentsByContext` count and invalid-context error | Wrong result count for `testContextX`; invalid context rejects as `assert.fail()` instead of `NoAppsFound` | Product bug + error-boundary blind spot | `fix-intent-discovery-displayname-dedupe`; `fdc3-error-enum-boundary-tests` | Deduping regression plus representative DACP rejection tests for `NoAppsFound`; harness rerun confirms count and error rows |
| `raiseIntent` targeted wrong-correlation errors | Expected `NoAppsFound`; observed `IntentDeliveryFailed` or `TargetInstanceUnavailable` | Product bug + error-boundary blind spot | `fdc3-error-enum-boundary-tests` | Table-driven error enum tests for targeted app/instance correlation paths; harness rerun confirms toolbox throws-error rows |
| `fdc3.open` with context / wrong context / multiple listeners | `AppTimeout`; listener never receives expected launch context | MockTransport-vs-WCP integration blind spot | `investigate-launcher-wcp-instance-id`; `bind-host-instance-id-at-wcp4`; `fix-cucumber-raise-intent-launch-correlation` | WCP/host instance-id regression proving launcher id becomes WCP5 canonical id; Cucumber launch+validate slice; harness rerun confirms open-with-context rows |
| `fdc3.open` no-context regressions (`AOpensB3`, `AOpensB4`) | Timeout in v3 harness despite earlier v2 improvement | MockTransport-vs-WCP integration blind spot / harness regression check | `bind-host-instance-id-at-wcp4`; `harness-toolbox-rerun-baseline` | Harness open slice rerun after host-id bind; record whether no-context open returns to passing baseline |
| `findInstances` after opening multiple instances | Returned AppIdentifier array misses at least one instance | MockTransport-vs-WCP integration blind spot | `bind-host-instance-id-at-wcp4`; `bdd-wcp-integration-scenario` | WCP integration test where `fdc3.open` pre-registers/adopts host id and `findInstances()` includes it |
| App/user channel delivery | `ACBasicUsage1` and `UCBasicUsage1` `AppTimeout` | MockTransport-vs-WCP integration blind spot | `bdd-wcp-integration-scenario`; `bind-host-instance-id-at-wcp4` | Browser/WCP or harness-level multi-instance broadcast path; MockTransport BDD remains API-area coverage only |
| `UCContextMetadataOnBroadcast` and `IntentContextMetadata` | `AppTimeout`; toolbox also requires context metadata `source` and `timestamp` when delivered | BDD assertion blind spot + MockTransport-vs-WCP integration blind spot | `context-metadata-conformance-bdd`; `bdd-wcp-integration-scenario` | BDD for ContextMetadata shape on broadcast and intent; WCP/harness rerun for actual browser delivery |
| `basicRI1`, `basicRI2`, `RaiseIntentSingleResolve`, `RaiseIntentVoidResult` | `IntentDeliveryFailed` when launching or resolving target app | MockTransport-vs-WCP integration blind spot | `fix-cucumber-raise-intent-launch-correlation`; `bind-host-instance-id-at-wcp4`; `bdd-wcp-integration-scenario` | Cucumber launch-via-raiseIntent `uuid-0` regression plus WCPConnector integration path; harness rerun confirms delivery/result rows |
| `GetInfo2` timeout | Second getInfo validation times out in harness path | MockTransport-vs-WCP integration blind spot | `bdd-wcp-integration-scenario`; `harness-toolbox-rerun-baseline` | Browser/WCP app bootstrap evidence that each toolbox app connects and can call `getInfo`; harness rerun records remaining attribution |
| sail-web resolver / launch-context issues from v2 full-stack run | `UserCancelledResolution`, ignored launch context, resolver dialog not automated | Platform/web gap outside this agent-harness burn-down | No child item in this workload | Accepted deferral for this PRD scope; compare harness vs full Sail stack before filing separate platform/web follow-up |
| Cross-origin `window.name` / conformance host correlation | Host cannot read toolbox iframe `window.name` for `fdc3.finos.org` apps | Harness/toolbox integration risk; not proven required after host-id bind | `investigate-launcher-wcp-instance-id`; `harness-toolbox-rerun-baseline` | Re-run after WCP4 host-id binding; create follow-up only if v4 still shows cross-origin correlation failure independent of agent id binding |

No new work item is required from this audit. All non-deferred categories above have an existing owner; the manual rerun item must update this matrix with v4 movement rather than re-attributing from scratch.

---

## 6. Recommended investigation order

1. **Instance ID lifecycle** — Log launcher `instanceId`, iframe `name`, WCP5 `instanceId`, and `findInstances()` for two conformance windows.  
2. **Single open-with-context** — One listener on a known instance; verify pending open targets the same id as WCP-connected instance.  
3. **Agent metadata / intent displayName** — Small library fixes; should clear a block of **findIntent** / **getAppMetadata** without web changes.  
4. **Headless intent resolver in sail-web** — Should improve **basicRI** and parts of **raiseIntent** in toolbox.  
5. **Re-run toolbox** — Save as `conformance-report-v3.txt`; compare pass count and remaining `AppTimeout`s.

---

## 7. Related repo docs

- `packages/sail-desktop-agent/docs/conformance-traceability.md` — BDD ↔ FDC3 2.2 areas  
- `plans/prd-desktop-agent-conformance-gaps.md` — Planned hardening (cleanup, WCP BDD, error enums)  
- `AGENTS.md` — WCP temp vs canonical ids, testing conventions  

---

## 8. Bottom line

| Question | Answer |
|----------|--------|
| Are **any** failures in sail-desktop-agent? | **Yes** — AppMetadata `desktopAgent`, intent `displayName`/deduping, resolve error codes, `findInstances` completeness, open-with-context targeting wrong instance id. |
| Is the agent “mostly broken”? | **No** — BDD shows core DACP behavior; toolbox stresses **real WCP + multi-window hosting**. |
| Where is most work? | **Integration:** instance id pipeline, cross-origin conformance hosting, launch context, automated intent resolution. |

*Review date: 2026-06-01. Based on `conformance-report.txt`, `conformance-report-v2.txt`, and `conformance-report-v3.txt` in repo root.*
