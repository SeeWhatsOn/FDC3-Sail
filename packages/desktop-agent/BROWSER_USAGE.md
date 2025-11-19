# Browser Desktop Agent Usage Guide

This guide explains how to use the browser-specific FDC3 Desktop Agent implementation with WCP (Web Connection Protocol) support.

## Overview

The browser module provides a complete FDC3 Desktop Agent setup for browser environments with:

- **Pure Desktop Agent Core** - Environment-agnostic FDC3 engine
- **WCP Connector** - Handles WCP1-3 handshake with iframe apps
- **MessagePort Transport** - Direct browser-to-browser communication
- **InMemory Transport** - Connects Desktop Agent to WCP Connector in same process

## Tree-Shaking

The browser module is **tree-shakeable**. If you only import the core Desktop Agent, browser-specific code will NOT be included in your bundle.

```typescript
// ✅ Browser code NOT included (core only)
import { DesktopAgent } from '@finos/fdc3-sail-desktop-agent'

// ✅ Browser code included (WCP support)
import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'
```

## Quick Start

### Pattern 1: Complete Browser DA (Recommended)

The easiest way to set up a browser Desktop Agent with WCP support:

```typescript
import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'

// Create browser Desktop Agent with WCP connector
const { desktopAgent, wcpConnector, start, stop } = createBrowserDesktopAgent({
  wcpOptions: {
    getIntentResolverUrl: (instanceId) => `/intent-resolver?id=${instanceId}`,
    getChannelSelectorUrl: (instanceId) => `/channel-selector?id=${instanceId}`,
    fdc3Version: '2.2',
    handshakeTimeout: 5000
  },
  appDirectories: [myAppDirectory]
})

// Start both Desktop Agent and WCP Connector
start()

// Desktop Agent is now ready to handle FDC3 apps in iframes!
// Apps will connect via WCP when they call fdc3.getAgent()

// Later, when cleaning up:
stop()
```

### Pattern 2: Sail-Controlled UI (No Injected Iframes)

For Sail's architecture where UI is controlled by the parent window (not injected iframes):

```typescript
import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'

const { desktopAgent, wcpConnector, start } = createBrowserDesktopAgent({
  wcpOptions: {
    // Return false to indicate Sail provides UI externally
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false
  }
})

start()

// Apps receive WCP3Handshake with:
// {
//   intentResolverUrl: false,
//   channelSelectorUrl: false
// }
//
// This tells apps that the Desktop Agent provides UI by alternative means
// (Sail parent window controls channel selector and intent resolver)
```

### Pattern 3: Manual Composition (Advanced)

For fine-grained control over setup:

```typescript
import { DesktopAgent } from '@finos/fdc3-sail-desktop-agent'
import { WCPConnector } from '@finos/fdc3-sail-desktop-agent/browser'
import { createInMemoryTransportPair } from '@finos/fdc3-sail-desktop-agent/transports'

// Create in-process transport pair
const [daTransport, wcpTransport] = createInMemoryTransportPair()

// Create Desktop Agent
const desktopAgent = new DesktopAgent({
  transport: daTransport,
  // ... other options
})

// Create WCP Connector
const wcpConnector = new WCPConnector(wcpTransport, {
  getIntentResolverUrl: (id) => `/resolver?id=${id}`,
  getChannelSelectorUrl: (id) => `/selector?id=${id}`
})

// Start both
desktopAgent.start()
wcpConnector.start()
```

## Configuration Options

### WCPConnectorOptions

```typescript
interface WCPConnectorOptions {
  /**
   * Function to generate intent resolver URL for a given app instance.
   * Return undefined or false to indicate Sail-controlled UI.
   */
  getIntentResolverUrl?: (instanceId: string) => string | undefined | false

  /**
   * Function to generate channel selector URL for a given app instance.
   * Return undefined or false to indicate Sail-controlled UI.
   */
  getChannelSelectorUrl?: (instanceId: string) => string | undefined | false

  /**
   * FDC3 version to advertise in WCP3Handshake.
   * Defaults to "2.2"
   */
  fdc3Version?: string

  /**
   * Timeout for WCP handshake completion (ms).
   * Defaults to 5000ms.
   */
  handshakeTimeout?: number
}
```

### BrowserDesktopAgentOptions

```typescript
interface BrowserDesktopAgentOptions {
  /** WCP connector configuration */
  wcpOptions?: WCPConnectorOptions

  /** App directories to load */
  appDirectories?: any[]

  /** Custom app launcher implementation */
  appLauncher?: AppLauncher

  /** Custom registries (for advanced use cases) */
  registries?: {
    appInstanceRegistry?: AppInstanceRegistry
    intentRegistry?: IntentRegistry
    channelContextRegistry?: ChannelContextRegistry
    appChannelRegistry?: AppChannelRegistry
    userChannelRegistry?: UserChannelRegistry
  }
}
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Iframe App 1                                            │
│  Uses @finos/fdc3 library                                │
│  Calls getAgent() → Sends WCP1Hello                      │
└───────────────────┬─────────────────────────────────────┘
                    │ postMessage
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Parent Window (Sail UI)                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │ WCP Connector                                      │  │
│  │ - Receives WCP1Hello                               │  │
│  │ - Creates MessageChannel                           │  │
│  │ - Sends WCP3Handshake with port1                   │  │
│  │ - Wraps port2 as MessagePortTransport              │  │
│  └─────────────────┬─────────────────────────────────┘  │
│                    │ InMemoryTransport                   │
│                    ↓                                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Desktop Agent Core                                 │  │
│  │ - Processes WCP4 validation                        │  │
│  │ - Handles DACP messages                            │  │
│  │ - Manages app instances, intents, channels         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Message Flow

1. **App Initialization**:
   - Iframe loads and calls `fdc3.getAgent()`
   - Sends `WCP1Hello` via `window.postMessage()`

2. **WCP Handshake**:
   - WCP Connector receives `WCP1Hello`
   - Creates `MessageChannel`
   - Sends `WCP3Handshake` with `port1` back to app
   - Wraps `port2` as `MessagePortTransport`

3. **App Validation**:
   - App sends `WCP4ValidateAppIdentity` via port
   - Desktop Agent validates app identity
   - Returns `WCP5ValidateAppIdentityResponse`

4. **DACP Communication**:
   - All subsequent messages use DACP protocol
   - WCP Connector routes messages based on `instanceId`
   - Desktop Agent processes DACP requests/responses/events

## Events

### WCP Connector Events

Listen to WCP Connector events for monitoring and debugging:

```typescript
const { wcpConnector } = createBrowserDesktopAgent()

// App successfully connected
wcpConnector.on('appConnected', (metadata) => {
  console.log('App connected:', {
    appId: metadata.appId,
    instanceId: metadata.instanceId,
    connectedAt: metadata.connectedAt
  })
})

// App disconnected
wcpConnector.on('appDisconnected', (instanceId) => {
  console.log('App disconnected:', instanceId)
})

// Handshake failed
wcpConnector.on('handshakeFailed', (error, connectionAttemptUuid) => {
  console.error('WCP handshake failed:', error, connectionAttemptUuid)
})
```

## Accessing Registries

The Desktop Agent instance provides access to all registries:

```typescript
const { desktopAgent } = createBrowserDesktopAgent()

// Get registries for inspection/monitoring
const appRegistry = desktopAgent.getAppInstanceRegistry()
const intentRegistry = desktopAgent.getIntentRegistry()
const channelRegistry = desktopAgent.getChannelContextRegistry()

// Example: Get all connected apps
const allApps = appRegistry.getAllInstances()
console.log('Connected apps:', allApps.map(app => app.appId))
```

## Integration with Sail UI

For integrating with Sail's React components:

```typescript
// In your React app entry point
import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'
import { useEffect, useState } from 'react'

function App() {
  const [da, setDa] = useState(null)

  useEffect(() => {
    const { desktopAgent, wcpConnector, start } = createBrowserDesktopAgent({
      wcpOptions: {
        getIntentResolverUrl: () => false,  // Sail-controlled UI
        getChannelSelectorUrl: () => false
      }
    })

    start()
    setDa(desktopAgent)

    return () => {
      wcpConnector.stop()
      desktopAgent.stop()
    }
  }, [])

  return (
    <div>
      {/* Your Sail UI components */}
      {/* Channel selector, intent resolver, etc. */}
    </div>
  )
}
```

## Troubleshooting

### Apps not connecting

1. **Check window.postMessage**: Ensure iframes can post messages to parent
2. **Check origin**: WCP uses `*` origin by default but can be restricted
3. **Check console**: Look for WCP handshake errors

### Messages not routing

1. **Check instanceId**: DACP messages must include `meta.destination.instanceId`
2. **Check transport connection**: Use `wcpConnector.getConnections()` to verify
3. **Enable debug logging**: Add console.log in message handlers

### Tree-shaking not working

1. **Check import path**: Must use `/browser` submodule, not root
2. **Check bundler**: Requires modern bundler (Vite, webpack 5, esbuild)
3. **Check sideEffects**: Package has `"sideEffects": false`

## Next Steps

- See [ARCHITECTURE.md](../../docs/SYSTEM_ARCHITECTURE.md) for overall system design
- See [WCP Spec](https://fdc3.finos.org/docs/api/specs/webConnectionProtocol) for protocol details
- See [DACP Spec](https://fdc3.finos.org/docs/api/specs/desktopAgentCommunicationProtocol) for message format
