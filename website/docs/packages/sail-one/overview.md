---
sidebar_position: 1
---

# @finos/sail-one

`sail-one` is one of Sail's two **example UIs** for `@finos/sail-platform` — the **domain-neutral** one,
for more general use. It is a tab-and-grid canvas shell, ported from `packages/sail-web` on FINOS
`wip/v2.2` and rewired onto `@finos/sail-platform` and the current `@finos/sail-desktop-agent`.

**Location:** `packages/sail-one/`

Its sibling, [`sail-finance`](../sail-finance/overview), is the **finance-specific** example UI. Neither
is "the reference host" — both are starting points to deploy or adapt, split by domain, not by
maturity. `sail-one` and `sail-finance` never import each other — `no-restricted-imports` in
`.oxlintrc.json` enforces this; anything genuinely shared belongs in `@finos/sail-theme` or the
platform.

## Development

```bash
npm run dev -w @finos/sail-one     # http://localhost:8090
npm run dev:one                    # agent + platform watch builds alongside the shell
```

Dev server port from `vite.config.ts:51,62`.

## Construction — the high entry point

Unlike `sail-finance`, `sail-one` constructs `new SailPlatform({...})` and calls `.start()` — the
**high entry point** into `@finos/sail-platform`, with the platform owning host chrome, lifecycle
callbacks, and storage. `src/state/` holds the three seams the UI talks to:

| Module | Role |
|---|---|
| `sail-host.ts` | Owns the `SailPlatform` instance (`new SailPlatform({...})` at `:129`, `platform.start()` at `:155`) — the only file that talks to the agent. |
| `client-state.ts` | Shell state (tabs, panels, directories, custom apps), persisted via `SailPlatformClient`. |
| `default-app-state.ts` | Window/iframe bookkeeping and the user's hosting choice for a launch. |

For the shared engine both entry points sit on top of, and when to reach for `SailPlatform` versus
`createSailBrowserDesktopAgent` (what `sail-finance` uses), see
[Architecture Overview — Two entry points](../../architecture/overview#two-entry-points).

## Persistence: `SailPlatformClient`

State is stored through `SailPlatformClient`'s config API (`get`/`updateConfig`) — a `localStorage`
backend behind the `sail_one_` key prefix (`client-state.ts:90-93`) — rather than raw `localStorage`,
so the backend is swappable without touching the shell. This is the concrete contrast with
`sail-finance`, which persists its own way through Zustand `persist` over raw `localStorage` — see
[@finos/sail-finance](../sail-finance/overview).

Because the platform storage API is async, `ClientState.load()` **must be awaited before the first
render** — otherwise the Desktop Agent would be constructed with default channels and then immediately
restarted once the persisted set arrives. `src/index.tsx:16` awaits `getClientState().load()` before
calling `createRoot(...).render(...)` (`:18-20`), and only then registers the Desktop Agent
(`:23`). This is the shell's worked example of the lifecycle contract described in
[Architecture Overview — Lifecycle and its one real constraint](../../architecture/overview#lifecycle-and-its-one-real-constraint):
platform storage is async, but `apps`/`userChannels` are constructor data and `start()` is synchronous,
so persisted state must be read before `SailPlatform` is constructed, not after.

Note that `sail-one` uses `SailPlatformClient`'s **config** namespace (`getConfig`/`updateConfig`) to
persist its own shell-state shape (tabs, panels, directories, custom apps) — it does not drive
`platform.workspaces` or `platform.layouts`, which remain implemented but undriven by either shell (see
[@finos/sail-platform — Platform storage](../platform/overview#platform-storage)).

## Conversion notes

**App launches are agent-owned.** The old host minted instance ids and told the agent via
`registerPendingLaunch`. Now `platform.apps.open()` drives `SailAppLauncher`, which mints the id and
calls back into the shell to create the panel or window. `SailHost` queues the user's hosting choice
(`Frame` vs `Tab`) so the callback knows where to put it; a launch arriving from another app's
`fdc3.open()` has no queued choice and defaults to `Frame`.

**Intent resolution is agent-driven.** The old host's "one app, one intent" short-circuit
(`narrowIntents`) is gone. The agent calls the host's `intentResolver` only when a choice is genuinely
needed.

**`setUserChannel` no-ops for unknown instances.** `changeAppChannel` resolves on the agent's
`channelChanged` push, so calling it for a stale panel id would hang until the channel-change timeout —
`sail-host.ts` guards this by checking `platform.apps.getInstance(instanceId)` first.

## Known gaps `[planned]`

These are deliberate interim behaviours, not oversights. Each disappears when the corresponding agent
API lands.

**Structural channel and directory edits restart the agent `[planned]`.** `userChannels` seeds agent
state once at construction and there is no `ensureUserChannel`; likewise `apps.addDirectory` is additive
with no replace. So adding, removing, or renaming a tab — or deactivating a directory — tears down and
rebuilds the `SailPlatform` instance (`sail-host.ts:311-322`'s `restart` method), and connected apps must
re-handshake. Cosmetic tab edits (colour, icon) deliberately do *not* restart, which means the
`displayMetadata` apps see via `getUserChannels()` is stale until the next structural change or reload.

FDC3 2.2 permits the underlying feature: user channels are "created and named by the desktop agent," the
eight standard channels are `SHOULD` not `MUST`, and implementations `MAY` support configuration of the
user channel set (FDC3 2.2 spec, "User Channels"). Runtime mutation is simply unspecified, so the API
shape is Sail's to choose.

**Directory removal is all-or-nothing `[planned]`.** The agent tracks no provenance from app to source
directory, so there is no way to drop just the apps a removed directory contributed. The App Directory
spec defines only `GET /v2/apps` and `GET /v2/apps/{appId}`, with no delete, hidden, or deprecation
semantics — delete-vs-hide is a Sail product decision, not a spec requirement.

**`embeddable-ui/` is carried but not wired `[planned]`.** `src/embeddable-ui/channel-selector.tsx` and
`intent-resolver.tsx` implement the FDC3 injected-UI protocol (`Fdc3UserInterfaceHello` →
`Fdc3UserInterfaceHandshake`, then `Restyle` / `Channels` / `ChannelSelected` / `Resolve` /
`ResolveAction`, via `connectUserInterfacePort` in `iframe-port.ts`). `SailPlatform.start()` hardcodes
`getIntentResolverUrl: () => false` and `getChannelSelectorUrl: () => false`
(`sail-platform.ts:239-241`), and neither file is wired into `sail-one`'s Vite build, so nothing loads
them today.

They exist for the case FDC3's browser-resident spec calls out directly: a Desktop Agent may not be able
to present a channel selector in a window opened with `window.open()`. Apps hosted in the shell's own
chrome do not need them; apps popped out into their own window do. Wiring them back requires making
those URLs a host policy rather than a constant.

**`AppInstanceState.NotResponding` is unreachable `[planned]`.** The agent exposes
`"pending" | "connected"` plus a disconnect event; heartbeat health is not surfaced to hosts.
`public/icons/app-state/not-responding.svg` is retained for when it is.

## Related

- [@finos/sail-platform](../platform/overview) — the package this shell composes, including the
  `SailPlatform` entry point in full.
- [@finos/sail-finance](../sail-finance/overview) — the finance-specific sibling shell, built the other
  way (on `createSailBrowserDesktopAgent`).
- [Architecture Overview](../../architecture/overview) — package ownership and the two entry points.
