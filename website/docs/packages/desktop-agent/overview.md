---
sidebar_position: 1
---

# @finos/sail-desktop-agent

Pure, transport-agnostic FDC3 2.2 Desktop Agent — DACP handlers, channel and intent state, app directory, and browser WCP support.

**Location:** `packages/sail-desktop-agent/`

## What it does

- Implements all mandatory FDC3 2.2 Desktop Agent APIs via DACP
- **Browser-first:** one `DesktopAgent` per host page, with FDC3 web apps connecting via WCP and per-app `MessagePort`
- Keeps platform concerns (layout, workspace, storage, config) **out** of the core — those belong in [`@finos/sail-platform-api`](../platform-api/overview)

The package also runs in Node.js or test harnesses for handler-level work (`MockTransport`, Cucumber). That is not the primary adoption path for shipping a desktop.

## Two ways to integrate

| Mode | When to use | Entry |
|------|-------------|-------|
| **Browser preset** | Default — host page runs DA + WCP edge in-tab | `createBrowserDesktopAgent` from `@finos/sail-desktop-agent/presets` |
| **Manual composition** | Custom wiring, edge tests, framework authors | `DesktopAgent`, `WCPConnector`, `createInMemoryTransportPair` from subpath exports |

```text
  FDC3 Apps          Your host                 FDC3 engine (in-tab)
  (external)    →   contracts + controllers →   createBrowserDesktopAgent()
  fdc3.getAgent()    launcher · intentResolver     (WCP edge + DA via BrowserDaEdgeLink)
                     channels · apps
```

Remote or server-hosted Desktop Agent (`createWCPClient`) is **not** a supported adoption path on v3-pre. Cross-tab sync and native app transports are deferred as explicit future adapters — see the [integrator guide](./integrator-guide#server-worker-native-and-multi-device-paths-deferred).

## Package layout

```text
packages/sail-desktop-agent/src/
├── core/              # DesktopAgent, DACP handlers, state, app directory
├── host-contracts/    # AppLauncher, IntentResolver, ChannelControl, …
├── app-connection/    # WCPConnector, MessagePortTransport, BrowserDaEdgeLink, WCP protocol
├── transports/        # InMemoryTransport, MockTransport (tests)
└── presets/           # createBrowserDesktopAgent and related factories
```

## Documentation map

| Doc | Purpose |
|-----|---------|
| [Add your app to Sail](../../add-your-app) | App developer onboarding — `@finos/fdc3`, app directory metadata, contexts and intents |
| [Getting started](../../getting-started) | Adoption paths — browser preset, host contracts, `@finos/fdc3` |
| [Integrator guide](./integrator-guide) | **Deep reference** — host contracts, browser-first preset, WCP/DACP detail, [heartbeat config](./integrator-guide#heartbeat-and-liveness-configuration) |
| [Composition & internals](./composition) | Diagrams — how edge, DA, transports, and host contracts interact |
| [Conformance traceability](./conformance) | BDD `@conformance2.2` coverage vs FINOS toolbox oracle |

## Quick start

```typescript
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"
import type { AppLauncher } from "@finos/sail-desktop-agent"

const appLauncher: AppLauncher = {
  async launch(request, app) {
    const instanceId = request.app?.instanceId ?? crypto.randomUUID()
    // Mount iframe with name={instanceId} — required for WCP4 identity
    return { appId: app.appId, instanceId }
  },
}

const desktopAgent = createBrowserDesktopAgent({ appLauncher })

const { intentResolver, channels, apps } = desktopAgent
await apps.addDirectory("/apps.json")

intentResolver.onRequest(/* your picker UI */)
channels.onAppChannelChange(/* update channel chrome */)
apps.onConnect(/* tab / tile lifecycle */)

// Auto-started by default — iframe apps can await fdc3.getAgent()
```

Returns a single `DesktopAgent` with grouped host controllers (`intentResolver`, `channels`, `apps`); the browser edge starts and stops with `desktopAgent.start()` / `desktopAgent.stop()`. Prefer `intentResolver` over the transitional `intentResolverUI` alias.

See the [integrator guide](./integrator-guide) for intent resolution, channel chrome, runtime catalog registration, and lifecycle.

## Subpath exports

```typescript
import { DesktopAgent } from "@finos/sail-desktop-agent"
import { createBrowserDesktopAgent, createBrowserHostControllers, getBrowserDesktopAgentSession } from "@finos/sail-desktop-agent/presets"
import { createInMemoryTransportPair } from "@finos/sail-desktop-agent/transports"
```

Application code should prefer `@finos/sail-desktop-agent/presets` for factories. Use `createBrowserHostControllers` when composing `DesktopAgent` + `WCPConnector` manually. Use `/browser` for tree-shaking when you only need `WCPConnector` or `MessagePortTransport`; link DA and edge with `createInMemoryTransportPair` from `/transports`. The preset couples DA and edge internally via `BrowserDaEdgeLink` — that module is not a public export.
