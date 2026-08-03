---
sidebar_position: 1
---

# @finos/sail-finance

`sail-finance` is one of Sail's two **example UIs** for `@finos/sail-platform` — the **finance-specific**
one. It is a React application that hosts an FDC3 Desktop Agent in a browser tab, presents apps as
panels in a workspace-and-tab canvas (dockview), and manages its own workspace/layout state.

**Location:** `packages/sail-finance/`

Its sibling, [`sail-one`](../sail-one/overview), is the **domain-neutral** example UI for more general
use. Neither is "the reference host" — both are starting points to deploy or adapt, split by domain,
not by maturity. Layout (dockview panels vs tab-and-grid canvas) is a secondary detail between them, not
the main distinction. Sibling shells never import each other — `no-restricted-imports` in
`.oxlintrc.json` enforces this — so anything genuinely shared belongs in `@finos/sail-theme` or the
platform.

## What it does

- Constructs its Desktop Agent via `createSailBrowserDesktopAgent` — the **low entry point** into
  `@finos/sail-platform` — not `SailPlatform` (`packages/sail-finance/src/main.tsx`).
- Renders workspace UI: tabs and dockview panels hosting FDC3 apps in iframes, plus a pop-out relay
  shell for panels torn off into their own window (`src/utils/dockview-popout.ts`,
  `bootstrapDockviewPopoutShell` in `main.tsx`).
- Provides host-owned intent resolver and channel selector chrome — not the FDC3 WCP3 injected-iframe
  UI.
- Manages its own workspaces, layouts, and app directory integration via Zustand stores, not via
  `SailPlatform`'s storage APIs.

## Construction and state — the low entry point

`main.tsx` constructs a `SailAppLauncher` (from `@finos/sail-platform`) with `onLaunchApp` /
`onCloseApp` callbacks that add and remove panels in the workspace store, then calls
`createSailBrowserDesktopAgent({ debug, appLauncher, ... })`, passing the app launcher and its app
sources. This returns a `SailDesktopAgent` directly — `SailPlatform` is never constructed. The agent is
passed into React as `<App agent={agent} />`, and `SailDesktopAgentProvider`
(`src/contexts/SailDesktopAgentContext.tsx`) wraps it in a context that exposes the agent plus three
Zustand stores built from its controllers: an app-directory store, a connection store, and an intent
resolver store.

**Workspace and layout persistence is Zustand `persist` over raw `localStorage`, not
`@finos/sail-platform` storage.** `src/stores/workspace-store.ts` wraps its store in `persist` from
`zustand/middleware` (`:204,405-407`) with a custom `mapStorage` implementation (to serialize the
`Map`-based tab/panel structures) whose `getItem`/`setItem` call `localStorage.getItem` /
`localStorage.setItem` directly (`:114,192`). `platform.workspaces`, `platform.layouts`, and
`SailPlatformClient` are not called anywhere in this package. This is the concrete contrast with
`sail-one`, which persists its own shell state through `SailPlatformClient` — see
[@finos/sail-one — persistence](../sail-one/overview#persistence-sailplatformclient).

## Channel chrome

`src/components/ChannelSelector.tsx` reads the current channel from a Zustand `connection-store` (built
from the agent's `channels` events in `SailDesktopAgentContext.tsx`) and calls
`agent.channels.changeAppChannel(instanceId, channelId)` directly on the `SailDesktopAgent` handle
(`ChannelSelector.tsx:57`) to change it — not through a `SailPlatform` wrapper, since `sail-finance`
never constructs one. See
[Channel selection](../../architecture/channel-selection) for the host-chrome-vs-app-hosted-UI model
this follows.

## Intent resolution

`src/stores/intent-resolver-store.ts` subscribes to `agent.intentResolver.onRequest` and calls
`agent.intentResolver.select` / `.cancel` directly on the agent handle, filtering out handlers whose
instance has disconnected before the user picks one.

## Development

```bash
npm run dev            # from monorepo root — starts the agent, sail-platform, and sail-finance together
npm run dev -w @finos/sail-finance   # this package only
```

Dev server: **http://localhost:3000** (`vite.config.ts:36`).

Conformance apps used in local development come from
`packages/sail-conformance-harness/src/conformance-app-directory`, imported by relative path
(`main.tsx`) alongside the standard FINOS app directory — the one `lint:boundaries` exception in the
repo, since it couples the product app to a test fixture.

## Related

- [@finos/sail-platform](../platform/overview) — the package this shell composes, including the
  `createSailBrowserDesktopAgent` entry point in full.
- [@finos/sail-one](../sail-one/overview) — the domain-neutral sibling shell, built the other way (on
  `SailPlatform`).
- [Architecture Overview](../../architecture/overview) — package ownership and the two entry points.
- [Channel selection](../../architecture/channel-selection) — host chrome vs app-hosted selector flows.
- [Getting Started](../../getting-started) — embed a Desktop Agent in your own web app.
- [Run Sail](../../run-sail) — run or host the full platform.
