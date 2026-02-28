# @finos/sail-platform-api

Platform SDK for FDC3 Sail. Wraps `@finos/sail-desktop-agent` with Sail-specific middleware, app launching, and integration utilities for building FDC3-enabled browser and desktop applications.

## Relationship to sail-desktop-agent

`sail-desktop-agent` provides the pure, environment-agnostic FDC3 Desktop Agent core. `sail-platform-api` sits on top of it and adds:

- **Middleware pipeline** — intercept and transform DACP messages before they reach the Desktop Agent
- **Sail app launcher** — `SailAppLauncher` for opening FDC3 apps in your UI
- **Platform client** — workspace, layout, and configuration persistence via `SailPlatformClient`
- **Convenience factory** — `createSailBrowserDesktopAgent` pre-wires middleware and WCP
- **DACP validation** — Zod-based message validation re-exported from the schema package

```
apps/sail-web (React UI)
        │
        ▼
@finos/sail-platform-api         ← this package
  - SailPlatform
  - createSailBrowserDesktopAgent
  - SailAppLauncher
  - MiddlewarePipeline
        │
        ▼
@finos/sail-desktop-agent        ← pure FDC3 core
  - DesktopAgent
  - WCPConnector (./browser)
  - InMemoryTransport (./transports)
```

## Installation

```bash
npm install @finos/sail-platform-api
```

## Usage

### Browser Desktop Agent (recommended)

`createSailBrowserDesktopAgent` is the easiest way to get a fully wired Desktop Agent in a browser app:

```typescript
import { createSailBrowserDesktopAgent, SailAppLauncher } from "@finos/sail-platform-api"

const appLauncher = new SailAppLauncher({
  onLaunchApp: async (appMetadata, instanceId, context) => {
    // Open the app in an iframe / window in your UI
    console.log(`Launching ${appMetadata.appId} as ${instanceId}`)
  },
})

const { desktopAgent, wcpConnector } = await createSailBrowserDesktopAgent({
  appLauncher,
  appDirectories: ["https://example.com/apps.json"],
  onAppConnected: (metadata) => console.log(`App connected: ${metadata.appId}`),
  onAppDisconnected: (instanceId) => console.log(`App disconnected: ${instanceId}`),
})

// FDC3 apps in iframes can now connect via fdc3.getAgent()
```

### Middleware Pipeline

Use `MiddlewarePipeline` to intercept DACP messages before they reach the Desktop Agent:

```typescript
import { MiddlewarePipeline, type Middleware } from "@finos/sail-platform-api"

const loggingMiddleware: Middleware = async (message, next) => {
  console.log("DACP message:", message.type)
  return next(message)
}

const pipeline = new MiddlewarePipeline([loggingMiddleware])
```

### Platform Client

`SailPlatformClient` persists workspace layouts and user configuration:

```typescript
import { SailPlatformClient } from "@finos/sail-platform-api"

const client = new SailPlatformClient()

// Workspace management
const workspaces = await client.getWorkspaces()
const workspace = await client.createWorkspace("Trading Dashboard")
await client.deleteWorkspace(workspace.id)

// Layout persistence
const layout = await client.getWorkspaceLayout(workspace.id)
await client.saveWorkspaceLayout(workspace.id, layoutData)

// User configuration
const config = await client.getConfig()
await client.updateConfig({ theme: "dark" })
```

### DACP Validation

Validate FDC3 DACP messages at runtime using auto-generated Zod schemas:

```typescript
import { validateDACPMessage, safeParseDACPMessage } from "@finos/sail-platform-api"

// Throws on invalid message
validateDACPMessage(message)

// Returns result object (does not throw)
const result = safeParseDACPMessage(message)
if (result.success) {
  console.log("Valid:", result.data)
} else {
  console.log("Invalid:", result.error)
}
```

## Package Structure

```
src/
├── sail-browser-desktop-agent.ts  # createSailBrowserDesktopAgent factory
├── sail-platform.ts               # SailPlatform unified entry point
├── client/                        # Platform client
│   ├── sail-platform-client.ts    # Main client API
│   ├── local-storage-backend.ts   # Default localStorage persistence
│   └── platform-api.ts            # Storage interface
├── interfaces/                    # Injectable UI interfaces
│   ├── intent-resolver.ts         # IntentResolver interface
│   └── channel-selector.ts        # ChannelSelector interface
├── middleware/                    # Middleware pipeline
│   └── middleware.ts
├── services/
│   ├── app-launcher/              # SailAppLauncher
│   └── validation/                # DACP Zod validation
├── types/
│   ├── sail-types.ts              # Core type definitions
│   └── sail-messages.ts           # Message payload types
└── utils/
    └── uuid.ts                    # UUID generation
```

## Re-exports from sail-desktop-agent

For convenience, this package re-exports the most commonly used items from `@finos/sail-desktop-agent`:

```typescript
// From @finos/sail-desktop-agent/browser
export { WCPConnector, MessagePortTransport, createBrowserDesktopAgent }

// From @finos/sail-desktop-agent
export { DesktopAgent, type DirectoryApp, type WebAppDetails }
```

## License

Copyright 2025 FINOS. Distributed under the Apache 2.0 License.
