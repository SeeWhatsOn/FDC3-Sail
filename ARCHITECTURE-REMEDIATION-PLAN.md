# Architecture Remediation Plan

**Status:** open · **Raised:** 2026-07-30 · **Branch reviewed:** `wip/v3-local` @ `14f7bbf60`
**Scope:** `@finos/sail-desktop-agent`, `@finos/sail-platform`, `website/docs`
**Companion:** [architecture review diagrams](https://claude.ai/code/artifact/cfb9c66d-a3d7-400d-8cec-0b2ea2b4f6d5)

This is a parking document, not a design. It records what was found during the July 2026
architecture read, what was decided, and what still needs investigation before it can be
scheduled. Nothing here has been implemented.

Conventions used below:

- **VERIFIED** — read in source, `file:line` cited, claim checked directly.
- **DECIDED** — direction agreed; needs a slice, not more analysis.
- **NEEDS INVESTIGATION** — evidence gathered, root cause or right answer not yet settled.

---

## 1. Direction decided

| # | Decision | Consequence |
|---|---|---|
| D1 | `sail-finance` should consume `SailPlatform`, not bypass it. | Requires resolving the composition question in [W1](#w1--decide-the-sailplatform-relationship). |
| D2 | `SailPlatform` should be the *meta* layer that composes `SailDesktopAgent` and adds features via middleware — not a parallel sibling. | Middleware is currently a no-op stub. See [W1](#w1--decide-the-sailplatform-relationship). |
| D3 | WCP in `sail-desktop-agent` supersedes anything in `sail-platform`. `sail-platform` gets stripped back on YAGNI/KISS grounds. | See [W2](#w2--strip-sail-platform-to-what-is-actually-used). |
| D4 | All timeouts should derive from top-level `DesktopAgent` config defaults. | See [W5](#w5--consolidate-timeouts-onto-one-config). |
| D5 | A WCP5 identity-validation failure should raise the `handshakeFailed` host event, not only `appDisconnected`. | See [W4](#w4--handshake-failure-event-symmetry). |
| D6 | The docs become the blueprint / single source of truth; code is reconciled to them, not the other way round. | See [W9](#w9--docs-rebuild). |

---

## 2. Spec conformance — settled

Checked against FDC3 2.2 (`finos/FDC3` @ `v2.2`) and the installed `@finos/fdc3-schema`.

### 2.1 Confirmed correct — no action

| Area | Finding |
|---|---|
| **Private channel access control** | FDC3 2.2 `api/ref/PrivateChannel.md`: a DA *"SHOULD restrict external apps from listening or publishing on this channel"* and *"MUST prevent `PrivateChannels` from being retrieved via `fdc3.getOrCreateChannel`"*. Sail implements both — three deny points plus a mutator guard, and `getOrCreateChannel` returns `ChannelAccessDenied` for a private id. **Spec-aligned. Keep.** |
| **No replay on private channels** | Spec: *"desktop agents do not need to queue or retain messages that are broadcast before a context listener is added"*. Sail matches. |
| **App channels have no membership** | FDC3 has no join concept for app channels. Sail's "membership is implied by a listener bound to the channelId" is the correct reading. |
| **No replay on app channels** | Spec `api/ref/Channel.md`: replay is specified *only* for user channels joined via the `DesktopAgent` interface; *"when add a context listener via the Channel interface, context is not received automatically, but may be retrieved manually via `getCurrentContext()`"*. Sail matches exactly. |
| **WCP5 failure handling** | Spec `api/specs/webConnectionProtocol.md`: on unrecognised identity the DA *MUST* respond `WCP5ValidateAppIdentityFailedResponse` then stop handling messages on the port; the app's `getAgent()` rejects with `AgentError.AccessDenied`. Sail does exactly this. |
| **`WCP2LoadUrl` not implemented** | Optional per spec — a DA may answer `WCP1Hello` with either. Sail always answers `WCP3Handshake`. Fine. |
| **Base timeout values** | Spec mandates 10 s default message exchange and 100 s for launch-involving exchanges. `DACP_TIMEOUTS.DEFAULT` / `.APP_LAUNCH` match. |

### 2.2 Confirmed gap

| Area | Finding | Work item |
|---|---|---|
| **Timeouts are never advertised** | `WebConnectionProtocol3HandshakePayload` defines optional `messageExchangeTimeout` and `appLaunchTimeout` — the spec's sanctioned way for a DA to tell apps it uses non-default timeouts (minimums 100 ms / 15 000 ms). Sail's WCP3 payload sends only `fdc3Version`, `intentResolverUrl`, `channelSelectorUrl`. A host that tunes timeouts leaves connected apps on the 10 s/100 s defaults. **VERIFIED** in `node_modules/@finos/fdc3-schema/.../BrowserTypes.d.ts:122-150`. | [W5](#w5--consolidate-timeouts-onto-one-config) |
| **Listener UUID provenance** | Spec is silent on how `listenerUUID` is generated — no constraint, no uniqueness requirement. Sail's inconsistency (context + DA event listeners reuse `meta.requestUuid`; intent and private-channel listeners mint a fresh uuid) is therefore **not** a conformance issue. Downgraded to hygiene. | [W8](#w8--listener-id-hygiene) |

---

## 3. Work items

### W1 — Decide the `SailPlatform` relationship

**Status:** DECIDED in direction (D1, D2), NEEDS INVESTIGATION on shape.

**Current reality — VERIFIED:**
- `SailPlatform` has **zero consumers** outside its own package. Its only callers are two of its own tests.
- `packages/sail-finance/src/main.tsx:110` calls `createSailBrowserDesktopAgent`, never `SailPlatform`.
- `sail-finance` imports from `@finos/sail-platform` in 12 files, but only for `SailAppLauncher`, `createSailBrowserDesktopAgent`, `generateUuid`, and type re-exports.
- Workspace/layout persistence is Zustand `persist` + raw `localStorage` (`packages/sail-finance/src/stores/workspace-store.ts:4,114,192,204`). `platform.workspaces`, `platform.layouts`, `SailPlatformClient` and `LocalStorageBackend` are never called.
- The middleware pipeline is a stub: `use()` collects handlers that are never applied. `packages/sail-platform/src/sail-browser-desktop-agent.ts:80-88`, with the comment *"This will require wrapping the agent's transport with middleware"*.

**The question to settle:** two libraries side by side, or `SailPlatform` composes `SailDesktopAgent`?

Composition (D2) is the stated preference. Before committing, resolve:

1. **What does middleware wrap?** The agent deliberately exposes no transport seam — `AgentAppConnection` is `@internal` and `index.ts` states *"There is no transport abstraction to configure."* Middleware over DACP messages means either reopening that seam or intercepting at the handler-context level. These are materially different designs.
2. **Is there a real second consumer?** `.cursor/plans/sail-one-port.md` describes a second shell. Middleware built for one consumer is speculative generality; see `.cursor/plans/sail-platform-extensibility.md`, which already landed on *"build nothing yet, fix defects"*.
3. **Does `sail-finance` adopting `SailPlatform` require anything the platform doesn't yet do?** Today finance needs a launcher and an agent. That is `SailAppLauncher` + `createSailBrowserDesktopAgent` — which is what it already uses.

**Acceptance:** an ADR stating the relationship, plus either a migration slice for `sail-finance` or a documented decision that the factory *is* the supported entry point and `SailPlatform` is withdrawn.

---

### W2 — Strip `sail-platform` to what is actually used

**Status:** DECIDED (D3).

Remove or park, on YAGNI/KISS grounds:
- The no-op middleware pipeline (`sail-browser-desktop-agent.ts:80-88`) — delete or implement, not both.
- `RemoteBackendConfig` — a type with a `// Future: RemoteBackend implementation` stub at `sail-platform-client.ts:77`.
- Workspace/layout/config APIs, if W1 concludes finance keeps its own stores.
- `ChannelControl` re-export chain, pending [W3](#w3--channelcontrol-keep-or-retire).

Keep and document: `SailAppLauncher`, `createSailBrowserDesktopAgent`, `wireWcp4OriginAllowlist`.

**Blocked on W1.**

---

### W3 — `ChannelControl`: keep or retire

**Status:** NEEDS INVESTIGATION.

**VERIFIED:** the interface, the barrel export, the `sail-platform` re-export and a test asserting the re-export all exist. Nothing calls `selectChannel`. The live path is the reverse — the host pushes via `agent.channels.changeAppChannel`, which synthesises a host-initiated `joinUserChannelRequest`.

**Not a spec question.** FDC3 defines `channelSelectorUrl` in `WCP3Handshake` as the app-hosted selector mechanism; Sail sets it `false` and owns the UI in host chrome, which is legitimate. `ChannelControl` is a *Sail-internal* pull-shaped contract with no caller.

**Options:** (a) retire it and keep the push API as the only path; (b) implement the pull path for hosts that want the agent to request a channel choice. There is currently no consumer asking for (b).

**Acceptance:** decision recorded; if retired, remove the contract, the re-export, and the test that pins it.

---

### W4 — Handshake failure event symmetry

**Status:** DECIDED (D5). Small, self-contained.

A handshake that times out before WCP4 emits `handshakeFailed`. A handshake that reaches WCP4 and is *rejected* emits only `appDisconnected`, for a connection the host never saw connect.

- Timeout path: `app-connection/wcp/wcp1-3-handshake.ts:96-105`
- Rejection path: `app-connection/app-connection-registry.ts:59-63`

**Wire-level behaviour is already spec-correct** (§2.1) — this is purely Sail's host-facing event surface. The `WCP5ValidateAppIdentityFailedResponse` payload has an optional `message?` field which Sail already populates; the same string should ride the `handshakeFailed` event.

**Acceptance:** WCP5 rejection emits `handshakeFailed(error, connectionAttemptUuid)` before `appDisconnected`, with a regression test per failure branch (origin mismatch ×3, directory miss, catch-all).

---

### W5 — Consolidate timeouts onto one config

**Status:** DECIDED (D4). Largest mechanical item.

**VERIFIED inventory — 18 timing constants:**

- **3** plumbed through `DesktopAgentOptions`: `openContextListenerTimeoutMs`, `heartbeatIntervalMs`, `heartbeatTimeoutMs`.
- **3** reachable only via a second, parallel bag (`appConnectionOptions`), absent from `DesktopAgentConfig`: `handshakeTimeout` (5 000), `disconnectGracePeriod` (2 000), `intentResolutionTimeout` (60 000).
- **12 hardcoded**, untunable by a host:

| Constant | Value | Location |
|---|---|---|
| `DACP_TIMEOUTS.DEFAULT` | 10 000 | `dacp/dacp-constants.ts:15` |
| `DACP_TIMEOUTS.APP_LAUNCH` | 100 000 | `dacp/dacp-constants.ts:16` |
| `DACP_TIMEOUTS.MINIMUM_APP_LAUNCH` | 15 000 | `dacp/dacp-constants.ts:17` |
| pending-intent timeout | 30 000 | `handlers/intents/intent-raise-shared.ts:180` — default param, never overridden by either call site |
| stale-disconnect sweep | 30 000 | `app-connection/browser-app-connection.ts:137` |
| `recentlyDisconnected` TTL | 5 000 | `app-connection/wcp/wcp-connection-management.ts:121` |
| launch poll `maxWaitTime` | 15 000 | `handlers/intents/intent-launch-helpers.ts:67` |
| launch poll `checkInterval` | 100 | `handlers/intents/intent-launch-helpers.ts:68` |
| launch timestamp fudge | −500 | `handlers/intents/intent-launch-helpers.ts:58` |
| `changeAppChannel` timeout | 10 000 | `agent/sail-desktop-agent.ts:357` |
| host-resolver skew buffer | 1 000 | `agent/sail-desktop-agent.ts:37` |
| duplicate resolver default | 60 000 | `agent/sail-desktop-agent.ts:36` — duplicate of `browser-app-connection.ts:89` |

**Duplicated defaults:** `handshakeTimeout: 5000` at both `browser-app-connection.ts:87` and `sail-platform/src/sail-browser-desktop-agent.ts:67`; `intentResolutionTimeout: 60000` at both `browser-app-connection.ts:89` and `sail-desktop-agent.ts:36`.

**Incoherent nesting on a single `raiseIntent`:** router 100 s ⊃ resolver UI 59 s ⊃ pending-intent 30 s ⊃ launch poll 15 s ⊃ delivery wait 15 s. Five independently chosen deadlines, none derived from another.

**Plan:**
1. Extend `DesktopAgentConfig` (`agent/desktop-agent.ts:117-133`) to carry the full set.
2. Fold `AppConnectionOptions`' three timing fields into it; delete the parallel bag.
3. Resolve once in `resolveDesktopAgentConfig` (`agent/default-config.ts:77-99`); delete the three duplicated defaults.
4. Add to `DACPHandlerContext` alongside the heartbeat fields already there.
5. **Advertise `messageExchangeTimeout` / `appLaunchTimeout` in the WCP3Handshake payload** whenever they differ from spec defaults — closes the §2.2 conformance gap.
6. Derive the nested intent deadlines from one budget rather than five literals.

---

### W6 — Uniform immer usage and state immutability

**Status:** NEEDS INVESTIGATION on scope; findings VERIFIED.

**Good news:** nothing mutates `AgentState` outside a producer. No `state.x =`, no `.push()`, no `delete`.

**The inconsistency is real, and it is about freeze semantics, not style:**

- 7 of 9 mutator modules use `produce`. **2 do not** — `state/mutators/app-directory.ts` (7 exported mutators, all hand-rolled spread) and `state/mutators/wcp-handshake-routing.ts` (both exports). Also `state/initial-state.ts:66-85` `deepMerge`.
- immer 10 auto-freezes by default, but **`setAutoFreeze` is never called** and `createInitialState` returns an unfrozen object. So a slice is frozen only if the last mutator that touched it went through `produce`. After `linkHandshakeRoutingId`, `state.wcpHandshakeRouting` and its inner record are fresh, unfrozen objects. **Enforcement depends on which mutator ran last.**
- `getState()` (`agent/desktop-agent.ts:375-377`) returns the live reference, no clone. `handlers/types.ts:97` documents it as a *"read-only snapshot"*; it is neither. On spread-touched branches a host could write into it and succeed silently.
- `Date` is not draftable, so `createdAt` / `lastActivity` are mutable even in frozen state.
- Outside `AgentState`: `wcp-connection-management.ts:238-239` and `wcp-host-identifier.ts:90` mutate `AppConnectionMetadata` in place. Since slice 5b landed Option B, nothing restores from `recentlyDisconnected` any more, so the stale-snapshot consequence is gone — but the in-place mutation of a map-held object remains, and it is the same object the `recentlyDisconnected` entry still holds a reference to.

**Plan:** port the two modules to `produce`; call `setAutoFreeze(true)` explicitly at init; clone into `recentlyDisconnected`; type `getState()` as `Readonly<AgentState>` so the doc comment is compiler-enforced rather than runtime-hoped.

---

### W7 — WCP shape: explicit state machine

**Status:** NEEDS INVESTIGATION on target design; findings VERIFIED.

**Answering "is WCP really a state machine?" — yes.** The per-connection lifecycle is a small closed set:

```
AWAITING_HELLO → HANDSHAKE_SENT → IDENTITY_VALIDATED → GOODBYE_PENDING → DISCONNECTED
```

Today that state is encoded implicitly across **five** mechanisms, three of which are ad-hoc:

| Mechanism | Kind | Where |
|---|---|---|
| `temp-` key prefix | string convention | set `wcp1-3-handshake.ts:46`; tested `wcp-identity-validation.ts:212,346`, `cleanup.ts:28` |
| `appId === "unknown"` | magic sentinel | set `wcp1-3-handshake.ts:64`; read `:98` to decide teardown |
| membership of `pendingDisconnects` | map presence | `wcp-connection-management.ts:39,87,113,138` |
| membership of `recentlyDisconnected` | map presence | `:99,122,234-235` |
| `AppInstanceState` | actual enum | `state/types.ts:20-23` |

**Answering "class vs DACP-style functions?" — most of WCP is already function+context.** All seven `wcp/*.ts` protocol modules are free functions taking a context object, structurally identical to `DACPHandlerContext`. `BrowserAppConnection` is largely a facade: 11 of its members are one-line delegations, and three methods exist solely to rebuild the context object per call.

What genuinely needs to stay a class: `MessagePortTransport` (wraps a real port, needs stable bound listeners for removal) and the small part of `BrowserAppConnection` that owns the `window` listener, the sweep interval, and `isStarted`.

What is missing versus `handlers/index.ts` is not *functions* — it is a **single dispatch table**. WCP dispatch is currently scattered across four sites: `browser-app-connection.ts:162-174`, `wcp-message-routing.ts:70-78`, `agent/desktop-agent.ts:300-328`, `app-connection-registry.ts:54-65`.

**Scale of the problem: 28 connection-lifecycle mutation statements across 8 files, and 8 distinct teardown entry points.**

**Direction:** an explicit `(state, event) → state` transition table with events `WCP1Hello`, `WCP4Validated`, `WCP4Failed`, `HandshakeTimeout`, `WCP6Goodbye`, `GraceExpired`, `PortClosed`, `HostTeardown`. Replace the `"unknown"` sentinel with a `phase` field on `AppConnectionMetadata`. The prose comment blocks at `wcp-connection-management.ts:221-235` and `browser-app-connection.ts:244-253` are already descriptions of exactly the transitions such a table would encode.

**Delete on sight:** `app-connection/wcp/wcp-event-emitter.ts` — `WCPEventEmitter` is a byte-identical duplicate of `AppConnectionEventEmitter`, not exported from the barrel, zero importers.

---

### W8 — Dual keying: temp id vs canonical instance id

**Status:** NEEDS INVESTIGATION; findings VERIFIED. Related to W7.

**Answering "is two state machines keyed differently correct?" — partly.**

**Inherent:** `WCP1Hello` carries only `connectionAttemptUuid`; the `MessageChannel` must exist before WCP4; identity is genuinely unknown until WCP4 validates. A pre-identity handle is unavoidable.

**Not inherent — five things that are implementation artifacts:**

1. **Rekeying the registry maps mid-flight** (`wcp-connection-management.ts:258-267`). The connection could keep its `connectionAttemptUuid` key for life with the canonical id as a *field*, plus one reverse index. That alone removes the entire "must not resolve forward" hazard class — including the `disconnectApp` vs `disconnectHandshakeApp` split that exists only to dodge it.
2. **Three redundant writes of the temp→canonical link**: `wcp-connection-management.ts:274`, `wcp-identity-validation.ts:278-280`, `handlers/heartbeat/handlers.ts:30-32`. All write the identical pair. They are not harmless duplication — the first goes through an *optional* `setAgentState`, so headless/test wirings only get the other two.
3. **`wcpHandshakeRouting` living in `AgentState` at all.** It is edge-routing metadata, in state only so the edge can read it via `bindAgentState`. That is what forces `setAgentState` to be optional and creates divergence.
4. **The `temp-` string prefix as a type discriminator.**

> **Correction (2026-07-30).** An earlier draft of this document claimed `resolveDacpHandlerInstanceId`
> carried a six-tier cascade whose last two tiers guessed identity from `meta.source.appId`. **That is no
> longer true** — slice 6 of the in-flight plan deleted the appId cascade. The function is now three tiers
> (`meta.hostInstanceId` → registered MessagePort id → `wcpHandshakeRouting` link) with an explicit
> docstring contract: *"Never guess identity from app-supplied `meta.source.appId`."* The claim is
> withdrawn.

**Five defensive id-resolution helpers remain:** `resolveInstanceId`, `resolveLinkedInstanceId`, `resolveRoutingInstanceId`, `resolveDacpHandlerInstanceId` (3 tiers), `resolveWcpHostIdentifier`, `resolveCleanupInstanceId`. Plus four more keyspaces shadowing the same identity: `instanceIdentityRegistry` (canonical), `pendingSourceWindowRegistry` (temp), `heartbeatIntervals` (module-scoped — correct, given the one-agent-per-browsing-context invariant), `open.pendingWithContext` (canonical, must be migrated on adoption).

**Target shape:** one `ConnectionRecord` per WCP attempt, immutably keyed by `connectionAttemptUuid`, holding `{ attemptUuid, phase, canonicalInstanceId?, appId?, port, sourceWindow, hostIdentifier, instanceUuid }`, plus one `Map<canonicalInstanceId, attemptUuid>` index. `AgentState.instances` keeps only FDC3-visible state with `attemptUuid` as the join column. That deletes `wcpHandshakeRouting` and all six resolvers.

**This is the single highest-leverage structural change in this document, and the riskiest. It should follow W7, not precede it.**

---

### W9 — `recentlyDisconnected` is written and reaped, but read by nothing

**Status:** NEEDS INVESTIGATION (was Q4). **Reframed after checking the working tree.**

An earlier draft framed this as a jittery 5–35 s *reconnect window*. That framing assumed
restore-on-reconnect, which **slice 5b (Option B) deleted** — `updateConnectionMetadata` now
`delete`s both the temp- and validated-keyed entries and restores nothing
(`wcp-connection-management.ts:231-235`). The in-flight plan already records this:
*"`recentlyDisconnected` still written for grace bookkeeping but no longer restored onto reconnect
metadata."*

**So the real finding is simpler.** The map is written when a grace timer fires
(`wcp-connection-management.ts:99`), reaped on a 5 000 ms eligibility threshold via a 30 000 ms
sweep (`:122-124`, `browser-app-connection.ts:137`) — and **nothing reads it for any purpose**. Two
hardcoded timers maintaining state with no consumer.

**To settle:** delete it, or give it a consumer. If diagnostics are the intended use, say so and
expose it; if not, removing it also removes two of the twelve hardcoded timeouts in W5.

---

### W10 — `closeRequest` has no validator, and no ownership check

**Status:** NEEDS INVESTIGATION. Treat as security-adjacent.

**VERIFIED chain:**

1. `closeRequest` is absent from `INBOUND_VALIDATORS` (`dacp/validate-dacp-message.ts:61-92`). It is the **only** one of the 28 handler-map types missing a validator.
2. `isValidInboundMessage` returns `true` for unknown types by design (`:100-113`), so `applyInboundValidationPolicy` returns `"dispatch"` in **all** modes including `strict`.
3. This is not a forgotten import — `@finos/fdc3-schema` exports exactly the 27 `isValid*Request` guards already wired. There is no `CloseRequest` type in the pinned schema; it is FDC3 3.0-next. **A fix must hand-write the validator; it cannot drop in a generated one.**
4. `handleCloseRequest` (`handlers/open/handlers.ts:406`) resolves its target via `resolveDacpHandlerInstanceId`, whose **first tier** returns app-supplied `message.meta.hostInstanceId` after checking only that such an instance *exists* — not that the caller owns it.
5. `meta.hostInstanceId` is **not** an FDC3 schema field and no production code writes it. It is read straight off the inbound message.
6. The handler then calls `appLauncher.close(targetInstanceId)` and `teardownInstance` on that id.

**Mitigation today:** the handler returns `CloseError.ErrorOnClose` unless `implementationMetadata.fdc3Version >= 3.0` (`:414`), and Sail's default is `"2.2"`. So this is **latent, not currently reachable in the default configuration** — but `implementationMetadata` is host-overridable and 3.0 work is in flight.

**To settle:** (a) hand-write a `closeRequest` validator; (b) add an ownership check so an app can only close itself; (c) decide whether unknown message types should be *rejected* rather than passed through in `strict` mode; (d) audit every other consumer of `meta.hostInstanceId`.

---

### W11 — WCP5 delivery: the equality short-circuit

**Status:** NEEDS INVESTIGATION. Worse than first assessed.

`deliverWcp5Success` (`app-connection-registry.ts:92-115`) performs the temp→canonical remap only when `destinationId !== actualInstanceId`; otherwise it falls through to a plain send with **no** `updateConnectionMetadata`.

The equality condition is not purely theoretical. `actualInstanceId` derives from `payload.instanceId` (app-supplied `reconnectInstanceId`) on the reuse path, or from `window.name` on the adoption path — **both app-influenceable**. `destinationId` is always `temp-{connectionAttemptUuid}`, and the app authors the `connectionAttemptUuid`. **VERIFIED:** there is no format guard rejecting `temp-`-prefixed ids on input — the three `startsWith("temp-")` uses in the codebase all *detect* temp ids, none reject them. `registerPendingHostInstance` (`agent/desktop-agent.ts:445-458`) accepts an arbitrary caller-supplied `instanceId` with no format check.

**Consequences if it ever fires:** `metadata.appId` stays `"unknown"`, so the handshake-timeout closure tears down a fully validated connection 5 s later; `appConnected` never fires so host UI never learns the app is live; every subsequent DACP message carries `meta.source.appId = "unknown"`.

**Root cause:** `destinationId !== actualInstanceId` is being used as a proxy for *"this connection has not yet been identity-validated"* — a fact that is directly available. Note the code already anticipates equality elsewhere (`wcp-identity-validation.ts:278`, `wcp-connection-management.ts:25` both guard for it), so the design admits the state and only this one site reinterprets it.

**Cheap immediate guard:** reject `temp-`-prefixed values for `payload.instanceId`, `window.name`, and `registerPendingHostInstance`'s `instanceId`. **Proper fix:** the explicit `phase` field from W7.

---

### W12 — Listener id hygiene

**Status:** low priority. Not a spec issue (§2.2).

Context listeners and DA event listeners use `message.meta.requestUuid` as the `listenerUUID` (`handlers/broadcast/handlers.ts:215`, `handlers/events/handlers.ts:54`); intent and private-channel listeners mint a fresh uuid. Both work. The former ties listener identity to the request that created it, which collides if a client ever reuses a request uuid.

**To settle:** was the reuse deliberate (so a client can predict its own listener id)? If not, standardise on fresh uuids.

---

## 4. Docs remediation

### W13 — Docs rebuild

**Status:** DECIDED (D6). Audit complete; 40+ defects found across 13 pages.

The docs cannot serve as a blueprint in their current state. The central defect is that they describe a three-layer stack with `SailPlatform` in the middle, which no shipping host uses — so **W13 is blocked on W1**.

**Rewrite from scratch:**

| Page | Why |
|---|---|
| `packages/sail-finance/overview.md` | Every substantive claim is wrong — claims it hosts `SailPlatform`, claims platform-managed workspaces/layouts, wrong dependency diagram. |
| `packages/desktop-agent/conformance.md` | Cites three feature files that do not exist (`basic/basic.feature`, `infrastructure/heartbeat.feature`, `apps/disconnect-cleanup-p0.feature`); 10 of 12 scenario counts wrong; total stated as 103 vs actual 136; six `@fdc3_3.0` files undocumented. Regenerate mechanically from `test/features/`. |
| `architecture/deployment-targets.md` | The layer diagram is the page's spine and it is wrong. Salvage the native-shell section verbatim. |
| `packages/platform/overview.md` | Documents an API with no consumers, plus two exports that do not exist (`DesktopAgent` re-export, `validateDACPMessage`). Blocked on W1. |

**Keep and patch:** `packages/desktop-agent/overview.md` (strongest page — near-clean), `composition.md` (one fix), `integrator-guide.md` (large and mostly accurate; excise the `SailPlatform` sections and the `new DesktopAgent()` samples), `add-your-app.md`, `channel-selection.md` (protocol content is correct, only role attribution is wrong), `development.md`.

**Other verified defect classes:**

- **`DesktopAgent` is presented as a public construction path in 5 places.** It is a **type-only** `@internal` export (`src/index.ts:24-29`); `new DesktopAgent(...)` samples in `integrator-guide.md:548-555` will not compile.
- **npm install instructions fail.** `npm view @finos/sail-desktop-agent` → 404. `getting-started.md:70` opens with an install command that cannot work.
- **Production-readiness contradiction:** `README.md:184` says *"not yet ready for production use"*; `intro.md:65` says *"a production-ready product"*.
- **Dead commands/paths:** `npm run dev:harness` (actual: `dev:conformance`), `npm run generate:schemas` (does not exist), `sail-server/` (package removed), Socket.IO (not a dependency), `plans/work-items/...` (directory does not exist), auto-generated Zod schemas (validation is `@finos/fdc3-schema` guards).

**Undocumented architecture that a blueprint must cover:**

1. `@finos/sail-theme` — a real workspace, mentioned in no docs page.
2. `createSailBrowserDesktopAgent` is the actual production entry point; docs file it under "advanced" and steer readers to `SailPlatform`.
3. `SailAppLauncher` and its `onLaunchApp`/`onCloseApp` callback contract — the real host seam.
4. The WCP4 origin allowlist (`sail-platform/src/wcp4-origin-allowlist.ts`) — the one genuinely Sail-specific security policy, with no threat model documented.
5. The dockview workspace/panel model, the popout relay shell, and the Zustand store family — this *is* the product architecture.
6. Workspace/layout persistence contract (localStorage schema + custom serializer).
7. The `@fdc3_3.0` Cucumber suite (6 files, 18 scenarios) and the `@fdc3_2.0` profile.
8. `toolbox-local` / `VITE_CONFORMANCE_TOOLBOX` dual-profile mode.
9. `lint:boundaries` / `.oxlintrc.json` — a CI gate that already encodes the layering rules the docs describe in prose.

---

## 5. Suggested sequencing

Ordered by dependency, not by value.

| Phase | Items | Rationale |
|---|---|---|
| **0 — decide** | W1 | Blocks W2, W13, and the shape of everything in `sail-platform`. Nothing else should start first. |
| **1 — cheap and safe** | W4, W12, delete `wcp-event-emitter.ts`, `temp-` input guards from W11 | Small, independently testable, no structural risk. |
| **2 — hygiene with teeth** | W6, W5 | Uniform immer + one timeout config. W5 also closes the §2.2 conformance gap. |
| **3 — security** | W10 | Latent today; must land before FDC3 3.0 is advertised by default. |
| **4 — structural** | W7, then W8 | The state machine first, then collapse the keyspaces onto it. Highest leverage, highest risk. |
| **5 — docs as blueprint** | W13 | Needs W1 decided and ideally W7/W8 landed, or it documents a shape about to change. |
| **parked** | W3, W9 | Need a decision, not investigation. |

---

## 6. Relationship to the in-flight slice plan

`.cursor/plans/sail-desktop-agent-review-remediation.md` is **execution-ready and nearly complete**.
Its own header says *"Do not re-litigate the findings."* This document does not supersede it and does
not renumber it.

**Verified in source 2026-07-30 — its checkpoint list was stale at the time of checking, so trust the
code, not the checkboxes:** slices 0–8, 10 and 11 have landed.

**Slice 9 / finding #14 is closed by decision, not by code.** Maintainer decision (2026-07-30): **there
will never be more than one Desktop Agent per browsing context.** Module-global
`heartbeatIntervals` and `pendingIntentTimeoutHandles` are therefore correct as written, and the tests
were changed rather than the registries. The finding is withdrawn.

Two consequences worth carrying forward:

1. **That invariant is load-bearing and currently unwritten.** It justifies the module-global
   registries, and it is the reason a whole class of "two agents in one page" concern is out of scope.
   It belongs in the docs blueprint as an explicit architectural constraint —
   `packages/desktop-agent/integrator-guide.md` already has a "One Desktop Agent per context" section
   to build on.
2. **W8's keyspace analysis is unaffected in substance.** `heartbeatIntervals` is still a separate
   keyspace for the same identity; it simply is not a *scoping* bug. Drop the "module-global" framing.

Finding #12 (silent no-op intent-resolver controller) not re-verified.

**What this review changes about it: nothing that is already scheduled. Four additions, two
corrections, one confirmation.**

### Corrections owed to the slice plan (my errors, not its)

| Claim in an earlier draft here | Reality | Cause |
|---|---|---|
| `resolveDacpHandlerInstanceId` has a six-tier cascade guessing identity from `meta.source.appId` | Three tiers, with an explicit "never guess" docstring | **Slice 6 already fixed it.** Withdrawn. |
| `updateConnectionMetadata` restores metadata via `Object.assign` from `recentlyDisconnected` | No restore exists; both keys are deleted | **Slice 5b Option B already removed it.** W9 reframed. |

### Already covered — do not duplicate

| This document | Already in the slice plan |
|---|---|
| `heartbeatIntervals` is module-global | Slice 9, finding #14 — with the correct remedy (key by owner, mirroring `instanceIdentityRegistry`) |
| Bare 10 000 ms `changeAppChannel` timeout | Slice 10 nit — "make it an option with that default" |
| `meta.hostInstanceId` is app-authorable | **Parked follow-up from the slice 6 review**: *"strip or host-stamp `meta.hostInstanceId` at enrich (apps can still author it today)"* |
| Private-channel grant model | Slice 3, landed `a9614dc46` — and §2.1 above confirms it is spec-correct |

### Genuine additions — candidates for new slices or a follow-on plan

| Item | Why it is not already covered |
|---|---|
| **W10** — `closeRequest` has no validator **and** no ownership check | Slice 4 wired validation for WCP4/WCP6 only. The slice-6 review parked `meta.hostInstanceId` as a *hygiene* item; it did not trace it to `appLauncher.close()`. The two together are the finding. |
| **C1** — WCP3Handshake never advertises `messageExchangeTimeout` / `appLaunchTimeout` | Not a defect anyone was looking for; it is a conformance omission, found by reading the spec rather than the code. |
| **W11** — WCP5 equality short-circuit in `deliverWcp5Success` | Adjacent to slices 5a/5b but a distinct path. Those fixed teardown escalation; this is the *absence* of the remap entirely. |
| **F8** — `wcp/wcp-event-emitter.ts` is a byte-identical dead duplicate | Slice 11's dead-code table lists four internal symbols and two public ones; this file is not among them. |
| **W6** — non-uniform immer + never-called `setAutoFreeze` | Out of scope of the original review, which was explicitly finding-driven. |
| **W5** — 18 timeouts, 3 tunable | Slice 10 catches one instance as a nit. The systemic version is new — and the slice plan's own 5a coverage gap (*"`createTestAgent` hard-codes `handshakeTimeout: 30_000` with no override knob"*) is direct evidence for it. |

### Confirmation

Slice 6's stated risk — *"the cascade may be load-bearing for real handshake flows the tests don't
cover"* — did not materialise: the three-tier resolver is in the working tree with cucumber at
154/154 and the harness at 69/69. The slice plan's instruction to *"give that flow an explicit
routing link"* rather than reinstate the heuristic was followed.

### Suggested handling

Do **not** interleave. Finish slices 7–11 as written — they are small, scoped, and verified. Then
take W1 (the `SailPlatform` decision) as the next delivery, since it gates the docs rebuild and the
shape of `sail-platform`. W10 is the one item worth pulling forward out of order, because it is
cheap and its only mitigation is that Sail still advertises FDC3 2.2.

One amendment worth making to the slice plan now: its **Out of scope** section recommends the
intent-resolution chain (~1,200 lines) as the next delivery, on the grounds that it received
structural review only. That recommendation still stands and is unaffected by anything here —
§06 of the companion artifact traces that chain but does not audit it.

---

## 7. Cross-references

- Diagrams: [architecture review artifact](https://claude.ai/code/artifact/cfb9c66d-a3d7-400d-8cec-0b2ea2b4f6d5)
- Prior decisions: `.cursor/plans/sail-platform-extensibility.md` (landed on *"build nothing yet, fix defects"*), `.cursor/plans/sail-desktop-agent-surface-reduction.md`, `.cursor/plans/sail-one-port.md`
- In-flight: `.cursor/plans/sail-desktop-agent-review-remediation.md`
- Existing audit: `FDC3-SAIL-REVIEW.md`
