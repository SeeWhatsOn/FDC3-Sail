---
sidebar_position: 3
---

# Sail Platform SDK Architecture

## Package: @finos/sail-platform-sdk

**Purpose**: Sail platform services - creates and manages the Desktop Agent and provides Sail-specific features

**Location**: `packages/sail-platform-sdk/`

## Overview

The `sail-platform-sdk` package is the **main entry point** for using Sail. It:

1. **Creates and manages the Desktop Agent** - `SailPlatform` holds the `DesktopAgent` instance
2. **Manages WCP connections** - Creates and manages `WCPConnector` for app connections
3. **Provides injectable UI interfaces** - Intent resolver, channel selector
4. **Provides platform features** - Workspaces, layouts, configuration storage
5. **Event coordination** - Forwards Desktop Agent events to consumers

**Key Principle**: `SailPlatform` is a stateless coordinator - the Desktop Agent is the source of truth

## Package Structure

```
packages/sail-platform-sdk/
├── src/
│   ├── sail-platform.ts               # Main entry point - SailPlatform class
│   ├── sail-browser-desktop-agent.ts  # Low-level browser wrapper (advanced)
│   ├── index.ts                       # Exports
│   ├── client/                        # Platform storage client
│   ├── services/                      # Service implementations
│   │   └── validation/                # DACP message validation (Zod schemas)
│   ├── interfaces/                    # UI interface definitions
│   │   ├── intent-resolver.ts         # Intent resolver interface
│   │   └── channel-selector.ts        # Channel selector interface
│   └── types/                         # Shared types
```

## Main Export: SailPlatform

`SailPlatform` is the primary API for using Sail:

```typescript
import { SailPlatform } from "@finos/sail-platform-sdk"

const platform = new SailPlatform({
  // REQUIRED: How to launch apps
  appLauncher: myAppLauncher,

  // OPTIONAL: UI implementations
  intentResolver: myIntentResolver,
  channelSelector: myChannelSelector,

  // OPTIONAL: Event callbacks
  onAppConnected: (metadata) => console.log('Connected:', metadata.appId),
  onAppDisconnected: (instanceId) => console.log('Disconnected:', instanceId),
  onChannelChanged: (instanceId, channelId) => console.log('Channel:', channelId),

  // OPTIONAL: Initial data
  apps: directoryApps,
  userChannels: customChannels,

  // OPTIONAL: Debug
  debug: true,
})

// Start the platform (creates Desktop Agent and WCP Connector)
platform.start()

// Access the Desktop Agent
platform.agent

// Access the WCP Connector
platform.connector

// Platform features (workspaces, layouts, config)
await platform.workspaces.list()
await platform.layouts.save(workspaceId, layout)
await platform.sailConfig.get()

// Change app channel (sends DACP on behalf of app)
await platform.changeAppChannel(instanceId, 'red')

// Stop when done
platform.stop()
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SailPlatform                                               │
│  - Creates and holds DesktopAgent                           │
│  - Creates and holds WCPConnector                           │
│  - Wires events and intent resolution                       │
│  - Provides namespaced APIs (workspaces, layouts, config)   │
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

## Injectable UI Interfaces

SailPlatform uses **dependency injection** for UI components:

### IntentResolver

```typescript
interface IntentResolver {
  resolve(request: IntentResolutionRequest): Promise<IntentResolutionResponse | null>
}

// Example implementation
const intentResolver: IntentResolver = {
  async resolve(request) {
    // Show dialog with request.handlers
    const selected = await showIntentDialog(request.handlers)
    return selected ? { target: selected } : null
  }
}
```

### ChannelSelector

```typescript
interface ChannelSelector {
  select(request: ChannelSelectionRequest): Promise<string | null>
}
```

## Event Flow

SailPlatform is a **stateless coordinator**:

1. Desktop Agent is the source of truth for FDC3 state
2. WCPConnector emits events when apps connect/disconnect/change channels
3. SailPlatform forwards events to consumers via callbacks
4. Consumers (e.g., Zustand stores in sail-web) manage their own UI state

```typescript
const platform = new SailPlatform({
  onAppConnected: (metadata) => {
    // Update your UI state
    uiStore.addApp(metadata)
  },
  onChannelChanged: (instanceId, channelId) => {
    // Update your UI state
    uiStore.setAppChannel(instanceId, channelId)
  },
})
```

## Low-Level API: createSailBrowserDesktopAgent

For advanced use cases where you need more control:

```typescript
import { createSailBrowserDesktopAgent } from "@finos/sail-platform-sdk"

const { desktopAgent, wcpConnector, start, stop } = createSailBrowserDesktopAgent({
  apps: directoryApps,
  requestIntentResolution: async (options) => {
    // Handle intent resolution
    return selectedApp
  },
  debug: true,
})

start()
```

This is lower-level than `SailPlatform` and doesn't include:
- Namespaced APIs (workspaces, layouts, config)
- Event wiring
- Channel change helpers

## Design Decisions

### Why SailPlatform holds the Desktop Agent

**Composition**: SailPlatform composes Desktop Agent + WCPConnector + Platform features
- Clear ownership: SailPlatform manages lifecycle
- Single entry point: One object to start/stop
- Event coordination: Wires everything together

### Why Stateless Coordinator Pattern

**SailPlatform doesn't cache state** - it forwards events:
- Desktop Agent is the single source of truth
- Consumers manage their own UI state
- Avoids state synchronization bugs
- Clear data flow

### Why Injectable UI Interfaces

**Dependency injection for UI components**:
- Sail-web provides React implementations
- Other consumers can provide their own
- Testable: inject mocks for testing
- Flexible: different UI per environment
