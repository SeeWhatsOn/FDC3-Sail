# Transport Interface

The Transport interface is a core abstraction in FDC3-Sail that enables the Desktop Agent to be environment-agnostic. It represents "WHERE is the Desktop Agent" - providing a single pipe for bidirectional DACP message flow.

## Key Concept

**Transport = ONE pipe to Desktop Agent location, NOT per-app connections**

```
┌─────────────────────────────────────────────────────────────┐
│  Environment (Browser, Server, Worker, Native)               │
│                                                               │
│  ┌────────┐  ┌────────┐  ┌────────┐                        │
│  │ App 1  │  │ App 2  │  │ App 3  │                        │
│  └───┬────┘  └───┬────┘  └───┬────┘                        │
│      │           │           │                               │
│      │ DACP      │ DACP      │ DACP                         │
│      │ (with     │ (with     │ (with                        │
│      │ meta)     │ meta)     │ meta)                        │
│      │           │           │                               │
│      └───────────┴───────────┘                               │
│                  │                                            │
│         ┌────────▼─────────┐                                │
│         │ ONE Transport    │  ◄─── "Where is Desktop Agent?" │
│         │  (Socket.IO,     │                                │
│         │   MessagePort,   │                                │
│         │   IPC, etc.)     │                                │
│         └────────┬─────────┘                                │
│                  │                                            │
│         ┌────────▼─────────┐                                │
│         │ Desktop Agent    │                                │
│         │  (DACP Protocol) │                                │
│         └──────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

Routing to specific apps happens via `instanceId` in DACP message metadata:
- `message.meta.source.instanceId` - sender
- `message.meta.destination.instanceId` - recipient

## Interface Definition

```typescript
export interface Transport {
  /**
   * Send a DACP message through the transport.
   * Message MUST contain routing metadata (source/destination instanceId)
   */
  send(message: unknown): void

  /**
   * Register handler for incoming DACP messages from ANY app
   */
  onMessage(handler: MessageHandler): void

  /**
   * Register handler for transport-level disconnect (entire pipe closes)
   * Individual app disconnects use DACP heartbeat
   */
  onDisconnect(handler: DisconnectHandler): void

  /**
   * Check if transport connection is active
   */
  isConnected(): boolean

  /**
   * Close transport and disconnect ALL apps
   */
  disconnect(): void
}
```

## Transport Implementations

### 1. Socket.IO Transport (Server-based Desktop Agent)

Desktop Agent runs on server, apps in browser:

```typescript
// packages/sail-api/src/transports/socket-io-transport.ts
import { Socket } from "socket.io-client"
import type { Transport, MessageHandler, DisconnectHandler } from "@finos/fdc3-sail-desktop-agent"

export class SocketIOTransport implements Transport {
  private socket: Socket
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler

  constructor(socket: Socket) {
    this.socket = socket

    // Listen for messages FROM Desktop Agent
    this.socket.on("fdc3_message", (message: unknown) => {
      this.messageHandler?.(message)
    })

    // Listen for disconnect
    this.socket.on("disconnect", () => {
      this.disconnectHandler?.()
    })
  }

  send(message: unknown): void {
    this.socket.emit("fdc3_message", message)
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  isConnected(): boolean {
    return this.socket.connected
  }

  disconnect(): void {
    this.socket.disconnect()
  }
}
```

**Usage:**

```typescript
// Server
import { Server } from "socket.io"
import { DesktopAgent } from "@finos/fdc3-sail-desktop-agent"

const io = new Server(8080)

io.on("connection", (socket) => {
  // Create transport that wraps this socket
  const transport = new SocketIOServerTransport(socket)

  // Desktop Agent uses this transport for all apps on this connection
  const desktopAgent = new DesktopAgent(transport)
})
```

### 2. MessagePort Transport (Worker/Browser-based Desktop Agent)

Desktop Agent runs in worker or same window:

```typescript
// packages/sail-api/src/transports/message-port-transport.ts
import type { Transport, MessageHandler, DisconnectHandler } from "@finos/fdc3-sail-desktop-agent"

export class MessagePortTransport implements Transport {
  private port: MessagePort
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler
  private connected: boolean = true

  constructor(port: MessagePort) {
    this.port = port

    this.port.onmessage = (event) => {
      this.messageHandler?.(event.data)
    }

    this.port.onmessageerror = () => {
      this.connected = false
      this.disconnectHandler?.()
    }

    this.port.start()
  }

  send(message: unknown): void {
    if (!this.connected) {
      throw new Error("MessagePort transport is not connected")
    }
    this.port.postMessage(message)
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect(): void {
    this.connected = false
    this.port.close()
  }
}
```

**Usage:**

```typescript
// Main thread
const channel = new MessageChannel()

// Send port1 to worker
worker.postMessage({ type: "init", port: channel.port1 }, [channel.port1])

// Create transport with port2
const transport = new MessagePortTransport(channel.port2)
const desktopAgent = new DesktopAgent(transport)

// Worker
self.onmessage = (event) => {
  if (event.data.type === "init") {
    const transport = new MessagePortTransport(event.data.port)
    const desktopAgent = new DesktopAgent(transport)
  }
}
```

### 3. In-Memory Transport (Same-process Desktop Agent)

Desktop Agent and apps in same JavaScript process (testing/simple deployments):

```typescript
// packages/desktop-agent/src/transports/in-memory-transport.ts
import type { Transport, MessageHandler, DisconnectHandler } from "../interfaces/transport"

export class InMemoryTransport implements Transport {
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler
  private connected: boolean = true

  // Optional: Link to another in-memory transport for bidirectional
  private peer?: InMemoryTransport

  send(message: unknown): void {
    if (!this.connected) {
      throw new Error("In-memory transport is disconnected")
    }

    if (this.peer) {
      // Deliver to peer synchronously
      this.peer.messageHandler?.(message)
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect(): void {
    this.connected = false
    this.disconnectHandler?.()
    if (this.peer) {
      this.peer.connected = false
      this.peer.disconnectHandler?.()
    }
  }

  setPeer(peer: InMemoryTransport): void {
    this.peer = peer
  }
}

// Helper to create linked pair
export function createInMemoryTransportPair(): [InMemoryTransport, InMemoryTransport] {
  const t1 = new InMemoryTransport()
  const t2 = new InMemoryTransport()
  t1.setPeer(t2)
  t2.setPeer(t1)
  return [t1, t2]
}
```

**Usage:**

```typescript
// Testing or simple browser-only deployment
const [daTransport, appTransport] = createInMemoryTransportPair()

const desktopAgent = new DesktopAgent(daTransport)
const connectionManager = new ConnectionManager(appTransport)
```

## Message Routing

### Desktop Agent → App

Desktop Agent sends message with destination:

```typescript
// In Desktop Agent handler
const message: BroadcastEvent = {
  type: "broadcastEvent",
  meta: {
    destination: { instanceId: "target-app-instance" },
    timestamp: new Date(),
  },
  payload: {
    context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
  },
}

// Send via transport
transport.send(message)

// Transport delivers to...
// - Socket.IO: Server routes to browser, ConnectionManager routes to MessagePort
// - MessagePort: Worker receives, ConnectionManager routes to MessagePort
// - In-memory: Direct to peer
```

### App → Desktop Agent

App sends message with source:

```typescript
// In app (via @finos/fdc3 web client)
const message: BroadcastRequest = {
  type: "broadcastRequest",
  meta: {
    requestUuid: "uuid-v4",
    timestamp: new Date(),
    source: { instanceId: "my-app-instance" },
  },
  payload: {
    context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
    channelId: "fdc3.channel.1",
  },
}

// App posts to MessagePort
appPort.postMessage(message)

// ConnectionManager receives via port.onmessage
// ConnectionManager sends via transport.send(message)
// Desktop Agent receives via transport.onMessage()
```

## Deployment Modes

### Mode 1: Server-based Desktop Agent

```
Browser Window                     Server
┌─────────────────────┐           ┌──────────────────┐
│ App 1 (iframe)      │           │                  │
│   ↓ MessagePort     │           │                  │
│ ConnectionManager   │           │                  │
│   ↓ Socket.IO       ├───────────► SocketIOTransport│
│                     │  WebSocket │   ↓              │
│ App 2 (iframe)      │           │ Desktop Agent    │
│   ↓ MessagePort     │           │                  │
│ ConnectionManager   │           │                  │
└─────────────────────┘           └──────────────────┘
```

**Characteristics:**
- Desktop Agent state persists on server
- Multiple browser windows can connect
- Apps communicate via server
- Requires WebSocket connection

### Mode 2: Browser-based Desktop Agent

```
Browser Window
┌────────────────────────────────────────┐
│ App 1 (iframe)                         │
│   ↓ MessagePort                        │
│ ConnectionManager                      │
│   ↓ InMemoryTransport                 │
│ Desktop Agent                          │
│   ↑ InMemoryTransport                 │
│ ConnectionManager                      │
│   ↑ MessagePort                        │
│ App 2 (iframe)                         │
└────────────────────────────────────────┘
```

**Characteristics:**
- Desktop Agent runs in browser window
- No server required
- Apps communicate within browser
- State is per-window

### Mode 3: Worker-based Desktop Agent

```
Browser Window                     Web Worker
┌─────────────────────┐           ┌──────────────────┐
│ App 1 (iframe)      │           │                  │
│   ↓ MessagePort     │           │                  │
│ ConnectionManager   │           │                  │
│   ↓ MessagePort     ├───────────► MessagePortTransport
│                     │  transfer  │   ↓              │
│ App 2 (iframe)      │           │ Desktop Agent    │
│   ↓ MessagePort     │           │                  │
│ ConnectionManager   │           │                  │
└─────────────────────┘           └──────────────────┘
```

**Characteristics:**
- Desktop Agent runs in separate thread
- Isolated from main UI
- Apps communicate via worker
- State is per-window

## Connection Lifecycle

### 1. Desktop Agent Initialization

```typescript
// Create transport based on deployment mode
const transport = createTransport(mode)

// Initialize Desktop Agent with transport
const desktopAgent = new DesktopAgent(transport)

// Desktop Agent registers message handler
transport.onMessage((message: unknown) => {
  // Route to DACP handler
  desktopAgent.handleMessage(message)
})

// Desktop Agent registers disconnect handler
transport.onDisconnect(() => {
  // Clean up all app instances
  desktopAgent.disconnectAll()
})
```

### 2. App Connection (via WCP)

```typescript
// App sends WCP1Hello via postMessage
// ConnectionManager handles WCP handshake (WCP1-3)
// ConnectionManager sends WCP4 to Desktop Agent via transport

transport.send({
  type: "WCP4ValidateAppIdentity",
  meta: {
    requestUuid: "uuid-v4",
    timestamp: new Date(),
    source: { instanceId: "new-app-instance" },
  },
  payload: {
    instanceId: "new-app-instance",
    identityUrl: "https://example.com/app",
    actualUrl: "https://example.com/app",
  },
})

// Desktop Agent validates and registers app
// Sends WCP5 response back via transport
```

### 3. Runtime Communication

```typescript
// App broadcasts context
transport.send({
  type: "broadcastRequest",
  meta: {
    requestUuid: "uuid-v4",
    source: { instanceId: "app-1" },
  },
  payload: { context: {...}, channelId: "fdc3.channel.1" },
})

// Desktop Agent processes and broadcasts to listeners
// Sends broadcastEvent to each listener via transport
transport.send({
  type: "broadcastEvent",
  meta: {
    destination: { instanceId: "app-2" },
  },
  payload: { context: {...} },
})
```

### 4. Disconnect

```typescript
// DACP heartbeat timeout (handled by Desktop Agent)
// Desktop Agent cleans up app instance
appInstanceRegistry.unregister(instanceId)

// ConnectionManager removes MessagePort
portMap.delete(instanceId)

// OR transport-level disconnect (entire pipe closes)
transport.disconnect()
// Desktop Agent cleans up ALL app instances
```

## Error Handling

### Send Errors

```typescript
send(message: unknown): void {
  if (!this.isConnected()) {
    throw new Error("Transport is not connected")
  }

  try {
    this.socket.emit("fdc3_message", message)
  } catch (error) {
    console.error("Failed to send message:", error)
    // Desktop Agent will handle timeout/retry via DACP
    throw error
  }
}
```

### Receive Errors

```typescript
onMessage(handler: MessageHandler): void {
  this.messageHandler = async (message: unknown) => {
    try {
      await handler(message)
    } catch (error) {
      console.error("Error handling message:", error)
      // Desktop Agent logs error, may send error response via DACP
    }
  }
}
```

### Connection Errors

```typescript
constructor(socket: Socket) {
  this.socket = socket

  this.socket.on("error", (error) => {
    console.error("Transport error:", error)
    // Trigger disconnect handler
    this.disconnectHandler?.()
  })

  this.socket.on("disconnect", () => {
    this.disconnectHandler?.()
  })
}
```

## Testing

### Mock Transport

```typescript
// packages/desktop-agent/src/__tests__/utils/mock-transport.ts
export class MockTransport implements Transport {
  public sent: unknown[] = []
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler
  private connected = true

  send(message: unknown): void {
    this.sent.push(message)
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect(): void {
    this.connected = false
    this.disconnectHandler?.()
  }

  // Test helpers
  simulateReceive(message: unknown): void {
    this.messageHandler?.(message)
  }

  simulateDisconnect(): void {
    this.connected = false
    this.disconnectHandler?.()
  }

  clearSent(): void {
    this.sent = []
  }
}
```

### Example Test

```typescript
import { DesktopAgent } from "../desktop-agent"
import { MockTransport } from "./__tests__/utils/mock-transport"

describe("Desktop Agent", () => {
  it("should send response via transport", async () => {
    const transport = new MockTransport()
    const desktopAgent = new DesktopAgent(transport)

    // Simulate app sending message
    transport.simulateReceive({
      type: "getInfoRequest",
      meta: {
        requestUuid: "test-uuid",
        source: { instanceId: "test-app" },
      },
    })

    // Verify response sent via transport
    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0].type).toBe("getInfoResponse")
  })
})
```

## Best Practices

### 1. Transport per Desktop Agent, not per app

```typescript
// ✅ CORRECT - One transport for Desktop Agent
const transport = new SocketIOTransport(socket)
const desktopAgent = new DesktopAgent(transport)

// ❌ WRONG - Don't create transport per app
for (const app of apps) {
  const transport = new SocketIOTransport(socket) // NO!
  desktopAgent.registerApp(app, transport) // NO!
}
```

### 2. Routing in DACP messages, not transport

```typescript
// ✅ CORRECT - instanceId in message metadata
transport.send({
  type: "broadcastEvent",
  meta: {
    destination: { instanceId: "target-app" },
  },
  payload: { context: {...} },
})

// ❌ WRONG - Don't pass instanceId to transport
transport.send("target-app", message) // NO! (old design)
```

### 3. Use ConnectionManager for browser deployments

```typescript
// ✅ CORRECT - ConnectionManager handles browser-side routing
const transport = new MessagePortTransport(workerPort)
const desktopAgent = new DesktopAgent(transport)
const connectionManager = new ConnectionManager(transport)

// ❌ WRONG - Don't manage MessagePorts manually in app code
// This is ConnectionManager's job!
```

### 4. DACP heartbeat for disconnect detection

```typescript
// ✅ CORRECT - Rely on DACP heartbeat
// Desktop Agent tracks heartbeat timeouts
// Cleans up via AppInstanceRegistry

// ❌ WRONG - Don't implement custom disconnect detection
// (e.g., MutationObserver for iframes)
```

## Related Documentation

- [ConnectionManager](../sail-api/CONNECTION_MANAGER.md) - Browser-side message routing
- [WCP Integration](./WCP_INTEGRATION.md) - Web Connection Protocol
- [DACP Compliance](./src/handlers/dacp/DACP-COMPLIANCE.md) - Protocol implementation status

## Summary

The Transport interface is the foundation of FDC3-Sail's environment-agnostic architecture:

- **One transport = WHERE is Desktop Agent** (server, browser, worker)
- **Message routing via DACP metadata** (source/destination instanceId)
- **Environment-specific implementations** (Socket.IO, MessagePort, IPC)
- **ConnectionManager bridges WCP handshake and transport** (browser only)
- **DACP heartbeat handles disconnect detection** (not transport-level)

This design keeps the Desktop Agent pure DACP with no environment dependencies, while allowing flexible deployment across browser, server, and native environments.