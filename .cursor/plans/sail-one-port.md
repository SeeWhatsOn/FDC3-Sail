# sail-one: port brief

> **Partly superseded by the 2026-08-04 `sail-platform` cull.** The port landed, but the wiring
> described here changed: `sail-host.ts` now constructs `SailDesktopAgent` directly and implements
> its own `AppLauncher` inline (no `SailPlatform`, no `SailAppLauncher`), and `client-state.ts`
> persists through `createLocalStorage` (no `SailPlatformClient`). The shell's *behaviour* is
> unchanged. Read API names below as history — current shape is in `packages/sail-one/README.md`.

Self-contained handoff for building the second Sail shell, `sail-one`, by porting the UI from
branch `wip/v2.2`. Written to be actionable without prior conversation context.

**Status:** analysis complete, no code written. Everything below was read from the actual
source; claims that were *not* verified are called out explicitly in §10. Do not treat
unflagged statements as guesses, and do not treat §10 items as settled.

---

## 1. Repo state you are starting from

- **Working branch:** `wip/v3-local` in `C:\Users\cwats\Dev\EW\FDC3-Sail`
- **Source to port from:** git ref **`wip/v2.2`**, path **`packages/sail-web/`**
  (read with `git show wip/v2.2:packages/sail-web/<path>`)

Current packages:

| Package | Role |
|---|---|
| `sail-desktop-agent` | Headless FDC3 engine. Depends only on `@finos/fdc3`, `fdc3-schema`, `immer`. |
| `sail-platform` | Composition layer over the engine. **See §3 — its flagship class is unused.** |
| `sail-theme` | Framework-agnostic brand tokens. `tokens.css` (pure CSS custom properties) + `tailwind.css` (Tailwind v4 glue). No build step. |
| `sail-finance` | The existing shell (dockview-based). **Owns its own shadcn/Radix components** in `src/components/ui/`. |
| `sail-conformance-harness` | FDC3 toolbox clean room. |

**Architecture rule:** dependencies flow one way — engine → platform → shell. Each shell owns
its own shadcn components; the *only* shared design layer is `sail-theme` tokens. Shells must
never import each other.

This is **enforced**, not conventional: `.oxlintrc.json` + `npm run lint:boundaries`
(also in `npm run validate` and CI). It already contains a `packages/sail-one/**` block that
activates the moment the package exists — it forbids `sail-one` importing `sail-finance`.
Verify enforcement works by planting a violating import and confirming exit 1.

---

## 2. The goal

`sail-one` is a **deliberately different product** from `sail-finance`, not a reskin:

- **`sail-finance`** — dense finance workspace, resizable panels, *explicit* dropdown channel selector.
- **`sail-one`** — agnostic, beginner-friendly **single open space**: any app dropped onto it is
  **automatically connected** to everything else (an *implicit single channel*).

It must be **rebuilt on shadcn/Radix**, consuming `sail-theme` tokens, owning its own components.

The implicit-single-channel model is the most important design fact in this document: it
*removes* whole areas of the source UI (see §6, §9).

---

## 3. CRITICAL: `SailPlatform` is not used by anything

This is the finding that most affects your wiring design, and it contradicts the package's own
documentation.

`packages/sail-platform/src/sail-platform.ts` defines a full `SailPlatform` class:
constructed with a `SailPlatformConfig` (`appLauncher`, optional `intentResolver`,
optional `channelSelector`, lifecycle callbacks), then `.start()` / `.stop()`, exposing
`platform.agent`, `.channels`, `.intentResolver`, `.apps`, plus `changeAppChannel()` etc.
Its README calls it the "Platform SDK" entry point.

**But nothing outside the package instantiates it.** Verified:

```bash
grep -rn 'new SailPlatform' --include='*.ts' --include='*.tsx' packages/ | grep -v node_modules
```

All hits are inside `packages/sail-platform/` itself — a docstring example, its own
constructor internals, and two test files. There are **zero consumers elsewhere**.

The one real shell bootstraps with the *lower-level* API instead
(`packages/sail-finance/src/main.tsx`):

```ts
import { SailAppLauncher, createSailBrowserDesktopAgent, type DirectoryApp } from "@finos/sail-platform"

const appLauncher = new SailAppLauncher({ onLaunchApp: ..., onCloseApp: ... })
const agent = createSailBrowserDesktopAgent({ debug: true, appLauncher, apps: [...] })
```

…then wraps `agent` in a React context (`SailDesktopAgentProvider`) and drives UI from
zustand-style stores: `createIntentResolverStore(agent)`, `createConnectionStore(agent)`,
`createAppDirectoryStore(agent)`.

### The fork you must decide first

**Does `sail-one` become the first real consumer of `SailPlatform`, or follow `sail-finance`'s
`createSailBrowserDesktopAgent` pattern?**

- **Adopt `SailPlatform`** — it is the designed composition point and its `IntentResolver` /
  `ChannelControl` interfaces are exactly what a shell needs. Risk: proving out an
  abstraction that has never carried a real shell, while simultaneously porting a UI.
- **Follow `sail-finance`** — consistent with the working shell, lower risk. Leaves
  `SailPlatform` dead and both shells wired below the designed layer.

Recommendation: **adopt `SailPlatform`.** If it cannot serve a second shell it should be
deleted rather than left as decoration. But read `sail-app-launcher.ts`,
`sail-platform-client.ts` and `local-storage-backend.ts` first (see §10) to confirm it can
actually carry a shell — that check is a prerequisite, not optional.

---

## 4. Source inventory — `wip/v2.2:packages/sail-web/src`

42 source files, ~4,730 LOC including CSS modules.

| Dir | LOC (approx) | Kind | What it does |
|---|---|---|---|
| `index.tsx` | 21 | glue | Mounts `<Frame>`, calls `bindClientStateToHost()`, `registerDesktopAgent(...)` |
| `frame/` | 72 + 53 css | screen | Composition root: topbar, channel rail, grid, conditional popups |
| `top/` | 50 + 91 css | component | Logo, OpenAppButton, Settings — pure presentation |
| `tabs/` | 46 + 68 css | component | Left-rail channel list, pure presentation |
| `grid/` | 344 + 16 + 29 + 215 css | screen | **gridstack** workspace: app iframes per channel, drag between cells and channels, connection badges |
| `appd/` | 290 + 336 css | screen (popup) | App Launcher directory browser, detail pane, native-app instructions, JSON viewer |
| `config/` | ~930 + 872 css | screen (popup) | Settings: Directories / Tabs (channel editor) / Custom Apps. Largest area |
| `resolver/` | 373 + 19 + 125 css | screen (popup) | Intent resolution UI — best-designed piece in the codebase |
| `popups/` | 148 + 222 css | component | Generic modal/drawer shell used by the three popups |
| `icon/` | 25 + 15 + 44 css | component | Icon display + `getIcon()` helper |
| `embeddable-ui/` | 184 + 96 + 33 | **obsolete** | Standalone apps injected as FDC3 UI iframes — see §6 |
| `state/` | ~900 + 216 tests | state/glue | Whole state layer + agent wiring |
| `styles/` | 33 + 54 | glue | Global reset + its own `--sail-*` tokens (**incompatible**, see §8) |

---

## 5. Wiring surface — old vs new

The two models are fundamentally different. This is why `state/SailHost.ts` cannot be ported.

### Old (`wip/v2.2`)

A singleton `SailHost` (`state/SailHost.ts`, 305 LOC) calls a **factory**:

```ts
this.agent = await createDesktopAgent({
  directories, channels, provider: "fdc3-sail",
  openApp: async (app, channel) => { ... getAppState().open(app, hosting) ... },
  resolveHostIdentifier: (source) => this.resolveHostIdentifier(source),
  narrowIntents: (raiser, appIntents, context) => this.narrowIntents(...),
  onInstanceConnected, onAppStateChanged,
})
this.agent.start()
```

Methods used on the returned agent: `getApps()`, `registerPendingLaunch()`,
`reloadDirectories()`, `ensureUserChannel()`, `setUserChannel()`, `getAppRegistrations()`.

- **Intent resolution:** resolve/reject a promise from inside `narrowIntents`, driven by the UI
  calling `intentChosen(...)` on `SailHost`.
- **Channel selection:** not a separate call — implicit in `openApp`'s `channel` arg and per-panel `setUserChannel`.
- **Window identity:** resolved by walking the DOM — `document.getElementById("iframe_" + panel.panelId)`
  and matching `contentWindow === source`.

**None of these APIs exist today.** Read `SailHost.ts` as a *specification of what the UI needs
from an agent*, then implement fresh.

### New (`wip/v3-local`)

Host-implemented interfaces in `packages/sail-desktop-agent/src/host-contracts/`, which the
agent **calls back into**:

- `AppLauncher.launch(request, appMetadata): Promise<AppIdentifier>`, optional `.close(instanceId)`
- `IntentResolver.resolve(request: IntentResolutionRequest): Promise<IntentResolutionResponse | null>`
  where `IntentResolutionRequest = { requestId, intent, context, handlers, choices? }`
- `ChannelControl.selectChannel(request: ChannelSelectionRequest): Promise<string | null>`
  where `ChannelSelectionRequest = { instanceId, appId, currentChannel, availableChannels }`

**Identity note:** the new WCP4/WCP5 flow expects the launcher to set the iframe `name` to the
returned `instanceId` (see the `AppLauncher.launch` doc comment). The old post-hoc
`resolveHostIdentifier` DOM-walk is very likely obsolete — confirm before porting it.

### What `sail-one` must implement

1. An **`AppLauncher`** replacing `DefaultAppState.open()` / `registerAppLaunch()`.
   Grid placement logic (`findEmptyArea`, gridstack `makeWidget`) is reusable; the launch call is not.
2. An **`IntentResolver`** replacing `narrowIntents()` + the `intentChosen()` promise dance.
   `resolver/resolver.tsx`'s *UI* is reusable; its `AugmentedAppIntent` / `IntentResolution`
   types must be remapped to `IntentResolutionRequest` / `IntentResolutionChoice` / `IntentResolutionResponse`.
3. A **`ChannelControl`** — **possibly not needed at all**, given the implicit-single-channel model.

---

## 6. Per-area verdicts

| Area | Verdict | Effort | Notes |
|---|---|---|---|
| `popups/popup.tsx` | REBUILD | 0.5–1d | → Radix `Dialog`/`Sheet`; gains focus trap + aria free |
| `top/top.tsx` | PORT (restyle) | <0.5d | Trivial |
| `tabs/tabs.tsx` | REBUILD (small) | 0.5–1d | **May be unnecessary** — implicit single channel |
| `grid/*` | PORT logic / REBUILD chrome | 2–4d | gridstack integration is real working logic worth keeping. Cross-tab drag likely droppable |
| `appd/appd.tsx` | REBUILD | 2–3d | Good UX reference; old API + old CSS modules |
| `config/` (directories, tabs) | PORT logic / REBUILD chrome | 2–3d | CRUD maps to shadcn `Input`/`Switch` |
| `config/customApps.tsx` | REBUILD | 3–5d, or **0 if dropped** | 428 LOC, only react-widgets consumer — see §9 |
| `resolver/*` | REBUILD (logic-light) | 2–3d | Best-designed piece; remap props to new types |
| `icon/*` | PORT AS-IS | <0.5d | Pure |
| `state/ClientState.ts` | REBUILD as reference | — | Good design reference; rebuild against `SailPlatform` workspace/layout APIs |
| `state/SailHost.ts`, `DefaultAppState.ts` | **DROP** | new impl 2–4d | Spec only (§5) |
| `embeddable-ui/*` + `html/ui/*.html` | **DROP** | 0 | See below |
| `styles/*` | **DROP** | — | Token names don't overlap (§8) |
| `state/__tests__/*` | **DROP** | 0 | Test a deleted API |

**Total ≈ 15–27 days**, materially less if the §9 decisions drop areas.

**Why `embeddable-ui/` is dead:** it implements the FDC3 2.2 *injected-iframe UI protocol*
(`Fdc3UserInterfaceHello` / `Restyle` / `ChannelSelected` / `ResolveAction`). Current
`sail-platform.ts` **explicitly disables that mechanism**:
`appConnectionOptions: { getIntentResolverUrl: () => false, getChannelSelectorUrl: () => false }`.
The new architecture wants in-process host callbacks instead. Nothing here is portable.

---

## 7. react-widgets is a red herring

`react-widgets` appears in **exactly one file** — `config/customApps.tsx`:

```ts
import Combobox from "react-widgets/Combobox"
import Multiselect from "react-widgets/Multiselect"
```

The other 41 files are hand-rolled `<div>`/`<button>`/`<input>` markup with CSS Modules.

So the job is **not** "swap react-widgets for shadcn". It is:
1. re-author hand-rolled markup as shadcn primitives, and
2. rewire agent-calling code.

Mapping for the one file: `Combobox` → shadcn combobox pattern (`Popover` + `Command`/`cmdk`) —
a composition, not a drop-in. `Multiselect` with `allowCreate="onFilter"` → **no clean
equivalent**; needs `Command` + chip list built manually. This is the single hardest widget
migration, and it is confined to the one component §9 proposes dropping.

Targets for hand-rolled pieces: custom modal → `Dialog`/`Sheet`; checkbox track/thumb →
`Switch`; `<select>` → `Select`; buttons → `Button` variants; platform tab strip → `Tabs`.

---

## 8. Design tokens do NOT overlap

Both use a `--sail-*` naming *convention*, but **no variable name is shared**:

- `wip/v2.2` — `--sail-cyan`, `--sail-ink`, `--sail-canvas`, `--sail-top-height`, `--sail-rail-width` (hex)
- `sail-theme` — `--sail-primary`, `--sail-secondary`, `--sail-ocean`, `--sail-wave`, `--sail-ocean-deep`, `--sail-navy` (oklch)

**No CSS copies over.** Every `styles.module.css` must be re-authored against `sail-theme`
tokens or Tailwind utilities. This cost is already folded into §6 estimates.

`sail-theme` also ships a dark block targeting **both** `.dark` (shadcn) and
`[data-theme="dark"]` (Docusaurus), so dark mode follows the tokens automatically.

---

## 9. Product decisions needed before coding

1. **Does `sail-one` need a channel rail, cross-tab drag, or resolver channel-picking at all?**
   All three exist to serve *explicit* channels. With one implicit channel they may simply
   vanish. **This is the single biggest effort reduction available** — it touches `tabs/`,
   `grid/` (drop-target wiring, per-tab GridStack map) and `resolver/`.
2. **Keep `config/customApps.tsx`?** 428 LOC, the only react-widgets pain, a power-user
   in-browser app-directory editor. Does a *beginner-friendly* shell want it? Dropping it
   removes the hardest migration problem outright.
3. **Native-app WebSocket connection instructions** in the App Launcher — is native-app
   connection even a supported scenario now? If not, drop rather than port.

---

## 10. Unknowns — verify before relying on these

These were **not** read during analysis. Read them first:

- `packages/sail-platform/src/services/app-launcher/sail-app-launcher.ts`
- `packages/sail-platform/src/client/sail-platform-client.ts`
- `packages/sail-platform/src/client/local-storage-backend.ts`

They are the concrete implementation targets for `AppLauncher` and workspace persistence, and
they determine whether `SailPlatform` can carry a shell (§3).

Also unverified:
- **Connection-state enum.** `grid.tsx`'s `AppStateIcon` reads an old `State` enum
  (`NotResponding`/`Connected`/`Pending`/`Terminated`). Whether a per-instance connection-state
  read exists in the current engine, and under what shape, is unknown.
- **Workspace/layout persistence shape.** `sail-platform` exposes `workspaces`/`layouts`/`config`
  namespaces backed by `SailPlatformClient` — plausibly the replacement for v2.2's bespoke
  localStorage `ClientState`, but the shapes were not compared. Biggest unknown for estimating
  the Settings and Grid areas.

---

## 11. Suggested order of work

1. Read the three unverified files in §10; **resolve the `SailPlatform` fork (§3)**.
2. Get the §9 product decisions answered — they can delete whole areas.
3. Scaffold `packages/sail-one` (shadcn init against `sail-theme`, add to workspaces,
   tsconfig refs, root `build` script, CI). Confirm `npm run lint:boundaries` still exits 0
   and that a planted `@finos/sail-finance` import in `sail-one` makes it exit 1.
4. Bootstrap + `AppLauncher` first — proves the wiring end to end with one app launching.
5. Then grid, then resolver, then app directory, then settings.

## 12. Working constraints

- **Do not chase pre-existing failures.** The branch has **5 typecheck errors** and
  **11 lint errors** that predate this work (playwright node-types, `resolveHostIdentifier`,
  `appConnectionOptions`, `localOrigin`, `no-unsafe-*` in `dockview-popout.ts`). Baseline
  before you start, and only fix what you introduce.
- **The pre-commit hook auto-fixes and can change semantics.** `vp staged` has already
  rewritten runtime logic unreviewed (turning a truthiness check into `instanceof HTMLElement`)
  and orphaned a type alias, creating a type error. Diff your files after every commit.
- Validate with `npm run build`, `npm run docs:build`, `npm run typecheck`,
  `npm run lint:boundaries` — or `npm run validate` for the full CI gate.
