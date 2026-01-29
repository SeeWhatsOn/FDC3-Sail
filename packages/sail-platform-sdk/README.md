# @finos/sail-platform-sdk

Platform SDK for FDC3 Sail. This package provides browser-side Desktop Agent integration and platform-specific features for the Sail application.

## Installation

```bash
npm install @finos/sail-platform-sdk
```

## What's Included

- **Browser Desktop Agent** - `createSailBrowserDesktopAgent` for browser-based FDC3 apps
- **Platform Client** - `SailPlatformClient` for workspaces, layouts, and configuration
- **Services** - App launcher and DACP validation utilities
- **Types & Constants** - Sail protocol message types and constants

## Usage

### Browser Desktop Agent

The `createSailBrowserDesktopAgent` factory creates a browser-based Desktop Agent with WCP (Web Connection Protocol) support for connecting FDC3 apps running in iframes.

```typescript
import { createSailBrowserDesktopAgent, SailAppLauncher } from "@finos/sail-platform-sdk"

// Create app launcher (handles opening apps in your UI)
const appLauncher = new SailAppLauncher({
  onLaunchApp: async (appMetadata, instanceId, context) => {
    // Your UI logic to open app in iframe/tab/window
    console.log(`Launching ${appMetadata.appId} as ${instanceId}`)
  }
})

// Create the browser desktop agent
const result = await createSailBrowserDesktopAgent({
  appLauncher,
  apps: directoryApps, // Array of DirectoryApp entries
  onAppConnected: (metadata) => {
    console.log(`App connected: ${metadata.appId}`)
  },
  onAppDisconnected: (instanceId) => {
    console.log(`App disconnected: ${instanceId}`)
  }
})

// Access the desktop agent and WCP connector
const { desktopAgent, wcpConnector } = result
```

### Platform Client

The `SailPlatformClient` provides APIs for Sail-specific features like workspace management and layout persistence.

```typescript
import { SailPlatformClient } from "@finos/sail-platform-sdk"

// Create client (uses localStorage by default)
const client = new SailPlatformClient()

// Workspace management
const workspaces = await client.getWorkspaces()
const workspace = await client.createWorkspace("My Workspace")
await client.deleteWorkspace(workspaceId)

// Layout persistence
const layout = await client.getWorkspaceLayout(workspaceId)
await client.saveWorkspaceLayout(workspaceId, layoutData)

// User configuration
const config = await client.getConfig()
await client.updateConfig({ theme: "dark" })
```

### DACP Validation

Validate FDC3 DACP messages using auto-generated Zod schemas.

```typescript
import { validateDACPMessage, safeParseDACPMessage } from "@finos/sail-platform-sdk"

// Throws on invalid message
validateDACPMessage(message)

// Returns result object (doesn't throw)
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
├── SailBrowserDesktopAgent.ts   # Browser desktop agent factory
├── client/                      # Platform client
│   ├── SailPlatformClient.ts    # Main client API
│   ├── LocalStorageBackend.ts   # Storage implementation
│   ├── PlatformApi.ts           # Storage interface
├── services/
│   ├── app-launcher/            # App launching service
│   └── validation/              # DACP validation (Zod)
├── types/
│   ├── sail-types.ts            # Core type definitions
│   └── sail-messages.ts         # Message payload types
└── middleware/                  # Middleware pipeline utilities
```

## Re-exports

This package re-exports commonly used items from `@finos/sail-desktop-agent` for convenience:

```typescript
// From @finos/sail-desktop-agent/browser
export { WCPConnector, MessagePortTransport, createBrowserDesktopAgent }

// From @finos/sail-desktop-agent
export { DesktopAgent, type DirectoryApp, type WebAppDetails }
```

## License

Copyright 2025 FINOS. Distributed under the Apache 2.0 License.
