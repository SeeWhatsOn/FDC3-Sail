# sail-desktop-agent — collapse `DesktopAgent` / `SailDesktopAgent` into one class

**Status:** planning — nothing written.
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

### 1. `sail-platform` monkey-patches a private method. Breaking it is silent. **[verified]**

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
- [ ] 2.2 — Merge the two classes
- [ ] 2.3 — Explicit `.start()`; delete `autoStart`
- [ ] 2.4 — Index cleanup; declaration-emit pass
- [ ] 2.5 — Enable `stripInternal`; confirm `@internal` symbols leave the `.d.ts`

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

## Review Notes

- Required:
- Follow-up:
- Ignore for MVP:
