# Transport Architecture Planning

**Status**: Draft - Architecture discussion in progress
**Date**: 2025-11-12
**Purpose**: Design the transport layer and registry architecture for multi-app Desktop Agent support

## Current Understanding

### Agreed Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  sail-api Package (Composable Desktop Agent Wrapper)        │
│  ┌─────────────────┬──────────────────┬──────────────────┐  │
│  │ Browser Mode    │ Server Mode      │ Worker Mode      │  │
│  │ (WCP listener)  │ (Socket.IO)      │ (SharedWorker)   │  │
│  │ postMessage     │ socket events    │ worker messages  │  │
│  └─────────────────┴──────────────────┴──────────────────┘  │
│                                                               │
│  All modes implement the Transport interface                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  Delegates to single instance
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  desktop-agent Package (Pure FDC3 Engine)                    │
│  - ONE Desktop Agent instance (not one per connection)       │
│  - Transport-agnostic DACP message processing                │
│  - Shared state registries (App, Intent, Channel)            │
│  - No window/DOM/Node.js dependencies                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **All logic lives in `desktop-agent` or `sail-api`** - nowhere else
2. **sail-api is the composition layer** - wraps desktop-agent for different environments
3. **ONE Desktop Agent instance** - not one per connection
4. **Shared registries** - all apps share the same state

## The Transport Question

### Current Transport Interface (Single App)

```typescript
interface Transport {
  send(instanceId: string, message: unknown): void
  onMessage(handler: MessageHandler): void
  onDisconnect(handler: DisconnectHandler): void
  getInstanceId(): string
  setInstanceId(instanceId: string): void
  isConnected(): boolean
  disconnect(): void
}
```

**Problems:**
- Assumes one transport = one app connection
- `send(instanceId, message)` parameter is ignored in current implementations
- Desktop Agent has only ONE transport, but needs to send to MULTIPLE apps

### Question: Transport vs Transport Registry

You asked: **"How is transport registry any different from transport?"**

Great question! Let's explore the options:

#### Option A: Keep Transport Interface, Track Transports in Registry

**Current transport interface stays the same**, but we add a registry to track multiple transports:

```typescript
// AppInstanceRegistry tracks transport per instance
class AppInstanceRegistry {
  private instances = new Map<string, AppInstance>()

  registerInstance(instanceId: string, metadata: AppMetadata, transport: Transport) {
    this.instances.set(instanceId, {
      instanceId,
      metadata,
      transport,  // ← Store transport with instance
      currentChannelId: null,
      listeners: []
    })
  }

  getInstance(instanceId: string): AppInstance | undefined {
    return this.instances.get(instanceId)
  }

  // Helper to send message to specific instance
  sendToInstance(instanceId: string, message: unknown): void {
    const instance = this.getInstance(instanceId)
    if (instance?.transport) {
      instance.transport.send(instanceId, message)  // ← Use instance's transport
    }
  }
}
```

**How it works:**
- Each app connection creates its own `Transport` instance
- `AppInstanceRegistry` stores the transport reference with each instance
- When broadcasting, Desktop Agent looks up target instance and uses its transport
- Transport's `send()` method sends to **its own connected app** (ignores instanceId param)

#### Option B: Multi-App Transport Interface

**Change the transport interface** to handle multiple apps:

```typescript
interface Transport {
  // Send to a specific app instance
  send(instanceId: string, message: unknown): void

  // Register handler for incoming messages (includes source instanceId)
  onMessage(handler: (instanceId: string, message: unknown) => void): void

  // Register handler for app disconnect
  onDisconnect(handler: (instanceId: string) => void): void

  // Register a new app connection with this transport
  registerInstance(instanceId: string): void

  // Unregister an app connection
  unregisterInstance(instanceId: string): void
}
```

**How it works:**
- ONE transport instance for the entire Desktop Agent
- Transport internally tracks multiple connections (e.g., Map<instanceId, Socket>)
- `send(instanceId, message)` routes to the correct connection
- Desktop Agent doesn't need to track transport per instance

#### Option C: Hybrid - Transport + Router

**Keep simple Transport interface**, add routing layer:

```typescript
// Simple 1:1 transport (unchanged)
interface Transport {
  send(message: unknown): void  // ← No instanceId param
  onMessage(handler: MessageHandler): void
  onDisconnect(handler: DisconnectHandler): void
  getInstanceId(): string
  setInstanceId(instanceId: string): void
  isConnected(): boolean
  disconnect(): void
}

// New router that manages multiple transports
interface TransportRouter {
  registerTransport(instanceId: string, transport: Transport): void
  unregisterTransport(instanceId: string): void
  send(instanceId: string, message: unknown): void
  broadcast(instanceIds: string[], message: unknown): void
}

// Desktop Agent uses router instead of single transport
class DesktopAgent {
  constructor(config: {
    transportRouter: TransportRouter,
    // ... registries
  })
}
```

**How it works:**
- Transport remains simple (1:1 app connection)
- TransportRouter manages the collection of transports
- Desktop Agent delegates all sending through the router
- Clean separation of concerns

## Recommended Approach

### I recommend **Option A: Keep Transport, Track in Registry**

**Why?**

1. **Minimal changes** - Transport interface stays mostly the same
2. **Natural fit** - AppInstanceRegistry already tracks instance state, transport is part of that state
3. **Flexibility** - Different instances can use different transport types (Socket.IO, MessagePort, Worker)
4. **Simplicity** - No new abstraction layer needed

**What changes:**

1. Remove unused `instanceId` parameter from `Transport.send()`:
   ```typescript
   interface Transport {
     send(message: unknown): void  // ← Simplified
     // ... rest unchanged
   }
   ```

2. Store transport in `AppInstanceRegistry`:
   ```typescript
   interface AppInstance {
     instanceId: string
     appId: string
     metadata: AppMetadata
     transport: Transport  // ← Added
     currentChannelId: string | null
     listeners: ContextListener[]
     // ...
   }
   ```

3. Handlers look up transport from registry:
   ```typescript
   async function handleBroadcast(message, context) {
     const { appInstanceRegistry } = context

     const listeners = appInstanceRegistry.getContextListeners(channelId, contextType)

     for (const listener of listeners) {
       const instance = appInstanceRegistry.getInstance(listener.instanceId)
       if (instance?.transport?.isConnected()) {
         await instance.transport.send(contextEvent)  // ← Use instance's transport
       }
     }
   }
   ```

## Desktop Agent Initialization

### Current (One per connection - WRONG)

```typescript
// sail-server/src/main.ts
io.on("connection", socket => {
  const agent = new SailDesktopAgent({ socket })  // ❌ Creates isolated agent
  agent.start()
})
```

### Proposed (One shared instance - CORRECT)

```typescript
// sail-api exports a composable wrapper
import { createDesktopAgent } from "@finos/fdc3-sail-api"

// Create ONE shared Desktop Agent
const desktopAgent = createDesktopAgent({
  appDirectories: [trainingAppD, workbenchAppD],
  mode: "server"  // or "browser" or "worker"
})

// Start it once
desktopAgent.start()

// For each connection, register a new transport
io.on("connection", socket => {
  desktopAgent.registerConnection(socket)
})

io.on("disconnect", socket => {
  desktopAgent.unregisterConnection(socket)
})
```

**sail-api implementation:**

```typescript
// packages/sail-api/src/server-mode.ts
export function createDesktopAgent(config: {
  appDirectories: AppDirectory[]
  mode: "server" | "browser" | "worker"
}) {
  // Create shared registries
  const appInstanceRegistry = new AppInstanceRegistry()
  const intentRegistry = new IntentRegistry()
  const channelContextRegistry = new ChannelContextRegistry()
  // ... other registries

  // Load app directories
  const appDirectory = new AppDirectoryManager()
  config.appDirectories.forEach(dir => appDirectory.loadDirectory(dir))

  // Create Desktop Agent with shared state (no transport yet)
  const agent = new DesktopAgent({
    appInstanceRegistry,
    intentRegistry,
    channelContextRegistry,
    appDirectory,
    // ... other dependencies
  })

  return {
    start: () => agent.start(),
    stop: () => agent.stop(),

    // Register a new connection (creates Transport, registers with registry)
    registerConnection: (socket: Socket) => {
      const transport = new SocketIOTransport(socket)

      // Set up message handler for this transport
      transport.onMessage(async (message) => {
        await agent.handleMessage(message, transport)
      })

      // Set up disconnect handler
      transport.onDisconnect(() => {
        const instanceId = transport.getInstanceId()
        if (instanceId) {
          appInstanceRegistry.unregisterInstance(instanceId)
        }
      })
    },

    unregisterConnection: (socket: Socket) => {
      // Cleanup handled by onDisconnect
    }
  }
}
```

## Browser Mode vs Server Mode

### Browser Mode (sail-api in browser)

```typescript
// Browser window listens for WCP messages from iframes
import { createDesktopAgent } from "@finos/fdc3-sail-api/browser"

const desktopAgent = createDesktopAgent({
  appDirectories: [localAppD],
  mode: "browser"
})

desktopAgent.start()

// Listen for WCP1Hello from child iframes
window.addEventListener("message", (event) => {
  if (isWCP1Hello(event.data)) {
    const channel = new MessageChannel()

    // Register this iframe's connection
    desktopAgent.registerConnection({
      type: "messageport",
      port: channel.port2,
      source: event.source
    })

    // Send WCP3Handshake with port1
    event.source.postMessage(
      { type: "WCP3Handshake", /* ... */ },
      "*",
      [channel.port1]
    )
  }
})
```

### Server Mode (sail-api on Node.js)

```typescript
// Server creates Desktop Agent and registers socket connections
import { createDesktopAgent } from "@finos/fdc3-sail-api/server"

const desktopAgent = createDesktopAgent({
  appDirectories: [trainingAppD],
  mode: "server"
})

desktopAgent.start()

io.on("connection", socket => {
  desktopAgent.registerConnection({
    type: "socket",
    socket: socket
  })
})
```

**Key insight:** The Browser WCP handshake (WCP1-3) happens in `sail-api/browser`, then DACP messages are processed by the shared `desktop-agent`.

## Open Questions

### 1. Desktop Agent Constructor - What does it receive?

**Current design** has transport in constructor:
```typescript
class DesktopAgent {
  constructor(config: {
    transport: Transport,  // ← Single transport
    registries: {...}
  })
}
```

**New design** - no transport in constructor?
```typescript
class DesktopAgent {
  constructor(config: {
    // No transport here!
    appInstanceRegistry: AppInstanceRegistry,
    intentRegistry: IntentRegistry,
    // ... other registries
  })

  // Messages come in with transport reference
  async handleMessage(message: unknown, transport: Transport): Promise<void>
}
```

**Or** - keep transport but make it optional/internal?

### 2. How does Desktop Agent receive messages?

**Option A: Handler per transport (proposed above)**
```typescript
transport.onMessage(async (message) => {
  await agent.handleMessage(message, transport)
})
```

**Option B: Desktop Agent manages all transports**
```typescript
class DesktopAgent {
  private transports = new Map<string, Transport>()

  registerTransport(instanceId: string, transport: Transport) {
    this.transports.set(instanceId, transport)
    transport.onMessage(message => this.handleMessage(message, instanceId))
  }
}
```

### 3. Where does WCP4ValidateAppIdentity handler live?

Currently it's a DACP handler in `desktop-agent/src/handlers/dacp/wcp-handlers.ts`.

**But** WCP1-3 are handled by sail-api. Should WCP4-5 also move to sail-api?

**Or** keep WCP4-5 in desktop-agent because they're in the DACP spec?

### 4. How does sail-api wrap desktop-agent differently per mode?

Should sail-api export:
```typescript
// One unified API
export { createDesktopAgent } from "./index"

// Or mode-specific exports
export { createBrowserDesktopAgent } from "./browser"
export { createServerDesktopAgent } from "./server"
export { createWorkerDesktopAgent } from "./worker"
```

## DECISIONS MADE (2025-11-12)

### 1. WCP Gateway Package Placement
**Decision**: WCP Gateway lives in **sail-api package**

**Rationale**:
- Keeps desktop-agent pure (no browser dependencies)
- sail-api is the composition/environment layer
- WCP Gateway imports Transport interface from desktop-agent
- Clean separation: desktop-agent = pure FDC3, sail-api = environment glue

**Package structure**:
```
packages/sail-api/
├── src/
│   ├── gateway/
│   │   ├── wcp-gateway.ts              ← WCP1-3 handler
│   │   └── message-channel-manager.ts
│   ├── transports/
│   │   ├── message-port-transport.ts   ← Browser MessagePort
│   │   ├── socket-io-transport.ts      ← Server Socket.IO
│   │   └── worker-transport.ts         ← Future SharedWorker
│   └── factory.ts

packages/desktop-agent/
├── src/
│   ├── interfaces/
│   │   └── transport.ts                ← Interface ONLY
│   ├── desktop-agent.ts                ← Pure core, no transports
│   └── handlers/dacp/
│       └── wcp-handlers.ts             ← WCP4-5 DACP handlers
```

### 2. MessagePort State Management
**Decision**: MessagePorts are wrapped as **MessagePortTransport** and stored in **AppInstanceRegistry**

**How it works**:
1. WCP Gateway creates MessageChannel
2. Wraps port2 in MessagePortTransport (implements Transport interface)
3. Passes transport to DesktopAgent.registerConnection()
4. Desktop Agent stores transport in AppInstance
5. Desktop Agent uses instance.transport to send messages

**State flow**:
```
WCP Gateway (temporary state)
  └─ Pending connections: Map<connectionAttemptUuid, MessageChannel>
       ↓ After WCP4 validation
Desktop Agent Core (permanent state)
  └─ AppInstanceRegistry: Map<instanceId, AppInstance>
       └─ AppInstance.transport = MessagePortTransport
```

### 3. WCP Gateway vs Transport Relationship
**Decision**: They are **separate layers** with different responsibilities

**WCP Gateway** (Protocol handler):
- Listens for WCP1Hello from apps (window.addEventListener)
- Creates MessageChannels per app
- Sends WCP3Handshake with port1
- Creates Transport from port2
- Hands Transport to Desktop Agent
- ONE gateway handles MULTIPLE apps

**Transport** (Connection abstraction):
- ONE Transport per app connection
- Implements send/receive for that connection
- Can be MessagePort, Socket, Worker message, etc.
- Desktop Agent sees only the Transport interface

**Analogy**: Gateway = HTTP server (listens), Transport = socket connection (per client)

### 4. Desktop Agent Constructor Changes
**Decision**: Remove transport from constructor, add **registerConnection()** method

**New Desktop Agent API**:
```typescript
class DesktopAgent {
  constructor(config: {
    appInstanceRegistry: AppInstanceRegistry,
    intentRegistry: IntentRegistry,
    channelContextRegistry: ChannelContextRegistry,
    // ... other registries
    // NO transport parameter
  })

  // Called by WCP Gateway for each new app connection
  registerConnection(params: {
    transport: Transport,
    wcpPayload: WCP4ValidateAppIdentityPayload
  }): Promise<string>  // Returns instanceId

  // Called by transport when message received
  private handleMessage(message: unknown, sourceInstanceId: string): Promise<void>

  // Send to specific instance
  private sendToInstance(instanceId: string, message: unknown): Promise<void>
}
```

**Initialization flow**:
```typescript
// Create ONE Desktop Agent (in sail-api factory)
const agent = new DesktopAgent({ registries... })

// For each app that connects:
const transport = new MessagePortTransport(port)
const instanceId = await agent.registerConnection({ transport, wcpPayload })
```

### 5. Transport Interface Simplification
**Decision**: Remove unused instanceId parameter from send()

**Updated Transport interface**:
```typescript
interface Transport {
  send(message: unknown): void  // ← Removed instanceId param
  onMessage(handler: MessageHandler): void
  onDisconnect(handler: DisconnectHandler): void
  getInstanceId(): string
  setInstanceId(instanceId: string): void
  isConnected(): boolean
  disconnect(): void
}
```

**Rationale**: Each Transport is 1:1 with an app. No need to specify instanceId when sending.

### 6. WCP Handler Split
**Decision**: Split WCP handling across layers

**WCP1-3 (Protocol setup)**: In WCP Gateway (sail-api)
- Browser-specific (postMessage, MessageChannel)
- Not part of DACP spec
- Creates the connection

**WCP4-5 (Identity validation)**: In Desktop Agent (desktop-agent/handlers/dacp/wcp-handlers.ts)
- Part of DACP spec
- Pure business logic (validate against AppDirectory)
- Registers instance

### 7. Export Strategy
**desktop-agent package exports**:
- DesktopAgent class
- All registries
- Transport INTERFACE (types only)
- DACP handler utilities
- WCP4-5 handlers (pure validation logic)
- NO WCP Gateway (browser-specific), NO Transport implementations

**sail-api package exports**:
- WCPGateway (WCP1-3 browser protocol handler)
- All Transport implementations (MessagePortTransport, SocketIOTransport, etc.)
- createDesktopAgent() factory
- Re-exports from desktop-agent for convenience

### 8. WCP Package Placement
**Question**: Should WCP be in desktop-agent package but importable separately?

**Decision**: Keep WCP split across packages based on **runtime environment dependencies**

**Rationale**:
1. **WCP1-3 are browser-specific** and MUST stay in sail-api:
   - Uses `window.addEventListener("message")`
   - Creates `MessageChannel` instances
   - Uses `postMessage()` with transferable ports
   - Cannot run in Node.js environments

2. **WCP4-5 are pure protocol logic** and already live in desktop-agent:
   - Validates app identity against app directory
   - Returns validation responses
   - Can run anywhere (Node.js, browser, worker)
   - Already implemented as DACP handlers in `desktop-agent/handlers/dacp/wcp-handlers.ts`

3. **Package philosophy**:
   - `desktop-agent`: Pure FDC3 engine, environment-agnostic
   - `sail-api`: Environment adapters (browser, server, worker)

4. **Practical usage**:
   - Browser DA builders import WCPGateway from `@finos/fdc3-sail-api/gateway`
   - Desktop Agent core imports WCP4-5 handlers from `@finos/fdc3-sail-desktop-agent/handlers/dacp`
   - Clean separation with no circular dependencies

**Export structure**:
```typescript
// packages/desktop-agent/src/index.ts
export { DesktopAgent } from "./desktop-agent"
export { wcp4ValidateAppIdentityHandler } from "./handlers/dacp/wcp-handlers"
export type { Transport } from "./interfaces/transport"

// packages/sail-api/src/index.ts
export { WCPGateway } from "./gateway/wcp-gateway"
export { MessagePortTransport } from "./transports/message-port-transport"
export { SocketIOTransport } from "./transports/socket-io-transport"
```

## Next Steps

1. ✅ **Agree on Transport approach** - DECIDED: Option A with refinements
2. ✅ **Clarify Desktop Agent constructor** - DECIDED: Remove transport, add registerConnection()
3. ✅ **Define sail-api package structure** - DECIDED: See above structure
4. ✅ **Decide on WCP handler placement** - DECIDED: Split across layers (WCP1-3 in gateway, WCP4-5 in DA)
5. **Update SYSTEM_ARCHITECTURE.md** with final decisions
6. **Create implementation tasks** for refactoring

## Related Files

- [Transport Interface](../packages/desktop-agent/src/interfaces/transport.ts)
- [Desktop Agent](../packages/desktop-agent/src/desktop-agent.ts)
- [App Instance Registry](../packages/desktop-agent/src/state/app-instance-registry.ts)
- [System Architecture](./SYSTEM_ARCHITECTURE.md)
- [Desktop Agent Architecture](../packages/desktop-agent/ARCHITECTURE.md)
