---
sidebar_position: 1
---

# @finos/sail-platform

Platform SDK for FDC3 Sail. Wraps `@finos/sail-desktop-agent` with host UI seams, workspace/layout/config persistence, and host integration helpers.

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

## Extensibility and validation

- **`MiddlewarePipeline`** — **superseded; not a working extension point.** The class is exported and a
  pipeline is constructed, but it is never wired into the message path, so registering middleware has no
  effect on DACP traffic. Do not build against it. The intended mechanism is the observability seam —
  see [Architecture Overview](../../architecture/overview#extensibility-the-observability-seam-planned),
  which is `planned` and not yet callable.
- **Message validation** — inbound DACP/WCP messages are checked against the FDC3 schema from `@finos/fdc3-schema`, the same mechanism `@finos/sail-desktop-agent` uses

## Re-exports

For convenience, commonly used sail-desktop-agent symbols are re-exported:

```typescript
import {
  SailDesktopAgent,
  createSailBrowserDesktopAgent,
} from "@finos/sail-platform"
```

## Related

- [Desktop Agent integrator guide](../desktop-agent/integrator-guide)
- [Architecture overview](../../architecture/overview)
- [Channel selection](../../architecture/channel-selection)
