# ConnectionManager

The `ConnectionManager` is a browser-specific component that combines WCP (Web Connection Protocol) Gateway and Browser Proxy functionality into a single, cohesive class. It handles the complete lifecycle of app connections in browser-based Desktop Agent deployments.

## Purpose

ConnectionManager serves two critical functions:

1. **WCP Gateway**: Handles WCP handshake (WCP1-3) to establish connections with FDC3 apps running in iframes/windows
2. **Browser Proxy**: Routes DACP messages between the Desktop Agent and connected apps via MessagePorts

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Window                           │
│                                                                   │
│  ┌──────────────┐         ┌──────────────────────────┐          │
│  │ FDC3 App     │         │  ConnectionManager        │          │
│  │ (iframe)     │         │                           │          │
│  │              │  WCP1   │  - WCP Handshake (1-3)   │          │
│  │              ├────────►│  - MessagePort Registry   │          │
│  │              │  WCP3   │  - Message Routing        │          │
│  │              │◄────────┤                           │          │
│  │              │ +port1  │                           │          │
│  └──────┬───────┘         └───────────┬──────────────┘          │
│         │                             │                          │
│         │ DACP via                    │ DACP via                 │
│         │ MessagePort                 │ Transport                │
│         │                             │                          │
│         │                 ┌───────────▼──────────────┐          │
│         └────────────────►│  Desktop Agent           │          │
│                           │  (DACP Protocol)         │          │
│                           └──────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Message Flow

### 1. Initial Connection (WCP Handshake)

```
App (iframe)              ConnectionManager              Desktop Agent
     │                           │                              │
     │  WCP1Hello                │                              │
     ├──────────────────────────►│                              │
     │  (postMessage)            │                              │
     │                           │                              │
     │                           │  Create MessageChannel       │
     │                           │  Generate instanceId         │
     │                           │                              │
     │  WCP3Handshake + port1    │                              │
     │◄──────────────────────────┤                              │
     │  (postMessage transfer)   │                              │
     │                           │                              │
     │                           │  WCP4ValidateAppIdentity     │
     │                           ├─────────────────────────────►│
     │                           │                              │
     │                           │  WCP5ValidateAppIdentityResponse
     │                           │◄─────────────────────────────┤
     │                           │                              │
     │                           │  Register port2 in portMap   │
     │                           │                              │
```

### 2. Runtime Message Routing

```
App to Desktop Agent:
App → MessagePort.postMessage → ConnectionManager.registerPort.onmessage → Transport.send → Desktop Agent

Desktop Agent to App:
Desktop Agent → Transport.onMessage → ConnectionManager.routeToApp → MessagePort.postMessage → App
```

### 3. Disconnect Handling

```
App (iframe)              ConnectionManager              Desktop Agent
     │                           │                              │
     │                           │  DACP heartbeat timeout      │
     │                           │◄─────────────────────────────┤
     │                           │                              │
     │                           │  disconnectRequest           │
     │                           ├─────────────────────────────►│
     │                           │                              │
     │                           │  Clean up registries         │
     │                           │  (AppInstanceRegistry, etc.) │
     │                           │                              │
     │  Remove from portMap      │                              │
     │◄──────────────────────────┤                              │
     │                           │                              │
```

## Usage

### Basic Setup

```typescript
import { ConnectionManager } from "@finos/fdc3-sail-api"
import { DesktopAgent } from "@finos/fdc3-sail-desktop-agent"
import { MessagePortTransport } from "@finos/fdc3-sail-api/transports"

// Create transport (e.g., MessagePort to worker, Socket.IO, or in-memory)
const transport = new MessagePortTransport(workerPort)

// Create Desktop Agent
const desktopAgent = new DesktopAgent(transport)

// Create ConnectionManager
const connectionManager = new ConnectionManager(transport)

// ConnectionManager automatically:
// - Listens for WCP1Hello messages
// - Handles WCP handshake (1-3)
// - Routes messages between apps and Desktop Agent
```

### Factory Function (Recommended)

For convenience, use the provided factory function:

```typescript
import { createBrowserDesktopAgent } from "@finos/fdc3-sail-api"

// Creates and wires together:
// - Desktop Agent
// - ConnectionManager
// - Appropriate transport
const { desktopAgent, connectionManager } = createBrowserDesktopAgent({
  mode: "browser", // or "server" for Socket.IO
  serverUrl: "http://localhost:8080", // only for server mode
})
```

### Manual App Registration (Advanced)

If you need fine-grained control over app connections:

```typescript
// Listen for iframe load
iframe.addEventListener("load", () => {
  // ConnectionManager automatically handles WCP messages
  // No manual registration needed unless you want hooks
})

// Optional: Listen for connection events
connectionManager.on("appConnected", (instanceId: string) => {
  console.log(`App ${instanceId} connected`)
})

connectionManager.on("appDisconnected", (instanceId: string) => {
  console.log(`App ${instanceId} disconnected`)
})
```

## Implementation Details

### Port Registry

ConnectionManager maintains a map of `instanceId → MessagePort`:

```typescript
private portMap = new Map<string, MessagePort>()

private registerPort(instanceId: string, port: MessagePort) {
  this.portMap.set(instanceId, port)

  // FROM app TO Desktop Agent
  port.onmessage = (event) => {
    const message = event.data as DACPMessage

    // Ensure source is set
    if (!message.meta.source) {
      message.meta.source = { instanceId }
    }

    this.sendToDesktopAgent(message)
  }

  port.start()
}
```

### WCP Handshake Handling

```typescript
private handleWCP1Hello(event: MessageEvent) {
  // Validate message
  if (!isWebConnectionProtocol1Hello(event.data)) return
  if (!event.source) return

  const wcp1 = event.data as BrowserTypes.WebConnectionProtocol1Hello

  // Create MessageChannel
  const channel = new MessageChannel()
  const instanceId = crypto.randomUUID()

  // Send WCP3Handshake with port1
  const wcp3: BrowserTypes.WebConnectionProtocol3Handshake = {
    type: "WCP3Handshake",
    meta: {
      connectionAttemptUuid: wcp1.meta.connectionAttemptUuid,
      timestamp: new Date(),
    },
    payload: {
      fdc3Version: "2.2",
      intentResolverUrl: this.getIntentResolverUrl?.(instanceId),
      channelSelectorUrl: this.getChannelSelectorUrl?.(instanceId),
    },
  }

  event.source.postMessage(wcp3, "*", [channel.port1])

  // Register port2 for routing
  this.registerPort(instanceId, channel.port2)

  // Send WCP4 to Desktop Agent for validation
  this.sendWCP4Validation(wcp1, instanceId)
}
```

### Message Routing

```typescript
private routeToApp(message: DACPMessage) {
  const targetInstanceId = message.meta.destination?.instanceId

  if (!targetInstanceId) {
    console.warn("Message has no destination, cannot route")
    return
  }

  const port = this.portMap.get(targetInstanceId)

  if (!port) {
    console.warn(`No port registered for instance ${targetInstanceId}`)
    return
  }

  port.postMessage(message)
}

private sendToDesktopAgent(message: DACPMessage) {
  this.transport.send(message)

  // Handle disconnect cleanup
  if (message.type === "disconnectRequest") {
    const instanceId = message.meta.source.instanceId
    this.portMap.delete(instanceId)
    this.emit("appDisconnected", instanceId)
  }
}
```

## Disconnect and Reconnection

### DACP Heartbeat

ConnectionManager relies on DACP's built-in heartbeat mechanism for disconnect detection. The Desktop Agent tracks heartbeat timeouts and sends disconnect notifications.

**Important**: ConnectionManager does NOT implement its own disconnect detection. It responds to:
- `disconnectRequest` from apps
- Desktop Agent heartbeat timeout notifications

### Reconnection Flow

When an app disconnects and reconnects:

1. Full WCP handshake is required (WCP1-3)
2. New `MessageChannel` is created
3. New `instanceId` is generated
4. Previous instance is cleaned up by Desktop Agent via heartbeat timeout

```typescript
// App disconnects (heartbeat timeout)
// Desktop Agent cleans up AppInstanceRegistry entry

// App reconnects (e.g., page refresh)
// ConnectionManager receives NEW WCP1Hello
// Generates NEW instanceId
// Creates NEW MessageChannel
// App is treated as new instance
```

## Server Mode vs Browser Mode

### Browser Mode

Desktop Agent runs in the same browser window as ConnectionManager:

```typescript
// Both in same window
const transport = new InMemoryTransport()
const desktopAgent = new DesktopAgent(transport)
const connectionManager = new ConnectionManager(transport)
```

### Server Mode

Desktop Agent runs on server (Socket.IO), ConnectionManager in browser:

```typescript
// Browser
const socket = io("http://localhost:8080")
const transport = new SocketIOTransport(socket)
const connectionManager = new ConnectionManager(transport)

// Server
const desktopAgent = new DesktopAgent(serverTransport)
```

**Key Difference**: In server mode, ConnectionManager routes messages:
- From iframe MessagePort → Socket.IO → Server
- From Server → Socket.IO → MessagePort

The routing is transparent to both the app and Desktop Agent.

## Error Handling

### Invalid WCP Messages

```typescript
private handleWCP1Hello(event: MessageEvent) {
  if (!isWebConnectionProtocol1Hello(event.data)) {
    console.warn("Received invalid WCP1Hello", event.data)
    return
  }

  // Continue handshake...
}
```

### Missing Destination

```typescript
private routeToApp(message: DACPMessage) {
  const targetInstanceId = message.meta.destination?.instanceId

  if (!targetInstanceId) {
    console.error("Cannot route message without destination", message)
    return
  }

  // Continue routing...
}
```

### Port Not Found

```typescript
private routeToApp(message: DACPMessage) {
  const port = this.portMap.get(targetInstanceId)

  if (!port) {
    console.error(`Port not found for instance ${targetInstanceId}`)
    // Desktop Agent will handle timeout/retry
    return
  }

  port.postMessage(message)
}
```

## Testing

### Unit Tests

```typescript
import { ConnectionManager } from "@finos/fdc3-sail-api"
import { MockTransport } from "@finos/fdc3-sail-api/testing"

describe("ConnectionManager", () => {
  it("should handle WCP1Hello and create MessageChannel", () => {
    const transport = new MockTransport()
    const connectionManager = new ConnectionManager(transport)

    const wcp1: BrowserTypes.WebConnectionProtocol1Hello = {
      type: "WCP1Hello",
      meta: {
        connectionAttemptUuid: "test-uuid",
        timestamp: new Date(),
      },
      payload: {
        fdc3Version: "2.2",
      },
    }

    // Simulate app sending WCP1Hello
    window.postMessage(wcp1, "*")

    // Expect WCP4 sent to Desktop Agent
    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0].type).toBe("WCP4ValidateAppIdentity")
  })

  it("should route messages from Desktop Agent to app", () => {
    const transport = new MockTransport()
    const connectionManager = new ConnectionManager(transport)

    // Simulate app connection
    const instanceId = "test-instance"
    const port = new MessageChannel().port1
    connectionManager.registerPort(instanceId, port)

    // Simulate Desktop Agent sending message
    const message: DACPMessage = {
      type: "broadcastEvent",
      meta: {
        destination: { instanceId },
      },
      payload: {
        context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
      },
    }

    transport.simulateReceive(message)

    // Expect message posted to port
    // (would need MessagePort mock to verify)
  })
})
```

## API Reference

### Constructor

```typescript
constructor(transport: Transport, options?: ConnectionManagerOptions)
```

**Parameters:**
- `transport`: Transport instance for communicating with Desktop Agent
- `options` (optional):
  - `getIntentResolverUrl?: (instanceId: string) => string | undefined`
  - `getChannelSelectorUrl?: (instanceId: string) => string | undefined`

### Methods

#### `registerPort(instanceId: string, port: MessagePort): void`

Manually register a MessagePort for an app instance. Typically called internally during WCP handshake.

#### `unregisterPort(instanceId: string): void`

Remove a MessagePort from the registry. Called automatically on disconnect.

### Events

ConnectionManager extends EventEmitter:

#### `appConnected`

Emitted when an app completes WCP handshake.

```typescript
connectionManager.on("appConnected", (instanceId: string) => {
  console.log(`App ${instanceId} connected`)
})
```

#### `appDisconnected`

Emitted when an app disconnects.

```typescript
connectionManager.on("appDisconnected", (instanceId: string) => {
  console.log(`App ${instanceId} disconnected`)
})
```

## Related Documentation

- [WCP Integration](../desktop-agent/WCP_INTEGRATION.md) - Desktop Agent WCP handlers
- [Transport Interface](./TRANSPORT.md) - Transport abstraction
- [DACP Compliance](../desktop-agent/src/handlers/dacp/DACP-COMPLIANCE.md) - DACP implementation status

## Package Location

ConnectionManager lives in `packages/sail-api` because it:
- Depends on browser APIs (MessageChannel, MessagePort, postMessage)
- Is specific to browser-based Desktop Agent deployments
- Combines browser-side WCP handling with message routing

The Desktop Agent (`packages/desktop-agent`) remains environment-agnostic and only handles DACP protocol logic.