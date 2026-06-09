---
sidebar_position: 3
---

# Sail Platform SDK Architecture

## Package: @finos/sail-platform-api

**Purpose**: Sail platform services — wraps `@finos/sail-desktop-agent` and adds workspace, layout, config, and host integration.

**Location**: `packages/sail-platform-api/`

Full package docs: [@finos/sail-platform-api overview](../packages/platform-api/overview).

## Overview

| Concern | Owner |
|---------|--------|
| FDC3 engine (`core`, `protocols`, `transports`, `connectors`, `presets`) | `@finos/sail-desktop-agent` |
| Host contracts | `@finos/sail-desktop-agent` (`host-contracts`) |
| **Layout**, **workspace**, **storage**, **config** | `@finos/sail-platform-api` |

Choose **manual composition** from `@finos/sail-desktop-agent` for custom stacks; use **`SailPlatform`** here for batteries-included wiring plus platform features.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  SailPlatform                                               │
│  - Creates DesktopAgent via createBrowserDesktopAgent       │
│  - Exposes WCPConnector via platform.connector              │
│  - Workspaces, layouts, config namespaced APIs              │
└─────────────────────────────────────────────────────────────┘
        │                                │
        ▼                                ▼
┌─────────────────────┐    ┌─────────────────────────────────┐
│   DesktopAgent      │◄──►│   WCPConnector                  │
│   (FDC3 engine)     │    │   (Browser app connections)     │
└─────────────────────┘    └─────────────────────────────────┘
        ▲                                ▲
        │   InMemoryTransport pair       │
        └────────────────────────────────┘
```

## SailPlatform

```typescript
import { SailPlatform } from "@finos/sail-platform-api"

const platform = new SailPlatform({
  appLauncher: myAppLauncher,
  intentResolver: myIntentResolver,
  onAppConnected: meta => console.log("Connected:", meta.appId),
  onAppDisconnected: instanceId => console.log("Disconnected:", instanceId),
  onChannelChanged: (instanceId, channelId) => updateChrome(instanceId, channelId),
  apps: directoryApps,
})

platform.start()

platform.agent          // DesktopAgent
platform.connector      // WCPConnector

await platform.changeAppChannel(instanceId, "fdc3.channel.1")
const channelId = platform.getAppUserChannel(instanceId)

await platform.workspaces.list()
await platform.layouts.save(workspaceId, layout)

platform.stop()
```

See [Channel selection](./channel-selection) for host chrome vs app-hosted selector URLs.

## createSailBrowserDesktopAgent (advanced)

```typescript
import { createSailBrowserDesktopAgent } from "@finos/sail-platform-api"

const desktopAgent = createSailBrowserDesktopAgent({
  appLauncher: myLauncher,
  appDirectories: ["/apps.json"],
  allowedOrigins: ["https://my-host.example"],
  debug: true,
})

desktopAgent.start()
```

Returns a **`DesktopAgent`** (with optional `.use()` middleware) — not a destructured `{ desktopAgent, wcpConnector, start, stop }` object. The browser edge is coupled to `desktopAgent.start()` / `stop()`.

Lower-level than `SailPlatform` — no workspace/layout APIs or event wiring helpers.

## Injectable UI interfaces

- **`IntentResolver`** — host intent disambiguation UI
- **`ChannelSelector`** — optional channel picker callback

Sail-web provides React implementations; tests can inject mocks.

## Design decisions

**SailPlatform holds the Desktop Agent** — single lifecycle entry, clear ownership.

**Stateless coordinator** — Desktop Agent is source of truth; platform forwards events to consumer stores.

**Dependency injection for UI** — different hosts can supply their own resolver/selector implementations.

## Related

- [Desktop Agent integrator guide](../packages/desktop-agent/integrator-guide)
- [Composition diagrams](../packages/desktop-agent/composition)
- [@finos/sail-web](../packages/sail-web/overview)
