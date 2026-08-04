# sail-desktop-agent — collapse `DesktopAgent` / `SailDesktopAgent` into one class

> **Note (2026-08-04 `sail-platform` cull).** This plan's own work is done and stands. Its references
> to `sail-platform` are stale: `SailPlatform` and `createSailBrowserDesktopAgent` are deleted, so the
> "two entry points" this collapse had to keep working are now one — `new SailDesktopAgent({...})`.
> The WCP4 origin allowlist discussed here is parked, not deleted: see
> `.cursor/plans/parked-wcp4-origin-allowlist.md`.

**Status:** all slices landed (uncommitted) — 1, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6.
**Branch base:** `wip/v3-local`
**Version context:** `3.0.0-pre.1.0` — pre-release, never published to npm (`npm view` 404 for both
packages, per draft-PR register item 13). No backward-compatibility obligation.
**Scope:** `packages/sail-desktop-agent` only. `sail-platform` and `sail-finance` are touched as
consumers, not redesigned.

---

## Relationship to existing plans

The user asked whether this supersedes anything. Verdict per plan:

| Plan | Status | Relationship |
|---|---|---|
| `sail-desktop-agent-surface-reduction.md` | implemented | **Extends, does not supersede.** This is the root-cause fix for three deviations that plan had to accept. Its Principle 1 ("Ship it whole. `SailDesktopAgent` is the product") is the authority for the naming decision here. |
| `sail-desktop-agent-review-remediation.md` | done | **No open overlap.** Honour its parked decision: module-global timer maps stay (one DA per tab). Do not reintroduce WeakMap owner-keying. |
| `draft-pr-readiness.md` **item 14** | `NEEDS WORK`, review artifact | **This plan is the work order for item 14.** Annotate that item; do not supersede the register — it is standing oversight covering 31 areas. |
| `agent-observability-seam.md` | planning, slice 1 not started | **DIRECT CONFLICT — must sequence. This plan lands first.** See below. |
| `website-docs-defect-register.md` row B2 | open | **Resolved by this plan** (deletes the API the row says is wrongly documented). |
| `reusable-browser-host-kit.md` | A done, B parked | No conflict. |
| `sail-platform-design.md` / `-kiss-entry.md` / `-extensibility.md` | various | Different package. No overlap with the class structure. |

### Sequencing against `agent-observability-seam.md`

That plan's Slice 1 edits `src/agent/desktop-agent.ts`, `src/agent/sail-desktop-agent.ts` and
`src/index.ts` — the three files this plan rewrites — and adds `agent.observe(fn)` "using the
existing controller pattern (`apps.onConnect` shape)". Its own Trap 4 concerns the
`changeAppChannel` waiter, which this plan also moves.

It already carries the rule for this situation: *"Do not interleave with the remediation plan…
Land that first."* Same applies here, in this order:

1. This plan (structure).
2. Then observability slice 1, re-based onto one class.

Landing observability first means building a new controller and a widened `createHandlerContext`
onto a class structure that is about to change, then redoing both.

---

## Why

`DesktopAgent` is not a working Desktop Agent. `createHandlerContext` throws without an attached
edge ([desktop-agent.ts:338-344](../../packages/sail-desktop-agent/src/agent/desktop-agent.ts:338)),
and every routing path funnels through it — `handleMessage`, `handleWcpMessage`,
`disconnectInstance`, `changeAppUserChannel`. A bare `new DesktopAgent()` holds state and answers
catalog queries but cannot process one FDC3 message. The surface-reduction plan documented this
at its line 144 rather than fixing it.

`SailDesktopAgent extends DesktopAgent` exists mainly to supply that edge. It **overrides
nothing** — it only adds. Three concrete costs, all already recorded in that plan's own
"Deviations" section:

- `index.ts:24-29` exports `DesktopAgent` under *"Exported because TypeScript declaration emit
  requires it to be nameable — not an entry point."*
- `index.ts:66-70` does the same for `BrowserAppConnection`, *"exported only because
  `SailDesktopAgent.connector` is typed with it."*
- `updateState` is `protected` ([desktop-agent.ts:378](../../packages/sail-desktop-agent/src/agent/desktop-agent.ts:378))
  solely so the subclass can reach it.

Plus a hand-maintained mapping: `SailDesktopAgentOptions extends Pick<DesktopAgentOptions, …>`
([sail-desktop-agent.ts:86-96](../../packages/sail-desktop-agent/src/agent/sail-desktop-agent.ts:86))
then nine fields re-forwarded into `super()` ([:233-246](../../packages/sail-desktop-agent/src/agent/sail-desktop-agent.ts:233)).

And the duplication that follows from it: **14 public base methods are shadowed by a controller
member**. Ten of them have exactly one caller in the entire monorepo — the forwarding lambda in
`createAppsController` ([:335-379](../../packages/sail-desktop-agent/src/agent/sail-desktop-agent.ts:335),
45 lines of `a => this.b(a)`).

| Controller member | Shadowed base method | Callers of the base method, repo-wide |
|---|---|---|
| `apps.add` | `addApp` | 1 (the lambda) |
| `apps.addAll` | `addApps` | 1 |
| `apps.addDirectory` | `addAppDirectory` | 3 |
| `apps.remove` | `removeApp` | 1 |
| `apps.getAll` | `getApps` | 1 |
| `apps.getById` | `getApp` | 1 |
| `apps.open` | `openApp` | 1 |
| `apps.getInstances` | `getAppInstances` | 1 |
| `apps.getInstance` | `getAppInstance` | 1 |
| `apps.getConnections` | `getAppConnections` | 1 |
| `apps.getConnection` | `getAppConnection` | 1 |
| `channels.getUserChannels` | `getUserChannels` | 9 (**the one with real external callers**) |
| `channels.getAppChannelId` | `getAppUserChannelId` | 2 |
| `channels.changeAppChannel` | `changeAppUserChannel` | 1 |

Not duplicates, and staying: `apps.disconnect`, `apps.onConnect/onDisconnect/onHandshakeFailure`,
`channels.onAppChannelChange` (all route to `connector`), and `channels.getAppChannel` (composed).

Base methods with no controller equivalent, staying flat: `start`, `stop`, `getState`,
`exportState`, `getIsStarted`, `getImplementationMetadata`, `registerPendingHostInstance`,
`disconnectInstance`.

---

## Principles

1. **One class, one name: `SailDesktopAgent`.** Per surface-reduction Principle 1. The `Sail`
   prefix is a correctness distinction, not branding — FDC3 defines `DesktopAgent` as the
   *app-facing* interface behind `window.fdc3` (`broadcast`, `raiseIntent`, `addContextListener`).
   This class is the *host-facing* implementation (`start`, `stop`, `apps`, `channels`). Zero
   method overlap. Naming it `DesktopAgent` would send readers looking for `.broadcast()`.
   *(Checked: nothing in this repo currently imports `DesktopAgent` from `@finos/fdc3`, so the
   collision is latent, not active.)*
2. **Complete on construction.** The edge is a constructor parameter with a default. The
   invariant holds for the object's whole lifetime. No two-phase object.
3. **`new`, not a factory.** Construction is synchronous and total. `directoriesLoaded` already
   handles the async part correctly — do not turn it into `await SailDesktopAgent.create()`.
4. **Explicit `.start()`.** `new` builds the object; it does not attach `window` listeners.
   Symmetric with the existing `.stop()`.
5. **One spelling per operation.** Grouped controllers are the surface. The flat catalog methods
   become non-public.
6. **YAGNI on seams** (inherited). The edge stays injectable *only* because the test edge is a
   real, load-bearing consumer. It does not become a public extension point.

---

## Landmines — read before starting

### 1. `sail-platform` monkey-patches a private method. **[verified — hazard RETIRED by 2.3, see below]**

> **Status update after slice 2.3.** The bind-early hazard described below is **gone for the only
> production path that uses it.** Removing `autoStart` flipped the ordering in
> `createSailBrowserDesktopAgent` from *construct(auto-starts) → wire* to *construct → wire →
> caller starts*. The patch now lands on `handleMessage` strictly **before** `start()` runs, so
> `.bind(this)` would capture the already-patched method and the control survives. Proven
> empirically: 2.3 re-ran the bind-early experiment and the interception test **stayed green**,
> where in 2.0 it went red.
>
> Verified `sail-browser-desktop-agent.ts:73` is the **only** production wiring site
> (`SailPlatform` does not wire the allowlist), so the retirement is complete, not partial.
>
> **What the 2.0 test now protects:** that the allowlist intercepts genuine WCP4 traffic on the
> real message path rather than a mock. That is still worth having. It no longer protects against
> bind timing, because that hazard no longer exists here.
>
> **Do not delete the rules below.** They become live again the moment anything re-introduces
> auto-start, or wires the allowlist after `start()`. The monkey-patch itself is unchanged and is
> still reaching past a `private` modifier.

### 1 (original). The mechanism, for reference. **[verified]**

[`wcp4-origin-allowlist.ts:68-71`](../../packages/sail-platform/src/wcp4-origin-allowlist.ts:68):

```ts
const agent = desktopAgent as unknown as DesktopAgentInternals
const originalHandleMessage = agent.handleMessage.bind(desktopAgent)
agent.handleMessage = async (message: unknown) => { /* origin check */ }
```

`handleMessage` is `private` on `DesktopAgent`. The patch works **only** because `start()` does a
dynamic `this.handleMessage(message)` lookup inside a closure
([desktop-agent.ts:224-226](../../packages/sail-desktop-agent/src/agent/desktop-agent.ts:224)).

This is a **security control** (WCP4 origin allowlist). Per draft-PR register item 17: change that
line to `.bind(this)` — which looks like a tidy-up — and the wrapper becomes a dead property that
never runs, **with no type error** (the `as unknown as` erased it) and **no test failure** (the
existing suite drives a hand-built mock and proves the wrapper's branching, not its interception).

**Rules for this plan (decision 1, resolved):** the monkey-patch **stays**. Do not rename or
relocate `handleMessage`. Do not change how `start()` reaches it — it must remain a dynamic
`this.handleMessage(message)` lookup inside the closure, never `.bind(this)`.

Slice 2.0 lands an interception test *before* any of that code is touched, so a regression is
caught by a red test rather than by nobody. The `validateOrigin?: (ctx) => boolean | Promise<boolean>`
hook on `appConnectionOptions` — which would delete both casts and close half of draft-PR item 15
— is deliberately **out of scope** and stays available as a follow-up.

Also note `wcp4-origin-allowlist.ts:8` types
`DesktopAgent & Pick<SailDesktopAgent, "connector">` — uses **both** class names. This one *will*
produce a compile error, so it is the safe half.

### 2. `@internal` is decorative in this repo. **[verified, draft-PR item 14]**

There is no `stripInternal` and no api-extractor anywhere. Plain `tsc` treats the tag as a comment,
so every `@internal` symbol still emits into the `.d.ts` as public API. Marking the new
`appConnection` option `@internal` therefore hides nothing at the type level.

Do not repeat the surface-reduction plan's mistake of treating the tag as enforcement. Either
enable `stripInternal` in the build, or accept the option is nominally public and say so in the
outcome. **Open decision.**

### 3. The `changeAppChannel` waiter is shared with the observability plan.

`changeAppChannel` ([sail-desktop-agent.ts:381-413](../../packages/sail-desktop-agent/src/agent/sail-desktop-agent.ts:381))
is promise + timeout + `channelChanged` correlation — real logic, not a forward. It is the only
member of the controllers that must survive as behaviour. It is also observability Trap 4. Moving
it is mechanical here; a mistake hangs a channel pill for 10s.

### 4. Three construction paths exist today, and neither shell uses `new SailDesktopAgent`.

- `sail-finance/src/main.tsx:107` — `createSailBrowserDesktopAgent(...)` from `sail-platform`
- `sail-one/src/state/sail-host.ts:129` — `new SailPlatform({...})` → `:155 platform.start()`
- tests and `sail-platform.ts:227` — `new SailDesktopAgent(...)`

`createSailBrowserDesktopAgent` is the `Object.assign(desktopAgent, { use })` wrapper whose
middleware is inert (draft-PR item 15, `BLOCKER`). **Out of scope here** — but every consumer edit
below must account for it, and it should not be "fixed" as a side effect.

---

## Phase 1 — Collapse the duplicate spellings

**No structural change. `extends` stays. Independently shippable and independently valuable.**

Stop here if appetite runs out — this removes most of the surface bloat on its own.

- Make the 11 shadowed `apps.*` base methods and `getAppUserChannelId` / `changeAppUserChannel`
  non-public. They have one caller each (the controller lambda), which moves inline.
- **`getUserChannels` is the exception** — 9 callers, including `sail-platform.ts:354` and
  `sail-finance/src/components/ChannelSelector.tsx:28`. Both already go via `.channels.`. Verify,
  then demote.
- Remove `SailPlatform.changeAppChannel` / `getUserChannels` / `getAppUserChannel`
  ([sail-platform.ts:344-369](../../packages/sail-platform/src/sail-platform.ts:344)) — a third
  alias of `platform.channels.*` adding no behaviour.

**Acceptance:** one spelling per operation. `agent.getApps()` no longer type-checks;
`agent.apps.getAll()` does. No behaviour change.

**Watch:** cucumber steps and the conformance harness use `getState`, `disconnectInstance`,
`registerPendingHostInstance`, `getIsStarted`. Those are **not** in the shadowed set — leave them.

---

## Phase 2 — One class

**Breaking. Depends on Phase 1.**

### 2.1 Edge becomes a constructor parameter

```ts
export interface SailDesktopAgentOptions {
  // … existing options, flattened (no Pick<>)
  /** Test edge injection. Defaults to the browser WCP edge. */
  appConnection?: AgentAppConnection
}
```

Safe to default because `BrowserAppConnection`'s constructor is **inert** —
[browser-app-connection.ts:74-106](../../packages/sail-desktop-agent/src/app-connection/browser-app-connection.ts:74)
sets options and builds a registry; no `window`, no `addEventListener`. Those happen in `start()`.
**[verified]**

- Delete `attachAppConnection` and the `@internal` doc block. Its three call sites
  (`sail-desktop-agent.ts:261`, `test/support/desktop-agent-test-harness.ts:9`,
  `test/world/index.ts:116`) collapse into construction.
- Delete the throw in `createHandlerContext` — the invariant now holds. Keep the `const conn`
  hoist from remediation slice 10.
- Move `bindAgentState` into the agent's own constructor (`edge.bindAgentState?.({…})`), replacing
  the external wiring at `sail-desktop-agent.ts:255-260`. The optional-method shape already exists
  on `AgentAppConnection` (`setOnAgentDisconnect?`, `notifyChannelMembershipChanged?`).
- `wireDacpTestAppConnection` in `test/support/desktop-agent-test-harness.ts` disappears.

### 2.2 Merge the classes

- Fold everything from `SailDesktopAgent` into `DesktopAgent`, then rename the result
  `SailDesktopAgent`. Delete `desktop-agent.ts` or `sail-desktop-agent.ts` — one file, not two.
- Drop `protected` from `updateState` → `private`.
- Flatten `SailDesktopAgentOptions` — no `Pick<>`, no `super()` re-forward.
- Keep `DesktopAgentAppInstance` / `DesktopAgentOpenOptions` type names or rename them; they are
  exported and used. **Prefer keeping** — renaming is churn with no gain.
- `connector` currently types as `BrowserAppConnection`; under one class the field types as
  `AgentAppConnection`. Either make the class generic in its edge or narrow the property. One line
  either way — but check `sail-platform`'s `Pick<SailDesktopAgent, "connector">` compiles.

### 2.3 Explicit `.start()`

- Delete the `autoStart` option and the `autoStart !== false` call at
  [sail-desktop-agent.ts:280-282](../../packages/sail-desktop-agent/src/agent/sail-desktop-agent.ts:280).
- Add `.start()` at every construction site. In-package tests already pass `autoStart: false` in
  4 of 6 places, so most are one-line additions.
- `sail-platform.ts:227-247` must call `desktopAgent.start()` inside `SailPlatform.start()`.

**Discovered during 2.0 — this slice changes the origin-allowlist ordering.** **[verified]**
[`sail-browser-desktop-agent.ts:63`](../../packages/sail-platform/src/sail-browser-desktop-agent.ts:63)
constructs the agent (which **auto-starts inside the constructor** today), then wires the allowlist
at `:69`. So in production the monkey-patch is applied **after** `start()` — the dynamic
`this.handleMessage` lookup is not merely theoretically load-bearing, it is the only reason the
security control functions at all.

Removing `autoStart` flips that: `createSailBrowserDesktopAgent` will construct → wire → and the
caller starts later, so the patch lands **before** `start()`. That is strictly safer (it would
survive even early binding), but it is a real semantic change and must be deliberate, not
incidental. Two consequences:

- `createSailBrowserDesktopAgent` currently returns an **already-started** agent. After this slice
  it returns a stopped one. `sail-finance/src/main.tsx:107` is the consumer — it needs `.start()`.
  Decide whether the function starts the agent itself (preserving its contract) or the caller does.
- Slice 2.0's test asserts the *current* after-start ordering. When this slice lands, that test
  must be re-pointed at whichever ordering survives — **and must still be proven discriminating by
  the same bind-early experiment.** Do not let it silently degrade into a test that passes either
  way.
- **This fixes docs defect item 22**: `packages/platform/overview.md:76-84` calls
  `desktopAgent.start()` after `createSailBrowserDesktopAgent`, which auto-starts today and throws
  `"DesktopAgent is already started"`. With explicit start the documented sample becomes correct.

### 2.4 Index cleanup

- Delete the `DesktopAgent` type export and its apology comment (`index.ts:24-29`).
- Re-check whether `BrowserAppConnection` still needs exporting (`index.ts:66-70`) — depends on the
  2.2 `connector` typing choice.
- Resolves **docs register row B2** (`new DesktopAgent()` → `attachAppConnection(customConnection)`
  documented as manual composition; the API ceases to exist).

---

## Test Plan

Risk-based. This is a refactor — the suite is the specification.

- **No new behaviour, so no reproduction-first tests**, with two exceptions below.
- **Reproduction-first — `changeAppChannel` redundant join.** The remediation plan's slice 1
  regression guard (redundant join resolves promptly, not a 10s timeout) must still pass after the
  waiter moves. This is the single highest-risk behavioural carry-over.
- **Reproduction-first — WCP4 origin allowlist actually intercepts.** The existing test proves
  branching, not interception (item 17). Before touching anything near `start()` or
  `handleMessage`, write a test that fails if the wrapper is bypassed. Without it, landmine 1 is
  undetectable.
- **Conformance is the real gate:** `npm run test:cucumber` — 154/154 scenarios, 1461/1461 steps.
  Any movement means the collapse changed behaviour.
- **Declaration emit is the gate for 2.4:** `npm run validate` in the package decides which types
  actually survive removal. Cut, run `tsc`, restore only what the compiler demands — the
  surface-reduction plan's method, which is how it discovered the `BrowserAppConnection` deviation.
- **Not testing:** the shadowed-method removal in Phase 1 (typecheck is the test).

---

## Verification

```bash
npm run validate -w @finos/sail-desktop-agent
npx vitest run --root packages/sail-desktop-agent
npm run test:cucumber
npx vitest run --root packages/sail-conformance-harness
npm run typecheck   # sail-platform, sail-finance, sail-one
npm run build
```

Baselines to hold (from remediation slice 10+11 verification notes):
vitest 329/329 across 50 files · cucumber 154/154 · conformance-harness 69/69.

Known-unrelated failures that will still be red: `sail-one` html entrypoint and `sail-finance`
tsconfig `types` (draft-PR items 9, 10). **Do not fix them here.**

---

## Expected outcome

| | Before | After |
|---|---|---|
| Agent classes | 2 (`DesktopAgent`, `SailDesktopAgent`) | 1 (`SailDesktopAgent`) |
| Public spellings per app/channel operation | 2 (3 via `SailPlatform`) | 1 |
| Shadowed public methods | 14 | 0 |
| Construction phases | 2 (`new` + `attachAppConnection`) | 1 |
| `createHandlerContext` throw path | yes | removed (invariant holds) |
| Apologetic `@internal` root exports | 2 | 0–1 |
| `protected` members | 1 | 0 |
| Start semantics | implicit `autoStart`, `.start()` throws if already started | explicit `.start()` |

Resolves: draft-PR register **item 14**; docs defect register rows **B2** and (via 2.3) the
`start()`-after-auto-start half of **item 22**.

---

## Open decisions — all resolved 2026-08-03

1. **`validateOrigin` hook — RESOLVED: interception test only, no hook.** (Landmine 1.) Write a
   test that fails if the WCP4 origin wrapper is bypassed, and land it **before** any slice touches
   `start()` or `handleMessage`. The `as unknown as` casts in `wcp4-origin-allowlist.ts` stay. The
   hook remains available as a follow-up and still closes half of draft-PR item 15 when someone
   wants it. Rationale: the test is what makes the collapse *verifiable*; the hook is scope.
2. **`@internal` — RESOLVED: enable `stripInternal`, sequenced after 2.4.** (Landmine 2.) New slice
   2.5. Deliberately last: enabling it before the index cleanup risks breaking declaration emit
   while public symbols still reference internal types. This makes every existing `@internal` tag
   in the package real, not just the new `appConnection` option, and resolves the root cause behind
   draft-PR item 14.
3. **Phase 1 only, or both? — RESOLVED: both.**
4. **Rename `DesktopAgentAppInstance` / `DesktopAgentOpenOptions`? — RESOLVED: no.** Churn with no
   gain; both are exported and used.

## Slice Checkpoints

- [x] 1 — Collapse duplicate spellings (14 shadowed methods; `SailPlatform` third alias)
- [x] 2.0 — **WCP4 origin-allowlist interception test** (must precede 2.1–2.3; landmine 1)
- [x] 2.1 — Edge as constructor parameter; delete `attachAppConnection`
- [x] 2.2 — Merge the two classes
- [x] 2.3 — Explicit `.start()`; delete `autoStart`
- [x] 2.4 — Index cleanup; declaration-emit pass
- [x] 2.5 — Enable `stripInternal`; confirm `@internal` symbols leave the `.d.ts`
- [x] 2.6 — **NEW (found in 2.2):** reunify `connector` / `appConnection`; remove the
  injection-gated intent-resolver wiring — see "Known issue" below

## Known issue — opened by 2.2, fixed by 2.6

Merging the classes removed a structural distinction (browser class vs bare class) and re-expressed
it as **two implicit conditionals on whether an edge was injected**. Both live in
`src/agent/sail-desktop-agent.ts`:

1. **`connector` and `appConnection` can diverge.** `connector` is *always* a freshly built
   `BrowserAppConnection` (`:156`, `:162`); `appConnection` is `config.appConnection ?? browserAppConnection`
   (`:166`). In the browser path they are the same object. With an injected test edge they are not —
   so the controllers, which wire to `connector` (`apps.onConnect`, `channels.onAppChannelChange`),
   would listen on an object nothing routes through.
   **Not a live bug** — verified the only two injection sites
   (`test/support/desktop-agent-test-harness.ts:9`, `test/world/index.ts:115`) use no controllers.
   It is a latent trap: `new SailDesktopAgent({ appConnection: edge }).apps.onConnect(fn)` would
   silently never fire. Every injected-edge agent also allocates an unused `BrowserAppConnection`
   (harmless — the constructor is inert).
2. **`if (config.appConnection === undefined)` gates the `requestIntentResolution` wiring** (`:172`).
   This encodes "am I under test?" into the production class. It was a genuine regression 2.2 found
   the honest way — wiring it unconditionally broke 4 Cucumber multi-handler `raiseIntent`
   scenarios, because bare `DesktopAgent` never had that wiring. The gate restores the old
   per-class behaviour exactly, so it is a faithful port, not a bodge — but the shape is wrong.

**Proposed fix (slice 2.6):** point the controllers at `this.appConnection` (the edge that actually
routes) and make `connector` a narrowed view of it rather than a second object; then derive the
intent-resolver wiring from a real capability check rather than from "was an option passed".
Deferred rather than folded into 2.2 to keep that slice reviewable.

## Verification Notes

- **Slice 1 GREEN:** vitest 329/329 across 50 files · cucumber 154/154 scenarios / 1461 steps ·
  conformance-harness 69/69 · `validate -w @finos/sail-desktop-agent` exit 0 · root typecheck clean
  across all workspaces (including `sail-finance` and `sail-one`, which draft-PR items 9/10 listed
  as failing — they pass on this tree; that register was written against `457a0896c`, four commits
  behind, so treat those items as possibly stale).
- Slice 1: all 14 demoted to **`protected`**, not `private` — `private` is unreachable from a
  subclass and `extends` still exists in Phase 1. Tighten to `private` in 2.2 after the merge.
- Slice 1 deviation: `resolveUserChannelById` in `sail-desktop-agent.ts` is a **free function**
  taking a `DesktopAgent`, so it could not call a protected method regardless of caller. Signature
  changed to take `BrowserTypes.Channel[]`; both call sites pass `this.getUserChannels()`.
- **Slice 1 debt — must be repaid in 2.2.** Three internal test files construct a bare
  `new DesktopAgent(...)` and call flat methods on it. Bare `DesktopAgent` has no `.apps`/
  `.channels`, so escape-hatch `as unknown as {…}` casts were added rather than inventing
  controller members:
  `src/__tests__/desktop-agent-user-channels.test.ts:57`,
  `src/app-directory/__tests__/app-directory-logger.test.ts:33`,
  `src/app-connection/__tests__/wcp-multi-pending-adoption.integration.test.ts:38`.
  Once 2.2 merges the classes these tests can construct `SailDesktopAgent` and use the real
  controllers. **Delete all three casts in 2.2** — leaving them re-creates the exact
  cast-past-the-access-modifier smell this plan exists to remove.
- **Slice 2.0 GREEN:** new `packages/sail-platform/src/__tests__/wcp4-origin-allowlist-interception.test.ts`
  — two cases driving a real jsdom WCP1–5 handshake (`window.postMessage` / `MessageChannel` →
  real `MessagePort` → `bridgeAppPort` → `onAppMessage` → the closure `start()` installs). Never
  calls `agent.handleMessage(...)` directly. sail-platform vitest 27/27 across 6 files.
- **Slice 2.0 — the bind-early proof (this is the point of the slice).** Temporarily changing
  `start()` to `onAppMessage(this.handleMessage.bind(this))` made the test go red:

  ```
  AssertionError: expected 'App not found in app directory' to match /not allowed/i
  ```

  The disallowed-origin WCP4 reached the *real* `handleWcp4ValidateAppIdentity` and failed for an
  unrelated reason instead of being rejected for origin — precisely the bypass signature. Test is
  therefore proven discriminating, not merely present. Edit reverted; `start()`'s dynamic-lookup
  closure re-verified byte-identical afterwards.
- **Slice 2.0 mechanism note.** A hand-built test edge (`DacpTestAppConnection`) cannot be used
  here: `wireWcp4OriginAllowlist` takes `DesktopAgent & Pick<SailDesktopAgent, "connector">`, which
  structurally requires a real `BrowserAppConnection` (it has private members). The real handshake
  was the only mechanism that both type-checks and exercises the genuine path.
- **Slice 2.1 GREEN:** vitest 329/329 (50 files) · sail-platform 27/27 (6 files, incl. the 2.0
  interception test) · cucumber 154/154 / 1461 steps · conformance-harness 69/69 · root typecheck
  clean. Independently verified: `attachAppConnection` has zero hits package-wide, the
  `createHandlerContext` throw is gone, and `start()`'s dynamic-lookup closure is intact at
  `desktop-agent.ts:256-257`.
- Slice 2.1 constructor order (the ordering trap): assign `this.appConnection` → `bindAgentState?.()`
  → `setOnInstanceTeardown()` → `setOnAgentDisconnect?.()`. `this.appConnection` is now non-optional
  (`AgentAppConnection`, not `| undefined`), which is what let the throw be removed cleanly.
- Slice 2.1: `bindAgentState` added as **optional** on `AgentAppConnection`, matching the existing
  `setOnAgentDisconnect?` / `notifyChannelMembershipChanged?` shape. `BrowserAppConnectionSurface`
  still redeclares it required (optional→required narrowing in an extending interface; `tsc`
  accepts). `appConnection` was added to `DesktopAgentOptions`/`DesktopAgentConfig` only, not
  `SailDesktopAgentOptions` — 2.2 merges them into one flat options type anyway.
- **Pre-existing gate failure, not ours, do not fix here:** `npm run validate -w
  @finos/sail-desktop-agent` fails `format --check` on 8 files untouched by this effort
  (`handlers/cleanup.ts`, `handlers/heartbeat/handlers.ts`, three `handlers/intents/*.ts`,
  `test/step-definitions/messaging.steps.ts`, `private-channel.steps.ts`). Confirmed via
  `git status` that none are modified by this work. Typecheck and lint are clean. Worth a separate
  formatting pass; flagging so a later slice does not misread it as a regression.
- Pre-existing flake: `src/app-connection/__tests__/wcp-host-logger-threading.test.ts` is
  timing-sensitive and failed once under load, passing in isolation and on re-run. Unrelated to
  slice 1's files. Re-run before treating it as real.
- **Tree caveat for every slice after 1.** Verification from slice 1 onward runs against a working
  tree carrying substantial uncommitted `sail-platform` work from another session (deleted
  `middleware/middleware.ts`, `interfaces/*`, `types/sail-messages.ts`,
  `client/local-storage-backend.ts`, `client/platform-api.ts`,
  `__tests__/host-contracts-reexport.test.ts`; edits to `sail-browser-desktop-agent.ts`,
  `sail-platform/src/index.ts`, `sail-finance/src/main.tsx`; new untracked `client/__tests__/`).
  Net −1152 lines. It is not part of this plan and was flagged to the user, who chose to continue.
  Greens are therefore relative to that tree, not to `HEAD`.
- **Slice 2.3 GREEN:** vitest 329/329 (50 files) · sail-platform 27/27 (6 files) · cucumber
  154/154 / 1461 steps · conformance-harness 69/69 · `validate -w @finos/sail-desktop-agent`
  typecheck/lint clean (format drift only on the same pre-existing 7 files, none touched here) ·
  root typecheck clean across all workspaces. Rebuilt `sail-desktop-agent`'s dist before the
  sail-platform runs and before root typecheck, per this plan's own note — the first
  pre-rebuild sail-platform run failed 13/27 with `"DesktopAgent is already started"` because the
  linked dist still had the old always-auto-start constructor.
- Slice 2.3: `autoStart` deleted from `SailDesktopAgentOptions` and the constructor. `.start()`
  added at every construction site that needs a running agent: `wcp-host-logger-threading.test.ts`,
  both cases in `heartbeat-connect-flood.test.ts`, `createStrictBrowserAgent()` in
  `wcp-inbound-validation.test.ts`, the shared `createTestAgent()` fixture in
  `wcp-desktop-agent.integration.fixtures.ts` (backs ~50 WCP integration test call sites),
  `SailPlatform.start()`, `sail-finance/src/main.tsx`, and both cases in the 2.0 interception test
  (`wcp4-origin-allowlist-interception.test.ts`). Everywhere else `autoStart: false` was simply
  dropped — those sites either already called `.start()` explicitly
  (`desktop-agent-test-harness.ts`, `test/world/index.ts`, `harness-bootstrap.ts`,
  `sail-desktop-agent-lifecycle.test.ts`) or never needed a running agent at all (pure
  state/catalog unit tests).
- **`createSailBrowserDesktopAgent` contract — resolved: caller starts, factory does not.**
  `SailPlatform.start()` and `sail-finance/src/main.tsx` now call `.start()` explicitly on the
  agent the factory returns. Reasoning: the factory is sugar over `new SailDesktopAgent()` with
  Sail defaults merged in and the allowlist wired — construction-time concerns only. Auto-starting
  inside it would reintroduce, one layer up, exactly the implicit two-phase behaviour this slice
  removes from the constructor, and the naming (`create…`, not `createAndStart…`) doesn't promise
  a running agent. `SailPlatform.start()` was already required by this slice to call
  `desktopAgent.start()` itself, which independently confirms *some* caller must do it — making
  the factory do it too would just be a second, redundant place to reason about start ordering.
- **Origin-allowlist ordering — deliberate, not incidental.** Removing `autoStart` flips
  `createSailBrowserDesktopAgent`'s ordering from *construct (auto-starts) → wire allowlist* to
  *construct → wire allowlist → caller starts*. The allowlist patch now lands on `handleMessage`
  strictly before `start()` ever runs, for every production and test caller of that factory.
  **Bind-early experiment re-run under the new ordering:** temporarily changed `start()` to
  `onAppMessage(this.handleMessage.bind(this))`, rebuilt `sail-desktop-agent`'s dist, re-ran
  `wcp4-origin-allowlist-interception.test.ts` — **both cases stayed green.** This is the expected,
  predicted result: `.bind(this)` now captures `handleMessage` *after* `wireWcp4OriginAllowlist`
  has already overwritten it on the instance, so early-binding no longer discards the patch. The
  hazard this test was written to catch (slice 2.0, when `createSailBrowserDesktopAgent`
  auto-started before wiring) is genuinely gone for this production path — reverted immediately
  after the experiment, dist rebuilt again, full sail-platform suite re-confirmed 27/27. The test
  still has value: it proves the allowlist actually intercepts real WCP4 traffic (not just a mock's
  branching), which is real coverage independent of bind timing. What it can no longer prove is the
  *early-binding* hazard specifically — that guarantee now comes from the ordering itself
  (wire-before-start is structural, not incidental to closure timing), not from this test. Per the
  plan's instruction not to alter `start()`'s dynamic lookup or relocate `handleMessage`, both are
  untouched in the landed code — this was purely an experiment, run and reverted.
- Docs fixed to match: `website/docs/packages/platform/overview.md:76-84` (resolves item 22's
  `start()`-after-auto-start half — the sample now calls `.start()` and no longer throws),
  `website/docs/packages/desktop-agent/integrator-guide.md` (two examples plus prose that said
  "auto-started by default"), `packages/sail-desktop-agent/README.md` (minimal example). Not
  touched: `.cursor/plans/*` (historical planning docs) and
  `.cursor/skills/consume-sail-desktop-agent/SKILL.md` (already describes a `/presets` /
  `createBrowserDesktopAgent` architecture that doesn't match this codebase at all, independent of
  this slice — out of scope to fix here).
- **Slice 2.4 GREEN:** vitest 329/329 (50 files, 1 known flake re-confirmed by isolation re-run) ·
  sail-platform 27/27 (6 files, incl. the 2.0 interception test, re-run individually and green) ·
  cucumber 154/154 / 1461 steps · conformance-harness 69/69 · `validate -w @finos/sail-desktop-agent`
  typecheck/lint clean (format drift only on the same pre-existing 8 files, none touched here — the
  4 files this slice edited pass `vp fmt --check` individually) · root typecheck clean across all
  workspaces including `sail-finance`, `sail-one`, `sail-docs`. Rebuilt `sail-desktop-agent`'s dist
  before every sail-platform/conformance-harness run and before root typecheck, per the plan's
  build-ordering note.
- **Root export count: 40 → 39.** Measured empirically by swapping the pre-slice and post-slice
  `index.ts` into the build and diffing `dist/index.d.mts`'s bundled `export { ... }` statement —
  not by reading source. Exactly one symbol removed: `SailDesktopAgentHostControllers`.
- **`DesktopAgent` type export: already gone before this slice started.** Slice 2.2's merge had
  already deleted `index.ts`'s `DesktopAgent` re-export and its apology comment as a side effect
  (confirmed via `git diff HEAD` — the working tree already differed from `HEAD` on exactly those
  lines before slice 2.4 touched anything). Nothing to do here beyond confirming it stayed gone
  through the rest of this slice's edits.
- **`BrowserAppConnection` — survived, and the reason changed.** Cut it from `index.ts`, rebuilt
  dist, ran `sail-platform` typecheck: `error TS2459: Module '"@finos/sail-desktop-agent"' declares
  'BrowserAppConnection' locally, but it is not exported`, pointing at
  `sail-platform.ts:17` (`import type { AppConnectionMetadata, BrowserAppConnection } from
  "@finos/sail-desktop-agent"`), used at `:102` (`private _browserAppConnection:
  BrowserAppConnection | null`) and `:210` (`get connector(): BrowserAppConnection`). This is not
  the deviation the surface-reduction plan originally described ("declaration emit requires it to
  be nameable") — `sail-desktop-agent`'s own `tsc` and `vp pack` both succeed with the export
  removed, because `BrowserAppConnection` is already `export class`-ed from its own defining module
  and the `.d.mts` bundler inlines referenced-but-unexported types as anonymous locals without
  complaint. The real reason is a genuine external consumer importing the name directly. Restored
  the export and rewrote its doc comment to say so; it must **not** be marked `@internal` — doing so
  would make it a `stripInternal` casualty in 2.5 and break `sail-platform`'s build.
- **`AppConnectionMetadata` / `AppConnectionOptions` — both survived, both genuinely public.**
  Same cut-and-rebuild method: removing both produces `TS2459` in `sail-platform.ts:17`
  (`AppConnectionMetadata`), `sail-platform/src/index.ts:51-52` (both, re-exported), the
  `sail-platform-preset-wiring.test.ts:8` (`AppConnectionOptions`), and
  `sail-conformance-harness/src/harness-bootstrap.ts:3` (`AppConnectionMetadata`, used as the
  `onAppConnected` callback parameter type at `:173`). Neither was ever marked `@internal` in the
  doc comment (only `BrowserAppConnection` was), consistent with them being real public API rather
  than a declaration-emit artifact.
- **One additional export removed, found by applying the same method beyond the plan's three named
  deviations:** `SailDesktopAgentHostControllers` (the interface `SailDesktopAgent implements`).
  Zero repo-wide consumers (checked `sail-platform`, `sail-finance`, `sail-one`,
  `sail-conformance-harness` — only hit is the defining file and the `implements` clause itself).
  Cut it, rebuilt dist, ran typecheck on all four consumer packages plus `sail-desktop-agent`
  itself: all clean. The `implements` clause does not require the interface to be re-exported from
  `index.ts` — it only requires the interface to be exported from *some* module (it already is,
  from `sail-desktop-agent-controllers.ts`), which is a different, weaker constraint than being
  nameable from the package's single public entry point. Not one of the plan's three named
  deviations (it predates the two-class split, from the surface-reduction plan), but it fit the same
  failure mode — a controller-grouping convenience type nobody outside the class needs to name — so
  removed under the slice's general "audit the whole root export surface" instruction.
- **Tried and restored: `DesktopAgentAppInstance` / `DesktopAgentOpenOptions`.** Empirically these
  are *not* load-bearing either — cutting them, rebuilding, and typechecking all four consumers is
  clean, because the `.d.mts` bundler inlines them as anonymous local interfaces referenced
  structurally inside the exported `SailDesktopAgentApps` shape, and every current consumer
  (`sail-one/src/state/sail-host.ts`, `sail-conformance-harness/src/harness-bootstrap.ts` and
  others) only ever uses `apps.getInstance(s)` / `apps.open` through inference, never by importing
  the type name. Restored anyway: unlike `SailDesktopAgentHostControllers`, these are the return/
  param types of a commonly-called public method a shell would plausibly want to name explicitly
  (e.g. typing a list-of-running-instances prop), and the plan's own "Open decisions #4" already
  resolved *"RESOLVED: no [rename]... both are exported and used"* — a premise this slice's method
  could have overturned but chose not to, since they are unrelated to the two-class deviations this
  slice targets (no `@internal` tag was ever on them, and the "apologetic exports" count in the
  plan's own "Expected outcome" table only ever referred to `DesktopAgent` and
  `BrowserAppConnection`).
- **Not touched, deliberately:** `DACPTimeoutError` / `DACPProcessingError` — no repo consumer
  imports either by name, but they are unrelated to the subclass-collapse deviations (a host
  catching errors off a `cause` chain is a different design question than declaration-emit fallout
  from a deleted base class), so left as-is rather than re-litigated here.
- **Header comment:** already accurate before this slice started — the "two-class construction
  story" the task description warned about was already gone at `HEAD` (predates this slice; written
  during the surface-reduction plan's own pass, `git diff HEAD` shows no header lines changed by
  slices 2.1–2.3). Rewrote it anyway to state explicitly "there is no base class to extend or attach
  to" and to mention the now-mandatory explicit `.start()` call (2.3), which the old header never
  described.
- **Docs register row B2 — resolved.** `website/docs/packages/desktop-agent/integrator-guide.md`
  still described a "Manual composition ... `DesktopAgent` and `attachAppConnection()` are
  `@internal`" path in the "How to wire" decision tree (a `text` block) and its accompanying table,
  plus one prose sentence claiming "this package's own tests compose `DesktopAgent` and
  `attachAppConnection()` directly via internal source paths." Both APIs are fully deleted, not
  merely internal — verified the actual replacement pattern in
  `test/support/desktop-agent-test-harness.ts:1-9` (`new SailDesktopAgent({ ...options,
  appConnection: connection })`). Deleted the "Manual composition" branch from the decision tree
  (there is no longer a manual-composition path — that is the point of the collapse) and rewrote the
  table and prose to describe the real `appConnection` constructor-injection option instead.
- **Stray `{@link DesktopAgent}` doc references fixed, found while auditing.** Not part of the
  index.ts export surface, but same root cause (references to a class deleted in 2.2) and cheap to
  fix while in the area: `app-connection/browser-app-connection.ts:5`,
  `app-connection/types.ts:19,47`, `app-connection/browser-app-connection.ts:113`,
  `handlers/types.ts:155` — all changed `{@link DesktopAgent...}` to `{@link SailDesktopAgent...}`.
  Left alone: uses of the bare word "DesktopAgent" as English prose or as part of an unrelated name
  (`DesktopAgentBridging` — a real FDC3 optional-feature flag; `createDesktopAgentWithTestConnection`
  — a test helper name; test `describe`/`it` titles; the `"DesktopAgent is already started"` runtime
  error string) — none of these assert the deleted class still exists.
- **Slice 2.5 — STEP 0: `stripInternal` is a `tsc` option, but declaration emit for this package
  runs through `vp pack` → `tsdown` → `rolldown-plugin-dts` (empirically confirmed: build log's
  `[PLUGIN_TIMINGS]` block names `rolldown-plugin-dts:generate`/`:resolver` as the dominant build
  phases). That plugin does read the package's own `tsconfig.json` compilerOptions, `stripInternal`
  included — **it is honoured, not decorative here.** Proof: with `stripInternal` absent,
  `dist/index.d.mts` contains `appConnection?: AgentAppConnection;` on `SailDesktopAgentOptions`
  (the option tagged `@internal` at `sail-desktop-agent-types.ts:80`). Setting `stripInternal: true`
  and rebuilding removes that property line entirely, and with it the two supporting interfaces
  (`AgentAppConnection`, `AppConnectionDelivery`) that were only reachable through it — a clean
  before/after diff, saved during the session, confirms exactly those ~40 lines left the output and
  nothing else changed structurally at first.
- **Slice 2.5 — STEP 0 found a real defect, not a false alarm: stripInternal had collateral damage.**
  The first before/after diff showed the root `export { ... }` statement also silently dropped
  `AppConnectionMetadata` and `AppConnectionOptions` — two types that carry **no** `@internal` tag
  anywhere and are independently re-exported straight from `index.ts`
  (`export type { AppConnectionMetadata, AppConnectionOptions } from "./app-connection/browser-app-connection"`).
  Rebuilding `sail-platform` against that dist reproduced real breakage: `TS2459` at
  `sail-platform.ts:17`, `sail-platform/src/index.ts:51-52`, and
  `sail-platform-preset-wiring.test.ts:8` — i.e. enabling the option, unmodified, would have broken
  a genuinely public, never-tagged export. **Root cause traced and fixed, not worked around:**
  `app-connection/types.ts:5` carried a second, unused re-export of the same two names
  (`export type { AppConnectionMetadata, AppConnectionOptions } from "./wcp/wcp-types"`) — dead code,
  zero consumers repo-wide (checked; only `AgentAppConnection`, defined in that same file, is ever
  imported from `app-connection/types`). That file also holds the `AgentAppConnection` interface,
  which is only reachable through the now-`@internal`-stripped `appConnection` property. With
  `rolldown-plugin-dts`'s cross-module dedup, stripping the reachable-only-via-`@internal` path
  through that module corrupted the *other*, independently-exported re-export sharing the same file
  — a genuine bundler limitation, not a `tsc` semantics issue. Deleting the dead re-export line
  (`app-connection/types.ts:5`) fixed it outright: rebuilt, diffed again — the new before/after
  diff is *exactly* the `appConnection` property plus its two internal-only interfaces, nothing else;
  root export list is byte-identical to the `stripInternal`-off state aside from that. `sail-platform`
  re-typechecked clean afterward (0 errors). This satisfies the "before/after diff proving a symbol
  left the output" requirement *and* proves nothing else silently left with it.
- **Slice 2.5 — full `@internal` enumeration (9 tags, 9 distinct symbols):**
  1. `agent/sail-desktop-agent-types.ts:80` — `appConnection?: AgentAppConnection` property on
     `SailDesktopAgentOptions` (exported from `index.ts`). **No consumer imports it through the
     package** — checked `sail-platform`, `sail-finance`, `sail-one`, `sail-conformance-harness` for
     `appConnection:` as a constructed option; the only repo-wide hit outside this package's own
     source-importing tests is `sail-conformance-harness/src/harness-finos-teardown.ts:165`, which
     is a **false alarm** (see below) — an unrelated function parameter with the same name. Tag is
     correct; left as `@internal`.
  2. `handlers/heartbeat/runtime.ts:16` — `getActiveHeartbeatTimerCount`
  3. `handlers/heartbeat/runtime.ts:21` — `getActiveHeartbeatInstanceIds`
  4. `handlers/heartbeat/runtime.ts:26` — `clearAllHeartbeatTimersForTesting`
  5. `handlers/intents/intent-pending-timeout-registry.ts:27` — `getActivePendingIntentTimeoutCount`
  6. `handlers/intents/intent-pending-timeout-registry.ts:32` — `clearAllPendingIntentTimeoutsForTesting`
  7. `handlers/utils/dacp-response-utils.ts:62` — `withDestinationRouting`
  8. `handlers/utils/open-with-context.ts:19` — `getPendingOpenWithContextTimeoutCount`
  9. `handlers/utils/open-with-context.ts:24` — `clearAllPendingOpenWithContextTimeoutsForTesting`

  Symbols 2–9 are free functions **never re-exported from `index.ts`** — module-boundary already
  keeps them out of the built `.d.mts` regardless of `stripInternal`; the tag is belt-and-suspenders
  documentation on top of an already-enforced boundary, not doing independent work for these eight.
  Checked all four consumer packages for direct imports of each by name: `sail-platform` and
  `sail-finance` import none of them. `sail-conformance-harness` imports exactly one —
  `clearAllPendingOpenWithContextTimeoutsForTesting` — via **relative source paths**
  (`../../sail-desktop-agent/src/handlers/utils/open-with-context`) in
  `src/__tests__/harness-open-with-context.harness.ts:13` and
  `src/harness-open-with-context.test.ts:6`, both test files. This is not a contradiction: a source
  import never touches `dist/index.d.mts`, so `stripInternal` has zero effect on it either way — the
  consumer is already reaching past the package's public npm-style surface deliberately (same
  pattern the package's own in-package tests use, and the same pattern `test/support/*` helpers use
  for `sail-conformance-harness` generally). The `@internal` tag is accurately describing "not part
  of the built public API," which remains true regardless of this source-level test wiring. No tag
  removed, no consumer reworked.
- **Slice 2.5 — the task's flagged "SPECIFIC RISK" is a false alarm, verified by reading the code.**
  `harness-finos-teardown.ts:164-178`'s `installHarnessInboundAppMessageObserver(appConnection: {
  onAppMessage(handler): void }, observer)` takes a **structurally-typed parameter incidentally named
  `appConnection`** — unrelated to `SailDesktopAgentOptions.appConnection`. Its only call site,
  `harness-bootstrap.ts:194`, passes `desktopAgent.connector` (the `BrowserAppConnection` instance,
  which is genuinely public and never tagged `@internal`), not a constructor option. Confirmed via
  `grep -rn "appConnection:" packages/sail-conformance-harness/src packages/sail-platform/src
  packages/sail-finance/src` (excluding `.test.ts`): the harness-finos-teardown.ts parameter is the
  only hit anywhere. No agent is constructed with an injected edge through any consumer package's
  use of the public `@finos/sail-desktop-agent` import. Nothing to decide here — the risk does not
  exist as described.
- **Slice 2.5 — one line of source changed for the fix, formatted with `vp fmt`:** deleted
  `app-connection/types.ts:5`'s dead re-export. No other symbol was untagged, retagged, or reworked.
- **Slice 2.5 — root export count: 39 → 39, unchanged.** `stripInternal` only removes a struct
  member (`appConnection`) and two structurally-referenced-only interfaces that were never named in
  the root `export { ... }` statement to begin with (they were unexported locals inlined by the
  bundler) — so the *count* of root-exported names does not move, only the file's internal body
  shrinks (`dist/index.d.mts`: 47.50 kB → 45.77 kB after the fix).
- **Slice 2.5 GREEN (after rebuilding dist with the fix in place):** `validate -w
  @finos/sail-desktop-agent` — typecheck and lint clean; `format --check` fails only the same
  pre-existing 8 files from prior slices, none touched here. sail-desktop-agent vitest 329/329 (50
  files, flaky `wcp-host-logger-threading.test.ts` re-run in isolation and green). sail-platform
  vitest 27/27 (6 files). cucumber 154/154 scenarios / 1461/1461 steps. conformance-harness vitest
  69/69 (14 files). Root typecheck clean across all workspaces (`sail-desktop-agent`, `sail-platform`,
  `sail-finance`, `sail-one`, `sail-conformance-harness`, `sail-docs`) — one transient failure
  surfaced on a single run (`sail-finance` → `TS2307` resolving `@finos/sail-desktop-agent` through
  its relative import of `sail-conformance-harness/src/conformance-app-directory.ts`); reproduced a
  clean re-run immediately after, and independently re-tested with this slice's two edits fully
  `git stash`ed (then restored) to rule out causation — passed clean both stashed and restored,
  confirming a one-off fluke (most likely `vp pack`/`tsc` I/O race immediately after a dist rebuild),
  not a regression from this slice. Rebuilt `sail-desktop-agent`'s dist before every consumer run per
  the plan's build-ordering note.
- **Slice 2.5 — tsconfig.json diff:** added `"stripInternal": true` alongside the existing `outDir`.
  Nothing else in the package's tsconfig changed.
- **Slice 2.6 — reproduction test proved the trap red before any fix.** New
  `src/agent/__tests__/sail-desktop-agent-edge-routing.test.ts` constructs an
  `EmittingTestAppConnection` (extends the real `AppConnectionEventEmitter`, satisfies
  `AgentAppConnection`) — unlike `DacpTestAppConnection`, which has no event-emitter capability at
  all and so cannot distinguish "wired to the right object" from "wired to nothing." Against
  pre-fix code: `new SailDesktopAgent({ appConnection: edge })` → `agent.apps.onConnect(fn)` →
  `edge.simulateAppConnected(metadata)` → `fn` never called (`expected [] to deeply equal
  [{...}]`) — confirms `apps.onConnect` was wired to the separately-constructed `connector`, not
  the injected edge.
- **Slice 2.6 — design chosen: `SailDesktopAgent<TEdge extends AgentAppConnection =
  BrowserAppConnection>`, `get connector(): TEdge { return this.appConnection }`.** Considered
  three options per the plan's own text: (a) widen `AgentAppConnection` with optional
  capabilities and leave `connector` as a second, harmless-but-still-separate object; (b) the
  generic class, making `connector` a literal alias of `appConnection`; (c) narrow `connector`
  only when the edge happens to be a `BrowserAppConnection`. Chose (b) combined with (a)'s
  capability-widening (still needed regardless, for `on`/`off`/`disconnectAppByInstanceId`/
  `requestIntentResolution`/`resolveIntentSelection`, all now optional on `AgentAppConnection`,
  narrowed back to required on `BrowserAppConnectionSurface`). (b) alone doesn't remove the need
  for (a)'s widening — the controllers still take an edge that might not have those members. (b)
  over a plain (a)-only fix because (a) alone only makes the divergence *harmless* (nothing
  internal reads the stale `connector`); (b) *removes* the divergence structurally — `connector`
  cannot disagree with `appConnection` because they are the same reference by construction, which
  is what the plan's own proposed fix text asks for ("make `connector` a narrowed view of
  `this.appConnection` ... rather than a second object"). Verified empirically the hard constraint
  still holds: bare `SailDesktopAgent` (every production call site — `sail-platform`,
  `sail-finance`, `sail-one`, the landmine file) resolves `TEdge` to the default
  `BrowserAppConnection`, so `connector: BrowserAppConnection` for every consumer that doesn't
  explicitly inject an edge. `Pick<SailDesktopAgent, "connector">` in
  `wcp4-origin-allowlist.ts:11` (`type BrowserDesktopAgentWithConnector = SailDesktopAgent`)
  compiles unchanged.
- **Slice 2.6 — blast radius measured empirically, not assumed.** Making the class generic
  requires every internal helper that stores an agent typed by its *injected* edge (not the
  default) to say so explicitly — `SailDesktopAgent<DacpTestAppConnection>` in
  `test/support/desktop-agent-test-harness.ts`, `test/world/index.ts`, and
  `sail-conformance-harness/src/__tests__/harness-open-with-context.harness.ts` (the one consumer
  outside `sail-desktop-agent` that constructs an agent via
  `createDesktopAgentWithTestConnection`); `SailDesktopAgent<AgentAppConnection>` (the widest
  bound) in edge-agnostic test helpers (`test/support/agent-state.ts`) and in the three Slice-1-debt
  cast sites this collapses back to real controller calls
  (`desktop-agent-user-channels.test.ts`, `wcp-inbound-validation.test.ts`,
  `get-app-metadata-harness-path.test.ts`). Measured the full risk by grepping every
  `SailDesktopAgent` type reference across `sail-desktop-agent`, `sail-conformance-harness`,
  `sail-platform`, and `sail-finance` (33 files matched) and then running root `tsc` to see which
  actually broke: exactly one file outside `sail-desktop-agent`
  (`harness-open-with-context.harness.ts`, fixed by pointing its fixture type at
  `SailDesktopAgent<DacpTestAppConnection>`). Every other match was a bare `SailDesktopAgent`
  reference that only ever sees the default `BrowserAppConnection` type parameter in practice
  (`sail-platform`, `sail-finance`, `sail-one` production code; harness functions that only touch
  edge-independent members) and needed no change. Confirms this was a same-slice-sized fix, not the
  "materially larger, stop and say so" scope the task warned about.
- **Slice 2.6 — `requestIntentResolution` gate replaced with a capability check on the routing
  edge.** `if (config.appConnection === undefined)` → `if (typeof
  this.appConnection.requestIntentResolution === "function")`. `requestIntentResolution` /
  `resolveIntentSelection` / `disconnectAppByInstanceId` / `on` / `off` all moved to optional
  members on `AgentAppConnection` (`app-connection/types.ts`), matching the existing
  `setOnAgentDisconnect?` / `notifyChannelMembershipChanged?` / `bindAgentState?` shape, and
  narrowed back to required on `BrowserAppConnectionSurface`. `createAppsController`,
  `createChannelsController`, `wireIntentResolver`, `wireLifecycleCallbacks`, and
  `changeAppChannel`'s `ChannelOperationsBacking.connector` all retyped from `BrowserAppConnection`
  to `AgentAppConnection`, with `?.` at each call; `apps.disconnect` falls back to the
  always-present `pruneAppConnection` when `disconnectAppByInstanceId` (host-initiated
  WCP6Goodbye) isn't available. Every one of these is now constructed with `this.appConnection`
  (which, per the generic design, always *is* `connector`), not a second object. **Proof the 4
  Cucumber multi-handler `raiseIntent` scenarios still pass:** full `npm run test:cucumber` —
  154/154 scenarios, 1461/1461 steps, unchanged from every prior slice's baseline (see full run
  transcript in the slice's chat verification — same intent-resolution scenarios exercised, same
  pass count).
- **Slice 2.6 — the `@internal` tag on `SailDesktopAgentOptions.appConnection` predates this
  slice** (confirmed against the Slice 2.5 notes above, which already show `appConnection?:
  AgentAppConnection` tagged `@internal` before 2.6 started) — not introduced or altered here.
  `stripInternal` still removes it from `dist/index.d.mts` for the generic `TEdge` version too;
  internal test/harness code is unaffected since it imports `SailDesktopAgent` from source paths,
  never through the built package.
- **Slice 2.6 GREEN:** sail-desktop-agent vitest 331/331 across 51 files (329 baseline + 2 new in
  the reproduction test file; known flake `wcp-host-logger-threading.test.ts` re-confirmed passing
  both in isolation and in the full run) · `validate -w @finos/sail-desktop-agent` — typecheck and
  lint clean, `format --check` fails only the same pre-existing 8 files from prior slices (this
  slice's own touched files, including `sail-desktop-agent.ts`, pass format individually) ·
  sail-platform vitest 27/27 across 6 files (including the WCP4 origin-allowlist interception
  test, landmine 1, re-run individually and green) · sail-platform `tsc --noEmit` clean · cucumber
  154/154 scenarios / 1461/1461 steps · conformance-harness vitest 69/69 across 14 files ·
  conformance-harness `tsc --noEmit` clean · root `npm run typecheck` clean across all workspaces
  (`sail-desktop-agent`, `sail-platform`, `sail-finance`, `sail-one`, `sail-conformance-harness`,
  `sail-docs`). Rebuilt `sail-desktop-agent`'s dist before every consumer run per the plan's
  build-ordering note.
- **Slice 2.6 — session note.** Mid-slice, `sail-desktop-agent.ts` and several dependent files were
  repeatedly rewritten outside this agent's own tool calls (surfaced as "file modified, either by
  the user or by a linter" system notices) toward exactly the generic-`TEdge` design landed above,
  including once toward a design this agent independently reverted first (having empirically
  proven, via a from-scratch `tsc` run, that the then-current partial state broke 7+ files) before
  re-converging on the same generic design after re-measuring the actual blast radius as described
  above. Recorded here for anyone reading this history later; the landed code and every verification
  number above were independently re-run and confirmed by this agent after the file activity
  settled, not taken on trust.

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:
