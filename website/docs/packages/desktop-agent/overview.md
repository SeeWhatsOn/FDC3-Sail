---
sidebar_position: 1
---

# @finos/sail-desktop-agent

Browser-ready FDC3 2.2 Desktop Agent — `SailDesktopAgent`, DACP handlers, channel and intent state, app directory, and WCP `BrowserAppConnection`.

**Location:** `packages/sail-desktop-agent/`

## What it does

- Implements mandatory FDC3 2.2 Desktop Agent APIs via DACP
- **Browser-first:** one `DesktopAgent` per host page, with FDC3 web apps connecting via WCP and per-app `MessagePort`
- Keeps platform concerns (layout, workspace, storage, config) **out** of the core — those belong in [`@finos/sail-platform`](../platform/overview)

The package also runs in Node.js or test harnesses for handler-level work (`MockTransport`, Cucumber). That is not the primary adoption path for shipping a desktop.

## Two ways to integrate

| Mode | When to use | Entry |
|------|-------------|-------|
| **Browser-ready** | Default — host page runs DA + WCP edge in-tab | `SailDesktopAgent` from `@finos/sail-desktop-agent` |
| **Manual composition** | Handler tests or framework internals | `DesktopAgent` plus an app connection |

```text
  FDC3 Apps          Your host                 FDC3 engine (in-tab)
  (external)    →   contracts + controllers →   new SailDesktopAgent()
  fdc3.getAgent()    launcher · intentResolver     (BrowserAppConnection + DA)
                     channels · apps
```

Remote or server-hosted Desktop Agent (`createWCPClient`) is **not** a supported adoption path on v3-pre. Cross-tab sync and native app transports are deferred as explicit future adapters — see the [integrator guide](./integrator-guide#server-worker-native-and-multi-device-paths-deferred).

## Package layout

```text
packages/sail-desktop-agent/src/
├── agent/             # DesktopAgent, SailDesktopAgent, config
├── host-contracts/    # AppLauncher, IntentResolver, ChannelControl, …
├── app-connection/    # BrowserAppConnection, MessagePortTransport, WCP protocol
├── handlers/          # DACP dispatch and request handlers
└── state/             # AgentState selectors and mutators
```

## Documentation map

| Doc | Purpose |
|-----|---------|
| [Add your app to Sail](../../add-your-app) | App developer onboarding — `@finos/fdc3`, app directory metadata, contexts and intents |
| [Getting started](../../getting-started) | Adoption paths — browser-ready agent, host contracts, `@finos/fdc3` |
| [Integrator guide](./integrator-guide) | **Deep reference** — host contracts, browser-first agent, WCP/DACP detail, [heartbeat config](./integrator-guide#heartbeat-and-liveness-configuration) |
| [Composition & internals](./composition) | Diagrams — how edge, DA, and host contracts interact |
| [Conformance traceability](./conformance) | BDD `@fdc3_2.2` coverage vs FINOS toolbox oracle |

## Quick start

```typescript
import { SailDesktopAgent } from "@finos/sail-desktop-agent"
import type { AppLauncher } from "@finos/sail-desktop-agent"

const appLauncher: AppLauncher = {
  async launch(request, app) {
    const instanceId = request.app?.instanceId ?? crypto.randomUUID()
    // Mount iframe with name={instanceId} — required for WCP4 identity
    return { appId: app.appId, instanceId }
  },
}

const desktopAgent = new SailDesktopAgent({ appLauncher })

const { intentResolver, channels, apps } = desktopAgent
await apps.addDirectory("/apps.json")

intentResolver.onRequest(/* your picker UI */)
channels.onAppChannelChange(/* update channel chrome */)
apps.onConnect(/* tab / tile lifecycle */)

// Auto-started by default — iframe apps can await fdc3.getAgent()
```

Returns a single `SailDesktopAgent` with grouped host controllers (`intentResolver`, `channels`, `apps`); the browser edge starts and stops with `desktopAgent.start()` / `desktopAgent.stop()`.

See the [integrator guide](./integrator-guide) for intent resolution, channel chrome, runtime catalog registration, and lifecycle.

## Subpath exports

```typescript
import { DesktopAgent, SailDesktopAgent } from "@finos/sail-desktop-agent"
import { BrowserAppConnection, MessagePortTransport } from "@finos/sail-desktop-agent/browser"
```

Application code should prefer `SailDesktopAgent`. Use `/browser` only when you need lower-level browser app-connection primitives such as `BrowserAppConnection` or `MessagePortTransport`.
