# sail-platform: extensibility direction & decisions

> **Still current in its direction; some code references are stale (2026-08-04 cull).** §2's decision
> stands and was the basis for the cull: the SDA does FDC3 and only FDC3, everything else is
> `sail-platform`'s job, and nothing extensible gets built until a written requirement demands it.
>
> What changed underneath: `SailPlatform`, `createSailBrowserDesktopAgent`,
> `SailBrowserDesktopAgentConfig`, `SailAppLauncher`, `SailPlatformClient` and
> `wireWcp4OriginAllowlist` are **deleted**. `sail-platform` now holds workspaces, layouts and
> storage with zero dependencies — the first of the §2 responsibilities to actually land. The
> `allowedOrigins` discussion around §7 refers to removed code; see
> `.cursor/plans/parked-wcp4-origin-allowlist.md`. Auth, entitlements and telemetry remain unbuilt,
> exactly as §2 intends.

**Status:** direction + decision record. **Not** a work order — nothing here auto-executes.
**Provenance:** design exploration hardened by 5 rounds of adversarial (Socratic) review against the
actual codebase. Claims are grounded in files cited inline; where something was *not* verified it is
called out in §8. Do not treat §8 items as settled.

---

## 1. What this document is

A single place that captures two things future work keeps needing and keeps losing:

1. **The direction** — how Sail *would* become extensible (services, hooks, events, middleware, two
   planes, trust tiers, connectors) *if and when a real requirement demands it*.
2. **The decisions** — especially the **negative** ones (what we will deliberately **not** build, and
   why), so the reasoning doesn't evaporate between sessions and get re-litigated or quietly reversed.

The headline, up front: **there is no extensibility platform to build right now.** The near-term work
(§6) is fixing defects and removing a dead second workspace model. The architecture (§3) is the map for
later, gated behind a precise trigger (§7).

---

## 2. The decision in one paragraph

Keep `sail-desktop-agent` (the SDA) doing **FDC3 and only FDC3**. Everything else — workspaces, layout,
auth, entitlements, config, telemetry — is `sail-platform`'s job, and it attaches by *composing into
interfaces FDC3 already delegates*, not by growing new agent API. The tempting "observe everything at the
wire" middleware is **structurally blind to the decisions** that matter (entitlement, audit), so it is not
the foundation it looks like. Build nothing extensible until a written requirement needs to **block or
reliably record a wire decision the existing host contracts cannot express** — then, and only then, open
this document to §3.

---

## 3. The direction (the map for "later")

### 3.1 Two nouns, three verbs

- **Service** — the *noun*. An injected object with a boring default (telemetry → no-op, entitlements →
  allow-all, auth → anonymous, config → bundled, storage → localStorage). It does the work; it does not
  care *where* it was called from.
- **Event / Hook / Middleware** — the *verbs*, i.e. *how* a service attaches. These are not alternatives
  to a service; they are the wiring.
  - **Event** — fire-and-forget notification. Cannot block. Failures swallowed. (observation)
  - **Hook** — a named callout the agent *awaits* and obeys. Can say no. Allow-all by default. (decision)
  - **Middleware** — a pipeline *position*. See §3.4 — the word names two unrelated things.

Rule of thumb for a new capability: **does it react to every message, or answer at one moment?** Every
message → middleware. A moment → a hook (if it can block) or an event (if it only watches).

### 3.2 Two planes

- **The wire** — `sail-desktop-agent`. WCP + DACP messages. You can observe or (via a hook) block.
- **The state** — `sail-platform`. Workspaces, layout, user, config. Services read/write; the shell
  subscribes (`subscribe`/`getSnapshot` + `useSyncExternalStore`).

Dataflow is **not** a single line. There are two flows:
- **runtime:** wire → service → state → UI (an app broadcasts; telemetry observes; user state updates; UI
  reacts).
- **launch:** service → state → UI → wire (the launcher writes a panel; React mounts the iframe; the
  iframe then emits WCP1). Launch *materializes* the wire participant, so it necessarily precedes the wire.

The invariant that actually holds (and holds in shipped code): **a service writes state; it never
renders.** `SailAppLauncher.onLaunchApp` calls `workspaceStore.addPanel` (state); React renders the iframe.

### 3.3 Entitlement is two layers, not one

- **Coarse / static / per-user = directory projection.** The directory the agent sees is a *per-session
  projection* the platform assembles at login (full catalog ∩ the user's grants). Per-user logic lives in
  the platform's projection, not the agent. The agent just receives "this user's directory," and the
  existing WCP4 admission (`wcp-identity-validation.ts:115` — directory lookup, rejects if absent) does the
  right thing *honestly* with no new API and no forged protocol. The directory is projected **once at
  login and stays stable for the session** (re-projecting mid-session races WCP reconnects and orphans
  live instances — see §5).
- **Fine / dynamic / per-intent = a candidate filter.** One injected seam at candidate computation
  (see §3.5), identity-by-default, that removes disallowed handlers *before* resolution. If it empties the
  set, return the existing `ResolveError.NoAppsFound` (`errors/fdc3-errors.ts`) — honest for the app and
  for audit.
- **Revocation** (yank live access mid-session) is **not built**. When required it rides the existing
  `disconnectInstance` teardown, driven by the platform, plus the fine filter denying new intents. No new
  agent API.

### 3.4 "Middleware" is two unrelated things

- **Wire middleware** — a decorator around the `AgentAppConnection` interface (already swapped for tests
  via `DacpTestAppConnection`). Sees raw WCP+DACP. **Observe-only.** Correct future home for *operational*
  telemetry (health, message rates). **Not** a foundation for audit or entitlement — see §5.
- **State middleware** — Redux-style, intercepts a state mutation before it reaches the store/UI. Never
  touches the agent.

They share a word and nothing else. The dead `MiddlewarePipeline` in `sail-platform/src/middleware/` was a
general block-capable Chain-of-Responsibility that was wired to nothing — it was neither of the above and
was not worth keeping because the name matched. **Deleted 2026-08-03** (file, the `use()` graft on
`createSailBrowserDesktopAgent`, and all exports). Nothing in this section changes: when wire middleware is
built it is a decorator around `AgentAppConnection`, not a revival of that pipeline.

### 3.5 The one real seam (when entitlement is built)

FDC3 already delegates its host-decisions through three contracts the agent calls without knowing what's
behind them — **`AppLauncher`, `IntentResolver`, `ChannelControl`** (`host-contracts/`). These are *also*
the three points a host wants to gate; that is not luck. Entitlement composes into them — e.g. it hides
inside the platform's `IntentResolver`/candidate computation. **Precondition:** the candidate computation
is currently *forked* — `findIntentHandlers` (raiseIntent, `intent-helpers.ts:121`) and `createAppIntents`
(findIntent/raiseIntentForContext, `intent-helpers.ts:221`) are duplicated with divergent filtering. A
filter added to one and not the other resurrects a discovery-says-yes / raise-says-no lie. **Unify them
onto one `resolveCandidates(...)` primitive first**, then inject the filter there. (This is pure FDC3
hygiene, independently justified — see §8, it may already be a live bug.)

### 3.6 Trust tiers — aspirational until a process boundary exists

- **First-party / trusted** (the integrator assembling the deployment) → in-process, injected. VS Code's
  provider model. Enforcement = *reachability discipline* (constructor-inject write handles; do not export
  store singletons). This is **footgun-prevention, not a security boundary** — a determined in-process
  module can still reach internals.
- **Third-party / untrusted** (a vendor whose service a bank installs) → **out-of-process over WSP**,
  permission-scoped, message-passed. Chrome-extension model. This is the **only real security boundary.**

**Critical caveat:** WSP has zero implementation today and `sail-server` was deleted (`f5570ad60`). So the
trust tiers are a *direction, not a plan*. The in-process scoping ceremony is not worth building until
there is a written untrusted-code requirement, because in a first-party-only world it enforces nothing
real.

### 3.7 Connectors are apps, not a category

A "connector" (e.g. a Bloomberg adapter) is an **app** whose transport is WSP and whose far end is a Node
process holding credentials that can't live in browser JS. It's a directory entry with a WSP `details`
block — discovery. The WSP handshake is authorization. Directory entry ≠ authorization. Apps arrive over
**WCP** (web/iframe) or **WSP** (native/connector); DACP itself never splits — only admission and the pipe
do. "One socket, many instances" is an unverified assumption (§8).

---

## 4. Settled constraints

These are the load-bearing rules the direction must not violate:

1. **SDA purity is testable:** the agent runs FDC3-correctly with *zero services configured* and imports
   `@finos/fdc3` and nothing platform-shaped. "Pure" = FDC3 work, and only FDC3 work.
2. **Compose, don't extend:** prefer composing into the three existing host contracts over adding agent
   API. Adding API is the exception, gated by §7, and every addition needs a changeset (§7 enforcement).
3. **Services write state; they never render.**
4. **Store writes are a scoped capability** (inject handles; no singleton export) — but this is
   footgun-prevention for first-party, not security. Security is the process boundary.
5. **Persistence is best-effort:** the in-memory snapshot is the session source of truth; persist async
   with a health signal, no transactional rollback. Single-writer authority in the main window; popouts
   relay mutation intent to the opener (extending the existing WCP relay in `dockview-popout.ts`).

---

## 5. What we are deliberately NOT building (and why)

- **The observe-decorator as a "validation experiment."** *Dropped.* It has no falsifier (observability is
  already proven by `DacpTestAppConnection` in 43 tests), and it is **structurally blind to the decision
  surface**: when `raiseIntent` runs, the candidate set and filtering are agent-*internal*; the app
  connection only ever sees the app's own request and the final response — never "user was offered {A,B},
  denied C." So the wire decorator **cannot grow into audit**; it is on the wrong plane for the first real
  requirement.
- **Reliable/blocking audit via the wire.** Telemetry (best-effort, drops fine) and audit (must-not-lose,
  ordered, may need to block when unrecordable) have *opposite* reliability guarantees. They are not one
  mechanism. Reliable audit likely **reopens "the agent needs a hook"** — this is acknowledged, not
  hand-waved.
- **A plugin manifest / activation lifecycle / loader.** The interfaces plus their defaults *are* the
  extensibility. Buy the machinery only when there's an out-of-tree implementer who can't be handed a
  config object — and WSP already covers the out-of-process case.
- **Third-party UI contribution points.** Shells own their UI and share only `sail-theme` tokens. UI
  injection brings activation timing, layout arbitration, and permanent API versioning. Say no now.
- **Public middleware insertion.** Middleware stays the internal mechanism for invoking services. A third
  party inserting code into the message path can hang the agent by dropping a DACP request.
- **Mid-session revocation, an auth `user` state slice, WSP inbound, the in-process scoping ceremony.**
  All deferred behind §7. None has a written requirement.

---

## 6. Near-term, actionable now (needs no requirement, no consumer, no thesis)

These are real, present-tense, verified — independent of any extensibility work.
**Status line added 2026-08-03** after a cleanup pass landed items 3 (in altered form) and part of the
`sail-platform` hygiene; items 1, 2 and 4 remain OPEN.

1. **[OPEN]** **Fix the UUID defect.** `packages/sail-finance/src/stores/workspace-store.ts:78` mints IDs with
   `Math.random`; the package already exports `generateUuid` (`crypto.randomUUID`, `utils/uuid.ts`) and
   uses it everywhere else. Switch to it.
2. **[OPEN]** **Test the workspace store.** The 411-line store with hand-rolled `Map` serialization and no schema
   versioning has no test, while thinner stores (`connection`/`fdc3`/`panel`) do. Add a
   serialization round-trip + schema-version guard.
3. **[SUPERSEDED 2026-08-03 — see §10]** **Demote — do not delete — `SailPlatform`.** `index.ts` bills it "Primary API," but the shipping shell
   boots via `createSailBrowserDesktopAgent` (the *secondary* export). Two front doors, the advertised one
   unused. Promote `createSailBrowserDesktopAgent` to primary in docs/index; **annotate**
   `WorkspacesApi`/`LayoutsApi`/`ConfigApi` as *reserved for the workspace-model migration, currently
   unused* (do **not** delete — they are the agreed slot the domain model migrates into); fix the README.
   *If* any of it is ever truly removed, it is published FINOS API (`@finos/sail-platform`, has a publish
   pipeline) — do it as a changeset major-bump + deprecation, after checking npm, never a silent removal.
4. **[OPEN]** **Investigate the candidate fork (promoted from "leave it").** `findIntentHandlers` does **not** drop
   dead-instance listeners (no `getInstance` guard), while `createAppIntents` does. Trace whether raising
   to a possibly-dead instance is caught downstream. If not, this is a **fourth present-tense defect**, not
   a future hazard.

---

## 7. The resume trigger — and how to make it bite

**Trigger (capability-shaped, stateable today):** the first *written* requirement to **block or reliably
record a wire decision that the three host contracts cannot express by composition.** Audit is the likely
first instance. Not "sail-one starts" — that fires on theming tickets that touch none of this.

**Enforcement (so the trigger is commitment, not a comforting sentence):** add a **public-API snapshot
test** on the `sail-desktop-agent` index (any new export fails CI until deliberately updated) and/or a
**CODEOWNERS gate** on `host-contracts/` and the SDA index. The available structural chokepoint is the
existing `changeset publish` flow — a new SDA export forces a changeset, which is a review moment. Without
one of these, "compose, don't extend" is discipline cosplaying as commitment.

---

## 8. Open / unverified — do not rely on these

- **Candidate fork = live bug?** The dead-instance asymmetry (§6.4) is real in code; whether it produces a
  user-visible divergence needs a downstream trace. Not confirmed either way.
- **npm consumers of `SailPlatform`.** "No importer" was verified in the monorepo only, not on npm. Check
  before any removal.
- **"One socket, many instances" for WSP** is asserted, not designed. A connector server will host several
  connectors; `Transport.getInstanceId()` returning one value hints the current shape assumes 1:1.
- **Does reliable audit force a new hook?** Strongly suspected (§5), not designed. This is the most likely
  thing to *trip* the §7 trigger first.
- **Workspace domain vs layout split.** Promote the domain (`Workspace`/`Tab`/`Panel`) only; keep layout
  (`dockviewLayout: unknown`) opaque and per-shell. Validate the domain shape against sail-one's real
  needs *when its brief is written*, not against sail-finance alone.

---

## 9. Key file references

| Concern | File |
|---|---|
| Host contracts (the three seams) | `sail-desktop-agent/src/host-contracts/{app-launcher,intent-resolver,channel-control}.ts` |
| Swappable connection edge | `sail-desktop-agent/src/app-connection/types.ts` (`AgentAppConnection`) |
| WCP4 admission (directory gate) | `sail-desktop-agent/src/app-connection/wcp/wcp-identity-validation.ts:115` |
| Forked candidate computation | `sail-desktop-agent/src/handlers/intents/intent-helpers.ts:121` & `:221` |
| Composition point | `sail-platform/src/sail-platform.ts` (`SailPlatform` — now composes over the boot factory; the `Promise<unknown>` storage APIs were deleted 2026-08-03) |
| ~~Dead pipeline~~ | ~~`sail-platform/src/middleware/middleware.ts`~~ — deleted 2026-08-03 |
| Boot factory (owns Sail's agent defaults; both entry points route through it) | `sail-platform/src/sail-browser-desktop-agent.ts` |
| Config persistence (standalone, generic) | `sail-platform/src/client/sail-platform-client.ts` |
| Workspace store (defect + migration source) | `sail-finance/src/stores/workspace-store.ts` |
| Popout WCP relay | `sail-finance/src/utils/dockview-popout.ts` |

---

## 10. What actually landed, 2026-08-03 (and one reversal to confirm)

A cleanup pass ran against `sail-platform`. `src` went 2075 → 1332 lines. `sail-platform`, `sail-one` and
`sail-finance` all typecheck clean with tests green (26 / 10 / 28).

**Deleted as dead (zero importers, verified by ripgrep across all packages):** `MiddlewarePipeline` and its
`use()` graft (§3.4); `types/sail-messages.ts` and the `FDC3Server`/`ServerContext`/`AppRegistration`/`State`
half of `types/sail-types.ts` (both leftovers of the deleted socket server); the orphan
`interfaces/intent-resolver.ts` and `interfaces/channel-selector.ts`; and
`__tests__/host-contracts-reexport.test.ts`, which asserted on another package's raw *source text* by regex
and was RED on a cosmetic difference (`./host-contracts/index` vs the expected `./host-contracts/index.js`).

**Defects fixed:** `SailPlatformConfig.channelSelector` was accepted, documented and exported but never
passed anywhere — `SailDesktopAgentOptions` has no field to receive it — so setting it did nothing, silently;
removed. `LocalStorageBackend.createWorkspace` minted **two different UUIDs** for `id` and `uuid` on the same
object; gone with the file. A `Math.random` UUID fallback in that same file is gone; note §6.1's *separate*
`Math.random` defect in `sail-finance/src/stores/workspace-store.ts` is **still open**.

**Structural fix — the two front doors are now layered, not parallel.** §6.3 was written when
`createSailBrowserDesktopAgent` was the only shell entry. That is no longer true: `sail-one` boots via
`SailPlatform` (`sail-host.ts:129`) and `sail-finance` via the factory (`main.tsx`). Both doors are
load-bearing, so demoting either would break a shell. Worse, they were *different lossy subsets* of each
other and their Sail-defaults blocks had already drifted (the factory set `handshakeTimeout: 5000`;
`SailPlatform` did not). `SailPlatform` now composes over `createSailBrowserDesktopAgent` and its config
extends `SailBrowserDesktopAgentConfig`. This makes `allowedOrigins` — the WCP4 origin allowlist, the
package's only deployment security policy — **reachable from `SailPlatform` for the first time**, along with
`appDirectories`, `logger`, `validation`, `autoStart`, `channelChangeTimeoutMs` and an overridable
`appConnectionOptions`. Both new capabilities are pinned by tests.

**⚠️ The reversal that needs maintainer confirmation.** §6.3 said *annotate, do not delete*
`WorkspacesApi`/`LayoutsApi`/`ConfigApi`, and `sail-platform-design.md` §9 independently closed the same
question the same day on the "no consumer today does not downgrade an API" rule. **They were deleted
instead**, together with `PlatformApi`, `LocalStorageBackend`, `RemoteBackendConfig` and the
`storage: "localStorage" | "remote"` discriminator whose `"remote"` branch only ever threw. What remains is
`SailPlatformClient<T>`, a standalone generic config store — no longer reachable through `SailPlatform`.

Two facts drove it, both of which postdate §6.3's reasoning:
- §8's "npm consumers unverified" caveat is **resolved**: `npm view @finos/sail-platform` returns **404**.
  The package is unpublished, so the changeset/major-bump/deprecation path §6.3 required does not apply.
- The "reserved slot" argument does not survive contact with the types. Every method was
  `Promise<unknown>`; migrating a real domain model into `Promise<unknown>` is a breaking change *anyway*,
  so keeping the interfaces bought nothing over deleting them while continuing to advertise a feature that
  did not exist.

This is recorded as a reversal, not a settled decision. If the maintainer prefers the original
annotate-don't-delete stance, it is a `git revert` of the storage slice — the deletion is isolated to it.
§8's *other* open items are untouched and still open.
