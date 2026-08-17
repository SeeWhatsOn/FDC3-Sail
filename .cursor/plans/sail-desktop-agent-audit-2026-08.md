# sail-desktop-agent — audit findings (2026-08-05)

**Scope:** `packages/sail-desktop-agent` on branch `wip/v3-local`.
**Method:** four independent Opus passes, read-only. No files were modified.

- Pass A — test-driven API pollution
- Pass B — FDC3-for-the-Web fidelity, architecture, breadth
- Pass C — dead-code sweep (knip + full-monorepo caller trace)
- Pass D — impossible-state guards and restated types

**This document exists to be verified.** Every claim below carries a `file:line` and, where the claim is "nothing calls this", the search that produced it.

> ### Revision 3 — re-verified 2026-08-14 against `a6c6b62`
>
> **The analysis holds; some of the addresses do not.** Every park-list item was re-checked against
> the current tree and **all of them still exist unchanged**. Two counts were re-counted for real:
>
> - **28 catch-blocks — confirmed exactly 28** (27 near-identical handler-level, plus the
>   dispatcher-level one at `handlers/index.ts:100`).
> - **"14 hand-rolled destinations" — actually 13** in `src/handlers/` today, or 15 if the two sites
>   in `app-connection/wcp/wcp-identity-validation.ts:277,389` are counted. The canonical helper
>   (`dacp-response-utils.ts:67`) is not part of either count. Substance unchanged: still un-deduped.
>
> **Four citations are now dead** because of refactors that landed after 2026-08-05. Anyone working
> from §5.1, §5.6, §6.1, §6.2 or §7 will hit missing files or exports:
>
> | Audit says | Current tree |
> |---|---|
> | `handlers/cleanup.ts` | **renamed** → `handlers/instance-teardown.ts` (`d334d5aa`) |
> | `cleanupDACPHandlers` | **renamed** → `cleanupInstanceDacpState` |
> | `resolveCleanupInstanceId` / `instanceHasCleanupWork` | **renamed** → `resolveTeardownInstanceId` / `instanceHasTeardownWork` |
> | `DACPHandlerContext` (§5.6) | **renamed** → `DACPHandlerParams` (`a9a43d64`) |
> | `pendingIntentPromises` (§6.1, §7) | **gone** — collapsed into `PendingIntent` state fields plus a keyed timeout registry (`b3f1f3c7`). The "per-agent Map side channel" description is no longer accurate. |
>
> **One finding needs re-derivation, not repair.** §6.2 says `handleDisconnect()` "prunes only the
> first store". It now loops **all** instances through `cleanupInstanceDacpState` and also prunes the
> instance-identity WeakMap (`sail-desktop-agent.ts:390-396`); only `AppConnectionRegistry.connections`
> is untouched by that path. The three-store asymmetry may still be real but the stated mechanism is
> not — **re-verify before acting on it.**

> **Revision 2 — 2026-08-05.** An independent reviewer checked the cited claims. **Five findings were overstated or wrong and have been corrected in place**, each marked **CORRECTED**: §8 (`initialState` — Pass B was wrong, and Pass A cited the wrong test file), §4 (the handler-test claim was too broad), §4/§6.3 (`ListenerNotFound` conflated with `ListenerError`, wrong line refs), §3 (`setOnAgentDisconnect` does have a production caller), §5.7 (`recentlyDisconnected` is read). §6.3 WCP2 and §5.3 `logger` were reframed; §6.3 `intentEventUuid` was downgraded. The high-severity items in §9 all survived verification, with narrowed blast radius. **Do not restore the original wording from the artifact version of this audit.**

**Baseline:** 13,255 non-test LOC. `npx tsc --noEmit` on the package exits clean, so every "impossible per the types" claim is one the compiler already accepts.

---

## 1. Verdict

The API is **not** badly polluted by tests. The guardrails held: no `*ForTesting` methods on `SailDesktopAgent`, no `Transport` inside `src/`, mocks confined to `test/`. What leaked in is ~200 LOC across five items.

The **tests are not realistic**, which was the more serious half of the original concern. Roughly 15 handler tests and ~155 Cucumber scenarios exercise fakes that differ from production in ways that matter.

The agent is **functionally complete but not spec-clean**: all 27 DACP request types have handlers, but four wire payloads are off-schema, one error code is invented, one identity field is spoofable, and `fdc3Version` has two competing sources of truth.

Total removable: **~1,150 LOC (~9%)**. The largest single item is not dead code — it is 28 copies of the same catch-block. **That number should not drive sequencing.** The identity and wire-format defects are small, and worth more than the whole cleanup — see §10.

---

## 2. How to verify the "zero callers" claims

Pass C traced all 379 exports, classifying every hit line as re-export / import / real call, across `sail-desktop-agent`, `sail-platform`, `sail-finance`, `sail-one`, `sail-conformance-harness`, `sail-theme`, and `website`.

The per-symbol check used was:

```bash
grep -rn "\bSYMBOL\b" --include=*.ts packages website | grep -v node_modules | grep -v /dist/
```

**`knip` alone is not sufficient, in both directions:**

- It **undercounts** — it scores a barrel re-export as a use. It reports 20 unused exports + 14 unused types; the full trace found **41** dead-or-test-only exports.
- It **produced at least one false positive**: `handleWCP1Hello` (`app-connection/wcp/wcp1-3-handshake.ts:29`, 96 LOC) is reported unused but is imported under an alias at `browser-app-connection.ts:16` and called at `:178`. **Do not delete it.** Treat any knip result as a lead, not a verdict.

`npx knip --workspace packages/sail-desktop-agent` exits 0 and also reports 15 unlisted deps (all `jsdom` in test files — packaging noise) and 1 unresolved import (`./src/__tests__/setup/setup-tests.ts` from `vitest.config.ts`).

---

## 3. Where tests shaped the production API

Paths relative to `packages/sail-desktop-agent/src/` unless stated.

| Item | Location | Non-test callers | LOC | Verdict |
|---|---|---|---|---|
| `replaceDirectoriesInState` — URL validation + `Promise.allSettled` fan-in | `state/mutators/app-directory.ts:129` | 0 (6 test callers) | 70 | **Decide.** Production-grade code alive only via its own tests |
| `TEdge` generic + conditional-tuple constructor | `agent/sail-desktop-agent.ts:75,108-123`; `agent/sail-desktop-agent-types.ts:92-126` | 0 | 55 | **Reshape** |
| `setOnAgentDisconnect` + `handleDisconnect()` | `app-connection/types.ts:26-30`; `agent/sail-desktop-agent.ts:203-205,386-392` | **1 — see correction** | 15 | **Remove, but not free** |
| `getInboundInstanceId()` + its consumer branch | `handlers/types.ts:59-60`; `handlers/utils/dacp-response-utils.ts:90-92`; `app-connection/wcp/wcp-identity-validation.ts:367-378` | 0 | 17 | **Remove** |
| 7 optional members on `AgentAppConnection` that `BrowserAppConnection` fully implements | `app-connection/types.ts:31-67` | required in production | 10 | **Reshape** |
| 6 zero-caller symbols + `wcp/index.ts` barrel (0 importers) | see §5 | 0 | 55 | **Remove** |

### Detail worth checking yourself

**`TEdge`** — `grep "SailDesktopAgent<"` hits only `.test.ts`, `test/`, `__tests__/`, `.harness.ts`. Critically, **no test uses the narrowed type either**: `grep` for `.appConnection.{receiveMessage,getMessagesByType,sentMessages}` returns 0 hits. `createDesktopAgentWithTestConnection` already returns `connection` separately and every test uses that. Collapsing it is a zero-line test diff.

**`getInboundInstanceId()`** — the production dispatcher `createDacpResponseDispatcherFromDelivery` hardcodes `return null` (`dacp-response-utils.ts:90-92`). Only `test/support/transport.ts:49` returns a value. Therefore the `if (instanceId)` branch at `wcp-identity-validation.ts:368-377` is **unreachable in production**; production always takes the `fallbackResponse` path. Flagged independently by passes A, B and C.

**`setOnAgentDisconnect`** — **CORRECTED.** The original "0 non-test callers" was wrong. Production *does* call it, optionally, in `SailDesktopAgent.bindEdgeCallbacks` at `agent/sail-desktop-agent.ts:203`:

```ts
this.appConnection.setOnAgentDisconnect?.(() => {
  this.handleDisconnect()
})
```

The accurate statement is: **there is a production caller but no production implementor.** `BrowserAppConnection` does not implement the method, so the optional call is a no-op in the browser; the only implementor is `test/support/dacp-test-app-connection.ts:42`, and Cucumber reaches it via `connection.disconnect()`. That still makes it test-shaped surface, but **removal is not free** — it needs a Cucumber shutdown replacement first. The replacement is straightforward: loop `Object.keys(agent.getState().instances)` calling `agent.disconnectInstance(id)`, the same path WCP6 goodbye and heartbeat timeout use, which covers *more*, not less. Sequence the replacement before the removal.

**Ten exports have only test callers** (~146 LOC total):

| Export | file:line | test callers | LOC |
|---|---|---|---|
| `replaceDirectoriesInState` | `state/mutators/app-directory.ts:129` | 6 | 70 |
| `retrieveApps` | `app-directory/app-directory-queries.ts:87` | 1 | 18 |
| `getInstancesWithIntentListener` | `state/selectors/intent.ts:24` | 2 | 12 |
| `getStats` | `state/selectors/stats.ts:10` | 2 | 11 |
| `clearAllPendingIntentTimeoutsForTesting` | `handlers/intents/intent-pending-timeout-registry.ts:32` | 1 | 7 |
| `clearAllPendingOpenWithContextTimeoutsForTesting` | `handlers/utils/open-with-context.ts:24` | 8 | 7 |
| `getInstancesByState` | `state/selectors/instance.ts:26` | 1 | 7 |
| `clearAllHeartbeatTimersForTesting` | `handlers/heartbeat/runtime.ts:26` | 19 | 6 |
| `getActiveHeartbeatTimerCount` | `handlers/heartbeat/runtime.ts:16` | 27 | 4 |
| `getPendingOpenWithContextTimeoutCount` | `handlers/utils/open-with-context.ts:19` | 4 | 4 |

Only `replaceDirectoriesInState` is worth arguing about. The rest are 4–18 LOC leak detectors — see §7 for why they stay.

`state/selectors.ts` (5 LOC) exists solely to re-export the barrel plus `getInstancesWithIntentListener`, which is itself test-only. Delete the selector, delete the file.

---

## 4. Tests that can pass while production is broken

This is the finding that matters most.

| Test surface | Why it can be green while the shipped path is broken |
|---|---|
| ~~~15 handler tests via `createDACPTestContext`~~ **CORRECTED — overstated** | The two dispatchers were compared line by line (`test/support/transport.ts:37-53` vs `handlers/utils/dacp-response-utils.ts:75-97`). `sendToInstance` and `sendOutbound` are **identical** — both apply `withDestinationRouting` the same way. The *only* difference is `getInboundInstanceId()`. So general handler behaviour (broadcast, intents, channels) is faithfully covered. The blind spot is narrow: **the WCP5-failure routed-response branch only**, at `app-connection/wcp/wcp-identity-validation.ts:367-378` |
| ~155 `@fdc3_2.2` Cucumber scenarios on `DacpTestAppConnection` | `setOnInstanceTeardown` (`test/support/dacp-test-app-connection.ts:37`) and `pruneAppConnection` (`:54`) are **explicit no-ops**. Any `AppConnectionRegistry` MessagePort leak is structurally invisible to BDD. `AGENTS.md` already concedes green BDD does not prove browser WCP |
| `applyDesktopAgentStateUpdate` (`test/support/agent-state.ts:31`) + `asInternals` casts at `src/__tests__/desktop-agent-user-channels.test.ts:50` and `src/app-directory/__tests__/app-directory-agent-state.test.ts:26` | Writes `agent.state` through a cast past `private`. Fixtures can build states no DACP handler can produce, so hardening tests may guard impossible inputs while reachable ones go untested |
| `wcp-identity-validation` WCP5-failure tests | Assert the `if (instanceId)` routed-response path. Production takes `fallbackResponse` 100% of the time |
| `intents-shape.contract.test.ts:13` | Namespace-imports `selectors/stats` to assert a shape nothing in the product reads |

**Coverage holes:** 17 feature files, ~155 scenarios. **WCP1, WCP2, WCP3, WCP6 and heartbeat have no BDD scenario at all** (the heartbeat `Given` step is orphaned — defined, used by no feature).

**CORRECTED — the original doc grouped two different things and cited wrong line numbers.** Only one feature pins an off-schema code:

| Feature | Line | Code asserted | Status |
|---|---|---|---|
| `test/features/context/event-listeners.feature` | **78, 84** | `ListenerError` | **Invented.** Not in `@finos/fdc3` `ChannelError`. This is the one to fix |
| `test/features/channels/private-channel.feature` | **130, 140** | `ListenerNotFound` | ~~**Sanctioned** by `AGENTS.md:63`~~ — **superseded 2026-08-07.** The carve-out was reopened; the value is now `ChannelError.InvalidArguments` (`sail-da-test-suite-realignment.md` slice 1) |

The original doc cited `62,74` and `122,133` and implied both were locking in defects. Wrong on both counts.

---

## 5. Dead weight, ranked (~1,150 LOC)

| # | Item | LOC | Risk |
|---|---|---|---|
| 1 | Handler catch-block boilerplate, **28 copies** | ~200 | low, mechanical |
| 2 | 14 inline `withDestinationRouting` re-implementations + 3 duplicate event builders | ~140 | low |
| 3 | **31 exports with zero callers anywhere** (not even tests) | ~210 | low |
| 4 | Private-channel listener add/remove mutators, 9–10 clones | ~115 | low |
| 5 | Two parallel intent-resolver type families + 3rd alias layer + mappers | ~85 | medium |
| 6 | `raiseIntent` vs `raiseIntentForContext` cloned flows, 4 segments | ~75 | medium |
| 7 | `TEdge` generic ceremony | ~55 | low |
| 8 | Impossible-state guards (see §5.4) | ~55 | low |
| 9 | Passthrough indirection incl. a byte-identical duplicate method | ~80 | low |
| 10 | Dead files: `host-contracts/channel-control.ts`, `dacp/index.ts`, `app-connection/wcp/index.ts`, `state/selectors.ts` | ~70 | low |
| 11 | Agent-config shape declared 3× | ~35 | low |
| 12 | Double existence-guard in 13 private-channel mutators | ~26 | low |
| 13 | `recentlyDisconnected` map + sweeper + 30s interval | ~40 | **medium — see §5.7, not a free delete** |
| 14 | Never-set config options | ~40 | low |

### 5.1 The 31 zero-caller exports (~210 LOC)

State layer dominates. These are re-exported from `state/mutators/index.ts` and `state/selectors/index.ts`, and **nobody imports them from the barrel either**.

Mutators: `addPrivateChannel` (`state/mutators/instance.ts:115`), `removePrivateChannel` (`:131`), `updateInstanceActivity` (`:54`), `setIntentListenerActive` (`state/mutators/intent.ts:57`), `updateIntentListenerActivity` (`:49`), `removeDirectoryUrl` (`state/mutators/app-directory.ts:109`), `clearDirectoryUrls` (`:119`), `removeAppChannel` (`state/mutators/channel.ts:31`), `clearChannelContexts` (`:63`).

Selectors: `getInstancesWithContextListener` (`state/selectors/instance.ts:34`), `getInstancesWithPrivateChannel` (`:44`), `getListenersForContextType` (`state/selectors/intent.ts:43`), `getIntentListener` (`:10`), `getListenersForApp`, `getAllPendingIntents`, `getChannelContextTypes` (`state/selectors/channel.ts:67`), `hasChannelContext` (`:73`), `getAllAppChannels`, `getAllPrivateChannels`, `getEventListenersForInstance` (`state/selectors/event.ts:20`), `getAllEventListeners`, `getAllHeartbeatStates`.

Non-state: `mergeBroadcastAppMetadata` (`dacp/dacp-message-creators.ts:51`, 17 LOC), `createPrefixedLogger` (`logging/logger.ts:51`), `noopLogger` (`:41`), `retrieveAppsByUrl` (`app-directory/app-directory-queries.ts:106`), `ErrorOnCloseError` (`errors/fdc3-errors.ts:204`), `FDC3CloseError` (`:191`), `CloseError.ApiTimeout` enum member (`:188`), `getPendingWcpSourceWindowForTesting` (`app-connection/wcp/pending-source-window.ts:38`), `getInstanceIdentityCountForTesting` / `hasInstanceIdentityForTesting` (`app-connection/wcp/instance-identity-registry.ts:24`/`:29`), `getActivePendingIntentTimeoutCount` (`handlers/intents/intent-pending-timeout-registry.ts:27`), `SailDesktopAgent.exportState()` (`agent/sail-desktop-agent.ts:517`), `SailDesktopAgent.getIsStarted()` (`:521`).

Note: `noopLogger` and `createPrefixedLogger` are exported from the **public** `src/index.ts:50-51`. No consumer package or website doc uses either.

Also dead: `export { cleanupDACPHandlers } from "./cleanup"` at `handlers/index.ts:187` — all 3 real callers import from `../handlers/cleanup` directly.

### 5.2 Speculative abstractions

| Item | file:line | Implementations |
|---|---|---|
| `ChannelControl` + `ChannelSelectionRequest` | `host-contracts/channel-control.ts:1-53` (whole file) | **ZERO** monorepo-wide, yet exported from public API at `host-contracts/index.ts:27` and documented in 4 website files |
| `SendDACPResponseOptions` option bag | `handlers/utils/dacp-response-utils.ts:8-22` | wraps a 1-line call, used at 40 sites |
| `AppConnectionDelivery` | `app-connection/types.ts:13-15` | 1-method interface, 1 impl |
| `asAppConnectionHostLookup` duck-typing | `app-connection/wcp/wcp-host-identifier.ts:14-22` | 1 call site, same file |

`ChannelControl` is already an open question in `.cursor/plans/sail-desktop-agent-feature-decisions.md` §1. This audit does not pre-empt that decision — it only confirms the caller count is still zero.

**Doc bug:** `website/docs/architecture/overview.md:169` documents a `channelSelector?: ChannelControl` constructor option that **does not exist** in `SailDesktopAgentOptions`.

### 5.3 Config options no consumer sets

Only **3 real construction sites** exist monorepo-wide: `sail-one/src/state/sail-host.ts:129`, `sail-finance/src/main.tsx:110`, `sail-conformance-harness/src/harness-bootstrap.ts:156`. `sail-platform` and `sail-theme` never touch the Desktop Agent.

**Three knobs that silently do nothing:**

| Option | Declared | Behaviour |
|---|---|---|
| `appConnectionOptions.logger` | `app-connection/wcp/wcp-types.ts:150` | **Dead knob, not a logging bug.** The constructor deliberately overwrites it with the agent `logger` at `agent/sail-desktop-agent.ts:152-157` — that is host-logger threading, required by `AGENTS.md`. Logging works; setting the nested option just has no effect. Remove the option, keep the threading |
| `appConnectionOptions.debug` | `app-connection/wcp/wcp-types.ts:144` | written at `browser-app-connection.ts:100`, **never read** |
| `appConnectionOptions.intentResolutionTimeout` | `app-connection/wcp/wcp-types.ts:138` | never overridden → derived timeout at `sail-desktop-agent.ts:222` is **always 59,000** and the `??` at `:216` is dead |

Also never set: `channelChangeTimeoutMs` (`agent/sail-desktop-agent-types.ts:89`, default `10_000` — collapse to a constant); `implementationMetadata.optionalFeatures` (`agent/default-config.ts:21` — makes the nested spread at `:69-72` dead); `intentResolverUrl` / `channelSelectorUrl` (`wcp-types.ts:87/95`, only in hand-built `Required<>` literals in 2 unit tests).

### 5.4 Impossible-state guards (~55 LOC)

All verified against the declared types; the package typechecks clean. `noUncheckedIndexedAccess` is **absent** from `tsconfig.root.json`, which is load-bearing for several of these.

- **Double existence-guard in 13 private-channel mutators** — `state/mutators/private-channel.ts:49-57, 70-75, 139-146, 161-168, 181-187, 198-205, 218-224, 235-242, 255-261, 271-277, 288-295, 308-314, 325-331`. Each guards the key on `state`, then re-guards the same key on the immer `draft` of that same state. `produce(state, draft => …)` proxies the same object graph. The codebase's own convention proves it unnecessary: `state/mutators/instance.ts:46-51, 75-80` do the outer guard then write directly.
- **WCP4 `connectionAttemptUuid` guarded three times** — `app-connection/wcp/wcp-identity-validation.ts:209-218` hand-widens a required `string` to `string | undefined` so two impossible guards compile; `:338-350` `sendFailureResponse` takes it optionally though all five call sites (`:82,:92,:106,:120,:288`) pass the required field. The sole production caller (`agent/sail-desktop-agent.ts:361-365`) already early-returns on a falsy value.
- **App-directory shape re-validated against its own type** — `IntentDefinition.contexts: string[]` is required (`app-directory/types.ts:88-97,148-151`), so every `typeof … !== "object"`, `!("contexts" in …)` and `Array.isArray(intentDef.contexts) ? … : []` false-branch is dead: `handlers/intents/intent-helpers.ts:183,185,186,192,267,269,279,281,283,365`; `handlers/intents/intent-directory-helpers.ts:16,22,25`; `app-directory/app-directory-queries.ts:20`.
- **`typeof x !== "string"` on params declared `string`** — `state/mutators/app-directory.ts:58,134,165-168`; `app-directory/app-directory-queries.ts:107`.
- **Dead `??` and unreachable `else` on a closed union** — `handlers/private-channels/handlers.ts:184,198-202,205-206`. `listenerType` is already narrowed non-null; all three union members are handled above the `else`.
- **`?.` / `??` / `||` on non-optional fields** — `handlers/broadcast/handlers.ts:444-450` (3 impossible reads in a debug block); `handlers/open/handlers.ts:50`; `app-directory/app-directory-queries.ts:112`; `errors/fdc3-errors.ts:72,82-86`; `app-connection/wcp/pending-source-window.ts:26-29`; `app-connection/app-connection-registry.ts:94`.
- **Log-then-rethrow with a byte-identical message** — `state/mutators/app-directory.ts:99-106`. `logDirectoryLoadFailure` (`app-directory/fetch-app-directory.ts:102-111`) formats exactly the string then thrown. The wrapped error was already wrapped once at `fetch-app-directory.ts:72-76`, so the URL appears three times.

**Caveat to weigh:** the app-directory checks operate on data fetched from remote JSON. The `!x` nullish halves are legitimate runtime distrust — only the `typeof` / `in` / `Array.isArray` halves are provably dead, and they do not run at the trust boundary.

**Good hygiene noted:** no pure-rethrow `catch (e) { throw e }` exists in non-test src. The two rethrows (`app-connection/message-port.ts:112-117`, `app-connection/wcp/wcp-host-identifier.ts:37-41`) both add real behaviour first.

### 5.5 Passthrough indirection

**Inbound (7 hops, 2 add nothing):**
```
MessagePort.onMessage
  -> bridgeAppPort                    app-connection/wcp/wcp-message-routing.ts:44
  -> onAppMessage closure             browser-app-connection.ts:337       <- adds nothing
  -> forwardAppMessage                browser-app-connection.ts:317-325   <- null check only
  -> appMessageHandler
  -> SailDesktopAgent.handleMessage   agent/sail-desktop-agent.ts:301
  -> routeDACPMessage                 handlers/index.ts:22
  -> handleDACPMessage                handlers/index.ts:113-129           <- map lookup only
  -> handler
```

**Outbound (6 hops, 2 add nothing):**
```
handler
  -> sendDACPResponse                 handlers/utils/dacp-response-utils.ts:20  <- pure passthrough, 40 call sites
  -> dispatcher.sendToInstance        handlers/utils/dacp-response-utils.ts:82
  -> closure                          agent/sail-desktop-agent.ts:396-398       <- adds nothing
  -> connectionRegistry.sendToAppInstance  app-connection/app-connection-registry.ts:35
  -> sendOnPort                       app-connection/app-connection-registry.ts:63
  -> transport.send
```

The **state write path is clean**: `handler -> context.setState(cb) -> SailDesktopAgent.setState` (`agent/sail-desktop-agent.ts:425-427`).

**Byte-identical duplicate method** (verified with `diff`): `BrowserAppConnection.disconnectApp` (`browser-app-connection.ts:244-252`) and `BrowserAppConnection.pruneAppConnection` (`:286-294`). 9 LOC.

Other pure delegations in `browser-app-connection.ts`, each `fn(this.getConnectionContext(), args)`: `handleWCP6Goodbye:232`, `cleanupStaleDisconnects:236`, `disconnectAppByInstanceId:240`, `updateConnectionMetadata:269`, `getConnections:273`, `getConnection:277`, `resolveHostIdentifierForSource:282`, `resolveIntentSelection:313`. Plus `sendToAppInstance(_instanceId, message)` at `:132-134`, which **discards its first parameter** — routing comes from `meta.destination` only. Its one caller (`sail-conformance-harness/src/harness-browsing-context-close.ts:137`) already sets `meta.destination`.

`resolveWcpHandshakeHostIdentifier` (`app-connection/wcp/wcp-identity-validation.ts:391-396`) is a pure rename of `resolveAndPersistConnectionHostIdentifier`.

### 5.7 `recentlyDisconnected` — CORRECTED

The original doc said "written, never read". **That is wrong.** The map is read:

- `app-connection/wcp/wcp-connection-management.ts:117` — `for (const [id, entry] of context.recentlyDisconnected.entries())`, a TTL sweep on `disconnectedAt`
- `:229-230` — `.delete(tempInstanceId)` / `.delete(actualInstanceId)` on WCP5 remap

Accurate statement: **the stored `metadata` is never consumed for reconnect restore; the map is bookkeeping plus a TTL sweep.** That distinction matters, because *not* restoring from it is a deliberate fix — `AGENTS.md:163` says "On WCP5 remap to an existing validated `instanceId`: do **not** `Object.assign` restore from `recentlyDisconnected`" — and `app-connection/__tests__/wcp-reconnect-clobber.test.ts:123,333` are anti-restore regression tests guarding exactly that.

So removing the map means removing the write, the sweep, the 30s interval **and** those guard tests. Defensible, but it is a design decision about whether the bug class should be removed structurally, not a free dead-code delete. **Park it** (see §10).

### 5.6 Types that restate other types

**Largest: two parallel intent-resolver families in one file, plus a third alias layer (~85 LOC).**

`host-contracts/intent-resolver.ts` declares the same four concepts twice:

| DA-facing (A) | Host-UI-facing (B) | Difference |
|---|---|---|
| `IntentHandler` `:13-25` | `HostIntentResolverHandler` `:119-122` | A = `{app: AppMetadata, intent, instanceId?, isRunning}`; B = `AppMetadata & {isRunning}`. `AppMetadata` already carries `instanceId` |
| `IntentResolutionChoice` `:34-40` | `HostIntentResolverChoice` `:130-136` | **identical** |
| `IntentResolutionRequest` `:45-65` | `HostIntentResolverPayload` `:143-158` | **field-for-field identical** except `context: Context` vs `context: unknown` |
| `IntentResolutionResponse` `:70-79` | `HostIntentResolverResponse` `:165-174` | differ |

The cost is the translation layer they force: `agent/sail-desktop-agent-controllers.ts:106-113` (`mapHandler`), `:115-123` (`mapChoice`), and `:329-342` rebuilding the request field-by-field from an identically-shaped payload.

**Third layer, and a name collision:** `handlers/intent-resolution-callback.ts:18,21,34` re-alias family B under family A's names:
```ts
export type IntentHandlerOption      = HostIntentResolverHandler
export type IntentResolutionChoice   = HostIntentResolverChoice    // collides with intent-resolver.ts:34
export type IntentResolutionResponse = HostIntentResolverResponse
```
`IntentResolutionChoice` therefore means one shape at `handlers/intents/intent-resolver-helpers.ts:12` and a **different** shape at `agent/sail-desktop-agent-controllers.ts:26`. A fourth `IntentResolutionRequest` is declared at `sail-conformance-harness/src/types.ts:9`. Only `handlers/intent-resolution-callback.ts:29-31` earns its keep (narrows `context: unknown` → `Context`).

**Agent-config shape declared three times (~35 LOC):** `SailDesktopAgentBaseOptions` (`agent/sail-desktop-agent-types.ts:29-90`), `SailDesktopAgentConfig` (`:135-150`), and `DACPHandlerContext` (`handlers/types.ts:70-144`) restate the same ~9 fields, defaults and `@defaultValue` docs. `SailDesktopAgentConfig` is mechanically derivable via `Pick` + `Required` from the base.

**`DirectoryIntent` carries the intent name twice (~12 LOC):** `DirectoryAppIntent` (`app-directory/types.ts:106-109`) adds `name: string`; `DirectoryIntent` (`:195-200`) adds `intentName` and `appId`. `app-directory-queries.ts:24-26` sets both from the same value. `DirectoryAppIntent` has exactly one referent — `DirectoryIntent` — and nothing reads `.name` off a `DirectoryIntent`.

**Pure local aliases (~10 LOC):** `app-connection/wcp/wcp-identity-validation.ts:33-35` (3 aliases); `app-connection/wcp/wcp-types.ts:10-11`; `dacp/dacp-message-creators.ts:9`; `app-directory/types.ts:74-78` (`Screenshot = Image`, with a 4-line doc explaining it is the same as `Image`).

**`DacpOutboundMessage` re-spelled inline ×4:** named at `handlers/types.ts:36-39`, then written longhand at `app-connection/app-connection-registry.ts:63-66` and `:113-115`, `app-connection/wcp/wcp-types.ts:59-61`, and a 2-member subset at `handlers/utils/dacp-response-utils.ts:10`.

**Duplicated doc comment:** `handlers/types.ts:13-18` and `:19-22` carry the same 4-line comment; the first is attached to `IntentRequestType`, which it does not describe.

---

## 6. Architecture and FDC3 conformance

### 6.1 Actual flow, with divergences marked

```
app (iframe/popup)  @finos/fdc3 getAgent()
  |  window.postMessage / MessagePort
  v
BrowserAppConnection (app-connection/)
  wcp1-3-handshake.ts    WCP1 -> WCP3Handshake
    (A) fdc3Version read from AppConnectionOptions, NOT implementationMetadata
    (B) WCP2LoadUrl never implemented anywhere
  bridgeAppPort()  validate raw -> strip meta.source/messageOrigin -> stamp trusted
    (C) meta.hostInstanceId is NOT stripped
  AppConnectionRegistry     instanceId -> MessagePort    <- 2nd instance store
  instanceIdentityRegistry  (WeakMap)                    <- 3rd instance store
  recentlyDisconnected      Map                          <- (D) metadata unused for restore;
                                                                map is bookkeeping + TTL only
  |  onAppMessage(enriched)                    ^ connectionRegistry.sendToAppInstance()
  v                                            |
SailDesktopAgent (agent/)   this.state : AgentState
  handleMessage -> WCP4/WCP6 switch | routeDACPMessage(msg, createHandlerContext())
    (E) appConnection.bindAgentState() -> the EDGE writes state.wcpHandshakeRouting
  |
  v
handlers/  HANDLER_MAP: 27/27 DACP request types + closeRequest (3.0)
  every handler: getState() -> mutator via setState() -> responses.*
  OK: zero inline state spreads outside state/mutators -- the state layer holds
    (F) 14 sites hand-roll meta.destination + sendOutbound instead of sendToInstance
    (G) identity resolved 2 ways: resolveDacpHandlerInstanceId (5 handlers)
        vs raw context.instanceId (22 handlers)
  |
  v
state/ AgentState                    SIDE CHANNELS around AgentState (module-global):
  instances / intents /                heartbeatIntervals             heartbeat/runtime.ts:14
  channels{user,app,private,contexts}  pendingIntentTimeoutHandles    .../registry.ts:6
  events / heartbeats / open /         pendingOpenWithContextTimeouts open-with-context.ts:17
  appDirectory / wcpRouting            contextSequence (in state/!)   mutators/channel.ts:11
                                       pendingIntentPromises (per-agent Map)
```

**The state/handler/protocol split is real** — zero inline state spreads outside the mutator layer. The divergences are (A)–(G) above.

### 6.2 Domain nouns are not modelled consistently

| Noun | Shape | Inconsistency |
|---|---|---|
| apps | `instances: Record<id, AppInstance>` + `appDirectory.apps: DirectoryApp[]` | catalog is an **array**, everything else a Record |
| intents | `{listeners: Record, pending: Record}` | consistent |
| channels | user/app = `BrowserTypes.Channel`; private = `PrivateChannelState` (14 fields) | **modelled twice.** User/app listeners on `AppInstance.contextListeners`, private on `PrivateChannelState.contextListeners`. Last context: `channels.contexts[id][type]` (`StoredContext` with seq+source) vs `PrivateChannelState.lastContextByType` (bare `Context`) |
| context types | not modelled | bare strings on listeners, `"*"` sentinel |

**Instance identity lives in three stores** — `AgentState.instances`, `AppConnectionRegistry.connections`, `instanceIdentityRegistry` WeakMap — plus a write-only fourth (`recentlyDisconnected`). Nothing enforces agreement. `cleanupDACPHandlers` prunes all three by hand (`handlers/cleanup.ts:122-130`); `SailDesktopAgent.handleDisconnect()` (`agent/sail-desktop-agent.ts:386-392`) prunes only the first.

### 6.3 FDC3 coverage

All 27 `BrowserTypes` request types have handlers (`handlers/index.ts:137-181`) plus `closeRequest`. Nothing is missing.

| Surface | Status | file:line | Gap vs spec |
|---|---|---|---|
| `broadcast` | full | `handlers/broadcast/handlers.ts:39` | — |
| `addContextListener` | full | `handlers/broadcast/handlers.ts:152` | — |
| `contextListenerUnsubscribe` | partial | `handlers/broadcast/handlers.ts:274`; `errors/fdc3-errors.ts:177` | ~~returns `"ListenerNotFound"`, not in `ChannelError` 2.2/3.0 — `AGENTS.md:63` records this as a deliberate choice~~ — **superseded 2026-08-07:** now returns `ChannelError.InvalidArguments` |
| `joinUserChannel` / `leaveCurrentChannel` / `getUserChannels` | full | `handlers/channels/handlers.ts:94/148/179` | — |
| `getCurrentChannel` | full | `handlers/channels/handlers.ts:27` | fabricates `{id, type:"user"}` at `:57-60` when id absent, instead of `null` |
| `getOrCreateChannel` | full | `handlers/channels/handlers.ts:257` | `AccessDenied` on user-channel id (`:273`) and private-channel id (`:279`) — satisfies the normative MUST |
| `getCurrentContext` | partial | `handlers/channels/handlers.ts:209` | always `null` for private channels (broadcast skips `storeContext`, `:101`); no channel-existence check → success+`null` for unknown id |
| `createPrivateChannel` + `onAddContextListener` / `onUnsubscribe` / `disconnect` | full | `handlers/private-channels/handlers.ts:31/337/414/88` | — |
| PC `onDisconnect` event | partial | `handlers/private-channels/handlers.ts:472-476` | emits `contextType` + `instanceId`; schema defines **only** `privateChannelId` |
| `raiseIntent` / `raiseIntentForContext` | full | `handlers/intents/intent-raise-intent.ts:33`; `…-for-context.ts:108` | `raiseIntent` allows `payload.context === undefined` (`:43`) then casts to `Context` (`:70`); schema marks it required |
| `addIntentListener` | full | `handlers/intents/intent-listener-handlers.ts:42` | `IntentListenerConflict` (3.0) present |
| `intentResultRequest` | partial | `handlers/intents/intent-result-handlers.ts:62` | required `intentEventUuid` **never read** (`:76`); correlation is `raiseIntentRequestUuid` only. **Downgraded:** the original "a stale intentEvent's result is accepted" asserted an exploit without a path. Correlation is 1:1 on `raiseIntentRequestUuid` today, so this is an unvalidated required field — a latent hazard, not a demonstrated bug |
| `findIntent` / `findIntentsByContext` | full | `handlers/intents/intent-discovery-handlers.ts:15/66` | — |
| `open` | partial | `handlers/open/handlers.ts:90` | `OpenError.ResolverUnavailable` never emitted — string absent from the package |
| `findInstances` | partial | `handlers/open/handlers.ts:198` | catch-all at `:237` returns `OpenError.AppNotFound`, outside the `FindInstancesErrors` union |
| `getAppMetadata` / `getInfo` | full | `handlers/open/handlers.ts:290/26` | — |
| `fdc3.close` (3.0) | full | `handlers/open/handlers.ts:403` | version-gated at `:411` |
| `addEventListener` (2.2) | partial | `handlers/events/handlers.ts:21` | invented `"ListenerError"` at `:31,49,80,109,125` — **not covered by the `AGENTS.md` carve-out** |
| `channelChangedEvent` | partial | `handlers/channels/handlers.ts:393-400` | sends `{channelId, newChannelId, identity}`; schema wants `currentChannelId`. `channelId`/`identity` are not schema fields |
| heartbeat | full | `handlers/heartbeat/handlers.ts:37` | `heartbeatEvent` carries `eventId`; `HeartbeatEventPayload` is `{}` |
| WCP1Hello | partial | `browser-app-connection.ts:172` | shape-guard only, absent from `INBOUND_VALIDATORS`; app-declared `intentResolver`/`channelSelector`/`fdc3Version` read and discarded |
| WCP2LoadUrl | **not implemented — by choice, not a gap** | — | **CORRECTED.** The spec lets a DA answer WCP1Hello with WCP2LoadURL *or* WCP3Handshake. Sail's WCP3-only path is legitimate. The consequence is an unsupported *topology* (hidden-iframe DA adaptor), not a conformance failure. Do not count this against conformance |
| WCP3Handshake | partial | `app-connection/wcp/wcp1-3-handshake.ts:83-98` | `fdc3Version` from `AppConnectionOptions`, not `implementationMetadata` |
| WCP4 / WCP5 | full | `app-connection/wcp/wcp-identity-validation.ts:48-294` | 3-way origin check + WindowProxy identity present |
| WCP6Goodbye (DA→app) | non-spec | `app-connection/wcp/wcp-connection-management.ts:143-150` | WCP6 is app→DA only; Sail also sends it with an undefined `payload` key and a `Date` timestamp |

Schema claims verified against `node_modules/@finos/fdc3-schema/dist/generated/api/BrowserTypes.d.ts` (v2.2.3) and `@finos/fdc3-standard`.

---

## 7. Load-bearing — do not cut

Every deletion above was required to state its cost. These were checked and cleared as necessary.

| Item | file:line | Why it stays |
|---|---|---|
| `resolveCleanupInstanceId`, `instanceHasCleanupWork` | `handlers/cleanup.ts:20,43` | Resolves WCP4 temp routing id → WCP5 validated id and makes teardown idempotent. `AGENTS.md` documents this exact bug. Removing re-opens double-teardown and orphan heartbeats |
| `disconnectHandshakeApp` vs `disconnectApp` split | `browser-app-connection.ts:264` | Resolving a temp id forward would disconnect a different, live connection that reused it (Slice 5a fix) |
| `clearAllHeartbeatTimersForTesting`, `clearAllPendingOpenWithContextTimeoutsForTesting`, `clearAllPendingIntentTimeoutsForTesting` | `handlers/heartbeat/runtime.ts`, `handlers/utils/open-with-context.ts:25`, `intent-pending-timeout-registry.ts:32` | Module-level `setInterval`/`setTimeout` maps are real; leaked timers hang the runner. 30+ call sites incl. the global Cucumber `After` hook. Explicitly sanctioned by `AGENTS.md` lines 58 and 152 |
| `getPendingOpenWithContextTimeoutCount`, `getActiveHeartbeatTimerCount` | `handlers/utils/open-with-context.ts:19`, `heartbeat/runtime.ts:16` | Test-only callers, but they assert the **absence of a resource leak** — the only observable for orphaned-timer bugs |
| `getActiveHeartbeatInstanceIds` | — | Doc says "for tests" but it has **3 real production callers** at `handlers/cleanup.ts:24,33,48` (the WCP4/WCP5 identity fix). **Fix the comment, not the code** |
| `appConnection` constructor option | `agent/sail-desktop-agent-types.ts` | `AGENTS.md:143` locks it: "exists only because the test edge is a real consumer — it is not a public extension point", stripped from published `.d.mts` by `stripInternal`. Only the generic wrapper goes |
| `handleWCP1Hello` | `app-connection/wcp/wcp1-3-handshake.ts:29` | **knip false positive.** Imported aliased at `browser-app-connection.ts:16`, called at `:178`. 96 LOC |
| `enrichMessageWithSource` strip-then-stamp | `browser-app-connection.ts:186-230` | The anti-spoof trust boundary |
| Validation *before* enrich in `bridgeAppPort` | `app-connection/wcp/wcp-message-routing.ts:56-65` | FDC3 WCP4/WCP6 meta is `additionalProperties:false`; validating after enrich rejects every well-formed handshake under `strict` |
| `wcpHandshakeRouting` slice + `linkHandshakeRoutingId` | `state/mutators/wcp-handshake-routing.ts` | Required when multiple instances have active heartbeats — the single-active-heartbeat heuristic alone is wrong |
| `pendingIntentPromises`, timeout registries | `agent/sail-desktop-agent.ts:90` and registries | Timer handles and promise resolvers are non-serializable; `AgentState` is deliberately JSON-serializable. Accepted limitation, Slice 9/#14 |
| `AppConnectionRegistry.deliverWcp5Success` temp→validated rekey | `app-connection/app-connection-registry.ts:87-110` | The one place the handshake port is rekeyed; without it every app stays under `temp-*` |
| App channels not replaying prior context | `handlers/broadcast/handlers.ts:245-253` | Not a gap — documented decision at `test/features/channels/app-channels.feature:155-158` |
| `ListenerNotFound` error code | `errors/fdc3-errors.ts:177` | ~~Off-schema **on purpose** per `AGENTS.md:63`~~ — **superseded 2026-08-07:** replaced by `ChannelError.InvalidArguments` |
| `InstanceMetadata` / `AppInstanceMetadata` | `state/types.ts:44-61` | Restate FDC3 shapes, but the file documents why (`unknown` over `any`) |
| `registerPendingHostInstance` | — | Real product caller at `sail-finance/src/components/layout-grid/panel-templates/FDC3IframePanel.tsx:55` |
| `AppConnectionEventEmitter` | — | `BrowserAppConnection` extends it and emits `appConnected`/`handshakeFailed`/`channelChanged` |
| `logger` / `validation` / `logPayloadDetail` options | — | Real host-configurable features with callers in `sail-finance` and the harness |

---

## 8. RESOLVED — `initialState` (Pass B was wrong)

**Settled by review, 2026-08-05. Do not re-litigate.**

`grep -rn "initialState" packages/sail-desktop-agent/test/` returns **0 hits**. Cucumber does **not** use the constructor `initialState` option — `CustomWorld` constructs `new SailDesktopAgent({...})` without it and BDD seeds via `applyDesktopAgentStateUpdate` / `updateState`. **Pass B's "~155 Cucumber scenarios depend on it" claim was false.** Pass A's conclusion stands.

Correcting Pass A's own citation, which was also wrong — there are **two** seams named `initialState` and the original audit conflated them:

| Seam | Callers |
|---|---|
| **Constructor** `new SailDesktopAgent({ initialState })` | `handlers/intents/__tests__/get-app-metadata-harness-path.test.ts:57,109,152`; `handlers/__tests__/wcp-host-instance-id.test.ts:63,214` |
| **`createDACPTestContext({ initialState })`** — a different, test-owned param | `handlers/channels/__tests__/join-user-channel-notify.test.ts:56-60` and ~16 other Vitest files |

Only the **constructor** option is in scope for removal. `createDACPTestContext`'s param lives in `test-context.ts` and is unaffected. The original doc listed `join-user-channel-notify.test.ts` as a constructor caller; it is not.

---

## 9. Top risks, independent of size

1. **`meta.hostInstanceId` is app-spoofable.** `resolveDacpHandlerInstanceId` (`handlers/utils/resolve-context-listener-instance-id.ts:25-28`) returns `message.meta.hostInstanceId` ahead of the port-derived id. `enrichMessageWithSource` strips `source` and `messageOrigin` but **not** this (`browser-app-connection.ts:201-220`).

   **Confirmed, with the blast radius narrowed on review:**
   - Real on the **default** `validation: "warn"` (confirmed at `agent/default-config.ts:39`). Under `"strict"` it is mitigated — FDC3 meta is `additionalProperties: false`.
   - The spoofed id must name an instance that **already exists in state** — `:27` guards with `getInstance(state, hostInstanceId)`. It is not "act as anyone".
   - The exposed surface is the handlers that call `resolveDacpHandlerInstanceId` — broadcast, context listener, unsubscribe, intentResult, close — **not every DACP call**.
   - **Re-verified: nothing in production writes the field.** `grep -rn "hostInstanceId" packages/*/src` outside `sail-desktop-agent/src` returns **0 hits**, and the `hostInstanceId` in `handlers/utils/wcp-host-instance-adoption.ts:44` is a *local variable* built from `reconnectInstanceId` / `hostIdentifier` / sole-pending lookup — a name collision, not a read of `meta.hostInstanceId`. Stripping the meta field does not break host instance adoption.

   **One coupling to handle in the same change:** `AGENTS.md:163` states DACP handlers resolve identity "via registered `hostInstanceId`, registered MessagePort `instanceId`, or `wcpHandshakeRouting`". The documented intent is a *registered* value; reading it from app-supplied meta is the actual defect. Update that sentence and the related tests in the same commit, or the next reviewer will read the strip as a regression. Already parked as Slice 6 in `.cursor/plans/archive/sail-desktop-agent-review-remediation.md`; should be promoted.
2. **Two sources of truth for `fdc3Version`.** WCP3 advertises `AppConnectionOptions.fdc3Version` (`wcp1-3-handshake.ts:90`, default `"2.2"` at `browser-app-connection.ts:95`); WCP5 and `getInfo` advertise `implementationMetadata.fdc3Version` (`wcp-identity-validation.ts:233`). Nothing syncs them — the harness sets it twice (`sail-conformance-harness/src/harness-bootstrap.ts:162,168`). A host that sets only `implementationMetadata` silently handshakes as 2.2 while claiming 3.0, and `closeRequest` gating (`handlers/open/handlers.ts:411`) reads the other one.
3. **Four off-schema wire payloads + one invented error code.** See §6.3. They work today only because clients still read deprecated fields and ignore extras — and the BDD suite asserts the wrong values, so it will not catch the regression when a client tightens.
4. **One type name, two shapes.** `IntentResolutionChoice` — see §5.6. Nothing is broken today, but the import looks right and the compiler agrees.

---

## 10. Remaining backlog

Correctness before cleanup; test realism before trimming, because the trim is far safer once the tests exercise production paths.

**Trust as defects — tracked elsewhere.** The four defect fixes (`meta.hostInstanceId`, `fdc3Version`, off-schema payloads, `raiseIntent`) are **owned by [`sail-da-defect-fixes.md`](./sail-da-defect-fixes.md)**, which holds their current status, verification results and decisions. Do not restate them here — this document is the evidence, that one is the backlog.

**Then cleanup, cheapest and safest first:**

| # | Step | Size |
|---|---|---|
| 1 | Sweep the 31 zero-caller exports + 4 dead files; fix the `channelSelector` doc bug | ~290 LOC |
| 2 | Delete the test-shaped API items (see §3) + the compiler-verified impossible-state guards. Replace the Cucumber shutdown step **before** removing `setOnAgentDisconnect` | ~250 LOC |
| 3 | Unify the intent-resolver types (removes the duplicate name) | ~85 LOC |
| 4 | Add WCP1/2/3/6 + heartbeat BDD coverage, and adopt the orphaned heartbeat `Given` | new tests |

**Park until an explicit decision — each needs a design call, not a cleanup PR:**

- `ChannelControl` (already an open item in `sail-desktop-agent-feature-decisions.md` §1)
- The 28 catch-block dedupe and the 14 hand-rolled destinations — mechanical, but ~340 LOC of churn across every handler; land it on its own, not inside a defect fix
- Three-identity-store redesign. **Reframed:** three stores may be inherent (FDC3 instances + port map + WCP temp→validated identity). The actionable question is *which invariants are missing and where cleanup diverges* — `SailDesktopAgent.handleDisconnect()` prunes one store, `cleanupDACPHandlers` prunes three — not "collapse to one store"
- `recentlyDisconnected` removal (see §5.7 — takes the anti-restore guard tests with it)
- Bulk deletion of the app-directory "impossible" guards. This is the **weakest** class in the doc: the data is remote JSON, so TypeScript's guarantee is not a runtime guarantee. Only the `typeof` / `in` / `Array.isArray` halves are provably dead; the `!x` halves are legitimate distrust
- Making `DacpTestAppConnection` actually prune MessagePorts **and** adding real browser WCP integration coverage are two different investments — cost them separately

**Framing note:** §1 leads with "~1,150 LOC removable". That number should not drive sequencing. The four defects in `sail-da-defect-fixes.md` are worth more than this entire cleanup list, and they are small. Do them first.
