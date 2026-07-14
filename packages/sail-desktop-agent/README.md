# `@finos/sail-desktop-agent`

Browser-resident [FDC3](https://fdc3.finos.org) Desktop Agent used by [FDC3 Sail](https://github.com/finos/FDC3-Sail).

If you already know FDC3, think of this package as the **agent runtime**: App Directory loading, Web Connection Protocol (WCP) handshake with apps, and Desktop Agent Communication Protocol (DACP) message handling (open, intents, channels, broadcast). It does **not** render UI. A host (Sail’s `sail-web`, or your own shell) owns iframes/tabs, intent-resolver chrome, and channel pickers.

This package targets **FDC3 for the Web** (browser browsing contexts + `MessagePort`), not a native/Electron bridge.

## What the host must provide

`createDesktopAgent` wires directory + connection + DACP. The host still has to:

1. **Open apps** — create an iframe or tab and return a stable `instanceId` (also used as the browsing-context `name` so WCP can adopt the instance).
2. **Optionally resolve intents** — when more than one app can handle a raised intent, supply UI via `narrowIntents`.
3. **Optionally map windows** — if cross-origin `window.name` is unreadable, implement `resolveHostIdentifier`.

```ts
import { createDesktopAgent } from "@finos/sail-desktop-agent"

const agent = await createDesktopAgent({
  directories: [
    { type: "rest", url: "https://directory.fdc3.finos.org/v2/apps" },
    // or { type: "local", data: myApps }
  ],
  openApp: async (app, channel) => {
    // Open iframe/tab for `app`; set window/iframe name to the instance id.
    return { instanceId: "…" }
  },
  // narrowIntents: async (raiser, appIntents, context) => appIntents,
})

agent.start()
```

Call `agent.stop()` when tearing down. Host chrome also uses:

| Method                    | Purpose                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| `reloadDirectories()`     | Directory config changed                                            |
| `registerPendingLaunch()` | Pre-register instance id before WCP (iframe/`window.name` adoption) |
| `ensureUserChannel()`     | Add a user channel when the host adds a tab                         |
| `setUserChannel()`        | Bind an instance to a user channel                                  |
| `getAppRegistrations()`   | Refresh connection-state chrome                                     |

`server` / `connection` are not on the returned handle.

### Useful callbacks and config

| Option                                         | Purpose                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `directories`                                  | REST and/or local App Directory sources (first-wins merge by `appId`)  |
| `channels`                                     | User channels; defaults to `fdc3.channel.1`–`8`                        |
| `openApp`                                      | Required to launch apps (`fdc3.open` / raiseIntent that starts an app) |
| `narrowIntents`                                | Intent resolver hook; default keeps all candidates                     |
| `onInstanceConnected` / `onAppStateChanged`    | Host chrome refresh hooks                                              |
| `resolveHostIdentifier`                        | Fallback instance id when `window.name` is unavailable                 |
| `provider` / `providerVersion` / `fdc3Version` | Identity advertised over WCP                                           |

## Public API

Import only from the package root (`src/index.ts`). That surface is intentional and small:

- `createDesktopAgent` / `DesktopAgent`
- Host config and callback types (`DesktopAgentHostConfig`, directory sources, `openApp` / `narrowIntents`)
- Types hosts need in UI callbacks (`DirectoryApp`, `ChannelState`, `AppRegistration`, …)

Handlers, WCP helpers, and DACP runtime internals are **not** exported. Prefer importing from the package root over reaching into `src/` paths.

In this monorepo, Sail’s host UI lives in `packages/sail-web` and embeds the agent via `createDesktopAgent` (see `SailHost`).

## How messages flow

```
App (iframe/tab)
  │  WCP1–5 handshake (postMessage + MessagePort)
  ▼
BrowserAppConnection          ← src/app-connection/
  │  DACP over MessagePort
  ▼
BrowserDacpRuntime            ← src/agent/ + handlers/
  │  openApp / narrowIntents
  ▼
Host UI                       ← not in this package
```

1. **WCP** — app discovers the agent and establishes a `MessagePort` (`BrowserAppConnection`).
2. **DACP** — FDC3 agent API traffic (broadcast, intents, open, channels, …) is handled by the in-memory `DacpRuntime` and `src/handlers/`.
3. **Host callbacks** — launching windows and optional intent UI stay outside this package so any shell can embed the agent.

## Package layout

| Folder                | Role                                                       |
| --------------------- | ---------------------------------------------------------- |
| `src/agent/`          | `createDesktopAgent`, browser DACP runtime, directory load |
| `src/app-connection/` | WCP + `MessagePort` registry (`BrowserAppConnection`)      |
| `src/app-directory/`  | App Directory types and REST/local loaders                 |
| `src/handlers/`       | DACP handlers (broadcast, intents, open, heartbeat)        |
| `src/host-contracts/` | Types the host passes into `createDesktopAgent`            |

## Develop & test

From the repo root (npm workspaces):

```bash
npm install
npm run build -w packages/sail-desktop-agent
npm run test:unit -w packages/sail-desktop-agent   # Vitest
npm run test -w packages/sail-desktop-agent        # Cucumber + coverage
npm run lint -w packages/sail-desktop-agent
```

To exercise the agent with a full host UI, run Sail’s web shell (`npm run sail-web:dev` from the repo root) rather than this package alone.

## Status

Part of FDC3 Sail, which implements FDC3 for the Web and is still evolving — not production-ready. Issues and contributions welcome via the [FDC3-Sail](https://github.com/finos/FDC3-Sail) repository.
