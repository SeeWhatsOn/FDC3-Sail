---
sidebar_position: 1
---

# @finos/sail-platform

Platform SDK for FDC3 Sail. Wraps `@finos/sail-desktop-agent` with Sail-specific middleware, workspace/layout/config persistence, and host integration helpers.

**Location:** `packages/sail-platform/`

## Boundary

| Concern | Owner |
|---------|--------|
| FDC3 engine, WCP, DACP, browser host controllers | [`@finos/sail-desktop-agent`](../desktop-agent/overview) |
| **Layout**, **workspace**, **storage**, **config** | `@finos/sail-platform` |
| React workspace UI | [`@finos/sail-finance`](../sail-finance/overview) |

## Stack position

```text
sail-finance (React UI)
        │
        ▼
@finos/sail-platform          ← this package
  - SailPlatform
  - createSailBrowserDesktopAgent
  - SailAppLauncher
  - MiddlewarePipeline
        │
        ▼
@finos/sail-desktop-agent         ← FDC3 engine
  - DesktopAgent
  - SailDesktopAgent
  - BrowserAppConnection
```

## SailPlatform (recommended)

Primary entry point for a full Sail host:

```typescript
import { SailPlatform } from "@finos/sail-platform"

const platform = new SailPlatform({
  appLauncher: myAppLauncher,
  intentResolver: myIntentResolver, // optional
  onAppConnected: meta => console.log(meta.appId),
  onChannelChanged: (instanceId, channelId) => updateChrome(instanceId, channelId),
})

platform.start()

// Channel chrome — typed join/leave, no DACP impersonation
await platform.changeAppChannel(instanceId, "fdc3.channel.1")
const channelId = platform.getAppUserChannel(instanceId)

// Platform features
await platform.workspaces.list()
await platform.layouts.save(workspaceId, layout)

platform.stop()
```

`SailPlatform` owns a `SailDesktopAgent` from `@finos/sail-desktop-agent`. Access the lower-level browser app connection through `platform.connector` only for platform integration work; ordinary host UI should use the typed platform methods.

See [Channel selection](../../architecture/channel-selection) for host chrome vs app-hosted selector URLs.

## createSailBrowserDesktopAgent (advanced)

Lower-level browser wrapper with Sail WCP defaults and optional origin allowlist. It returns a `SailDesktopAgent` without workspace/layout APIs:

```typescript
import { createSailBrowserDesktopAgent } from "@finos/sail-platform"

const desktopAgent = createSailBrowserDesktopAgent({
  appLauncher: myLauncher,
  appDirectories: ["/apps.json"],
  allowedOrigins: ["https://my-host.example"], // optional Sail policy
  debug: true,
})

// Returns SailDesktopAgent — browser app connection starts with the agent
desktopAgent.start()
```

Does **not** include workspace/layout APIs or `SailPlatform` event wiring. Prefer `SailPlatform` for production hosts.

## Middleware and validation

- **`MiddlewarePipeline`** — intercept DACP messages before the Desktop Agent
- **`validateDACPMessage` / `safeParseDACPMessage`** — Zod-based DACP validation

## Re-exports

For convenience, commonly used sail-desktop-agent symbols are re-exported:

```typescript
import {
  DesktopAgent,
  SailDesktopAgent,
  createSailBrowserDesktopAgent,
} from "@finos/sail-platform"
```

## Related

- [Desktop Agent integrator guide](../desktop-agent/integrator-guide)
- [Architecture overview](../../architecture/overview)
- [Channel selection](../../architecture/channel-selection)
