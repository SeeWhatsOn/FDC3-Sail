---
sidebar_position: 1
---

# @finos/sail-desktop-agent

Pure, transport-agnostic FDC3 2.2 Desktop Agent — DACP handlers, channel and intent state, app directory, and browser WCP support.

**Location:** `packages/sail-desktop-agent/`

## What it does

- Implements all mandatory FDC3 2.2 Desktop Agent APIs via DACP
- Runs in browser, Node.js, Web Worker, or any JavaScript runtime
- Keeps platform concerns (layout, workspace, storage, config) **out** of the core — those belong in [`@finos/sail-platform-api`](../platform-api/overview)

## Two ways to integrate

| Mode | When to use | Entry |
|------|-------------|-------|
| **Presets** | Default browser or remote-client wiring | `createBrowserDesktopAgent` from `@finos/sail-desktop-agent/presets` |
| **Manual composition** | Custom transports, full control | `DesktopAgent`, `WCPConnector`, `Transport` from subpath exports |

```text
  FDC3 Apps          Your host                 FDC3 engine
  (external)    →   contracts you wire   →   createBrowserDesktopAgent()
  fdc3.getAgent()    launcher · directory      (browser edge + DA)
                     intent · channel UI
```

## Package layout

```text
packages/sail-desktop-agent/src/
├── core/              # DesktopAgent, DACP handlers, state, app directory
├── host-contracts/    # AppLauncher, IntentResolver, ChannelControl, …
├── protocols/         # DACP and WCP types and helpers
├── transports/        # InMemoryTransport, transport pairs
├── connectors/        # Browser WCP connector, MessagePort bridge
└── presets/           # createBrowserDesktopAgent and related factories
```

## Documentation map

| Doc | Purpose |
|-----|---------|
| [Add your app to Sail](../../add-your-app) | App developer onboarding — `@finos/fdc3`, app directory metadata, contexts and intents |
| [Getting started](../../getting-started) | Adoption paths — preset vs manual, host contracts, `@finos/fdc3` |
| [Integrator guide](./integrator-guide) | **Deep reference** — host contracts, presets, deployment fork, WCP/DACP detail, [heartbeat config](./integrator-guide#heartbeat-and-liveness-configuration) |
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

const desktopAgent = createBrowserDesktopAgent({
  appDirectories: ["/apps.json"],
  appLauncher,
})

// Auto-started by default — iframe apps can await fdc3.getAgent()
```

Returns a single `DesktopAgent`; the browser edge starts and stops with `desktopAgent.start()` / `desktopAgent.stop()`. Browser hosts can wire custom resolver UI with `desktopAgent.intentResolverUI?.onRequest(...)`; these host UI methods are not FDC3 DACP/WCP wire messages.

See the [integrator guide](./integrator-guide) for intent resolution, channel chrome, remote DA, and lifecycle callbacks.

## Subpath exports

```typescript
import { DesktopAgent } from "@finos/sail-desktop-agent"
import { getBrowserDesktopAgentSession } from "@finos/sail-desktop-agent/presets"
import { createInMemoryTransportPair } from "@finos/sail-desktop-agent/transports"
import { createBrowserDesktopAgent } from "@finos/sail-desktop-agent/presets"
```

Application code should prefer `@finos/sail-desktop-agent/presets` for factories and `getBrowserDesktopAgentSession`. Use `/browser` (app-connection) for tree-shaking when you only need `WCPConnector` or `MessagePortTransport`.
