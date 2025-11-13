# Implementation Plan: Transport Architecture Refactoring

This document outlines the implementation tasks for refactoring FDC3-Sail to align with the finalized transport architecture decisions.

## Overview

The refactoring implements these key architectural decisions:

1. **Transport = ONE pipe to Desktop Agent** (not per-app)
2. **Routing via DACP message metadata** (source/destination instanceId)
3. **ConnectionManager combines WCP Gateway + Browser Proxy** (browser-specific)
4. **DACP heartbeat for disconnect detection** (not iframe monitoring)
5. **EventEmitter in sail-api wrapper** (not desktop-agent core)

## Implementation Phases

### Phase 1: Core Transport Changes (Breaking Changes)

#### Task 1.1: Update Transport Interface

**Status**: ✅ Completed

**Changes**:
- Remove `instanceId` parameter from `send()` method
- Remove `getInstanceId()` and `setInstanceId()` methods
- Update documentation to reflect "one transport per Desktop Agent"

**Files**:
- `packages/desktop-agent/src/interfaces/transport.ts`

#### Task 1.2: Create Mock Transport for Testing

**Status**: Partially complete (exists but may need updates)

**Changes**:
- Update mock transport to match new interface
- Remove `instanceId` tracking
- Add test helpers for message inspection

**Files**:
- `packages/desktop-agent/src/__tests__/utils/mock-transport.ts`

**Implementation**:
```typescript
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

  getSent(): unknown[] {
    return this.sent
  }

  getLastSent(): unknown | undefined {
    return this.sent[this.sent.length - 1]
  }
}
```

#### Task 1.3: Update Desktop Agent Constructor

**Files**:
- `packages/desktop-agent/src/desktop-agent.ts`

**Changes**:
- Accept single `Transport` in constructor
- Remove any per-app transport tracking
- Update message sending to use `transport.send(message)` without instanceId parameter

**Implementation**:
```typescript
export class DesktopAgent {
  private transport: Transport
  private appInstanceRegistry: AppInstanceRegistry
  private intentRegistry: IntentRegistry
  private appDirectoryManager: AppDirectoryManager

  constructor(transport: Transport, options?: DesktopAgentOptions) {
    this.transport = transport
    this.appInstanceRegistry = new AppInstanceRegistry()
    this.intentRegistry = new IntentRegistry()
    this.appDirectoryManager = new AppDirectoryManager()

    // Register transport handlers
    this.transport.onMessage(this.handleIncomingMessage.bind(this))
    this.transport.onDisconnect(this.handleTransportDisconnect.bind(this))
  }

  private async handleIncomingMessage(message: unknown): Promise<void> {
    // Validate and route to DACP handler
    const result = await routeDACPMessage(message, {
      appInstanceRegistry: this.appInstanceRegistry,
      intentRegistry: this.intentRegistry,
      appDirectoryManager: this.appDirectoryManager,
      transport: this.transport,
    })

    // Send response if applicable
    if (result) {
      this.transport.send(result)
    }
  }

  private handleTransportDisconnect(): void {
    // Clean up ALL app instances when transport disconnects
    this.appInstanceRegistry.clear()
  }

  // Helper for sending messages to specific instances
  async sendToInstance(instanceId: string, message: DACPMessage): Promise<void> {
    // Add destination to message metadata
    if (!message.meta.destination) {
      message.meta.destination = { instanceId }
    }

    this.transport.send(message)
  }
}
```

#### Task 1.4: Update DACP Handlers to Use New Transport

**Files**:
- `packages/desktop-agent/src/handlers/dacp/context.handlers.ts`
- `packages/desktop-agent/src/handlers/dacp/intent.handlers.ts`
- `packages/desktop-agent/src/handlers/dacp/channel.handlers.ts`
- All other DACP handler files

**Changes**:
- Update all handlers to receive `transport` in context
- Update handlers to call `transport.send(message)` instead of `transport.send(instanceId, message)`
- Ensure all outgoing messages have `meta.destination.instanceId` set

**Example**:
```typescript
// Before
export const broadcastHandler = async (
  message: BroadcastRequest,
  context: HandlerContext
): Promise<BroadcastResponse> => {
  const { appInstanceRegistry, transport } = context

  // ... logic ...

  // Send to each listener
  for (const listener of listeners) {
    await transport.send(listener.instanceId, broadcastEvent)  // ❌ OLD
  }
}

// After
export const broadcastHandler = async (
  message: BroadcastRequest,
  context: HandlerContext
): Promise<BroadcastResponse> => {
  const { appInstanceRegistry, transport } = context

  // ... logic ...

  // Send to each listener
  for (const listener of listeners) {
    const event = {
      ...broadcastEvent,
      meta: {
        ...broadcastEvent.meta,
        destination: { instanceId: listener.instanceId }  // ✅ NEW
      }
    }
    await transport.send(event)  // ✅ NEW
  }
}
```

#### Task 1.5: Remove Transport from AppInstanceRegistry

**Files**:
- `packages/desktop-agent/src/state/app-instance-registry.ts`

**Changes**:
- Remove `transport` field from app instance records
- Remove `setTransport()` and `getTransport()` methods
- Simplify to just track app metadata and state

**Implementation**:
```typescript
export interface AppInstance {
  instanceId: string
  appId: string
  metadata: AppMetadata
  currentChannelId?: string
  contextListeners: Set<string>  // context type subscriptions
  intentListeners: Map<string, string>  // intent → listener ID
  // NO transport field
}

export class AppInstanceRegistry {
  private instances = new Map<string, AppInstance>()

  register(instance: Omit<AppInstance, 'contextListeners' | 'intentListeners'>): void {
    this.instances.set(instance.instanceId, {
      ...instance,
      contextListeners: new Set(),
      intentListeners: new Map(),
    })
  }

  unregister(instanceId: string): void {
    this.instances.delete(instanceId)
  }

  getInstance(instanceId: string): AppInstance | undefined {
    return this.instances.get(instanceId)
  }

  getAllInstances(): AppInstance[] {
    return Array.from(this.instances.values())
  }

  clear(): void {
    this.instances.clear()
  }
}
```

### Phase 2: Create ConnectionManager (New Component)

#### Task 2.1: Create ConnectionManager Class

**Files**:
- `packages/sail-api/src/browser/connection-manager.ts` (NEW)

**Implementation**: See [CONNECTION_MANAGER.md](../packages/sail-api/CONNECTION_MANAGER.md) for full specification

**Key Methods**:
- `constructor(transport: Transport, options?: ConnectionManagerOptions)`
- `private handleWCP1Hello(event: MessageEvent): void`
- `private registerPort(instanceId: string, port: MessagePort): void`
- `private routeToApp(message: DACPMessage): void`
- `private sendToDesktopAgent(message: DACPMessage): void`

#### Task 2.2: Move WCP Handling from use-fdc3-connection Hook

**Files**:
- `apps/sail/src/hooks/use-fdc3-connection.ts` (REFACTOR)
- `packages/sail-api/src/browser/connection-manager.ts` (NEW)

**Changes**:
- Extract WCP handshake logic to ConnectionManager
- Update hook to instantiate and use ConnectionManager
- Remove manual MessagePort tracking from hook

**New Hook Implementation**:
```typescript
// apps/sail/src/hooks/use-fdc3-connection.ts
import { ConnectionManager } from "@finos/fdc3-sail-api"

export const useFDC3Connection = (panelId: string) => {
  const { getSocket } = useDesktopAgent()
  const connectionManagerRef = useRef<ConnectionManager | null>(null)

  useEffect(() => {
    const socket = getSocket()
    const transport = new SocketIOTransport(socket)

    // Create ConnectionManager (handles WCP + routing)
    connectionManagerRef.current = new ConnectionManager(transport, {
      getIntentResolverUrl: (instanceId) =>
        `/intent-resolver.html?instanceId=${instanceId}`,
      getChannelSelectorUrl: (instanceId) =>
        `/channel-selector.html?instanceId=${instanceId}`,
    })

    return () => {
      connectionManagerRef.current?.disconnect()
    }
  }, [getSocket])

  return {
    connectionManager: connectionManagerRef.current,
  }
}
```

#### Task 2.3: Create Factory Functions

**Files**:
- `packages/sail-api/src/factory.ts` (NEW)

**Implementation**:
```typescript
export interface BrowserDesktopAgentConfig {
  mode: "browser" | "server" | "worker"
  serverUrl?: string  // Required for server mode
  worker?: Worker  // Required for worker mode
  appDirectories?: string[]
  getIntentResolverUrl?: (instanceId: string) => string | undefined
  getChannelSelectorUrl?: (instanceId: string) => string | undefined
}

export function createBrowserDesktopAgent(
  config: BrowserDesktopAgentConfig
): { desktopAgent: DesktopAgent; connectionManager: ConnectionManager } {
  let transport: Transport

  switch (config.mode) {
    case "server": {
      if (!config.serverUrl) {
        throw new Error("serverUrl required for server mode")
      }
      const socket = io(config.serverUrl)
      transport = new SocketIOTransport(socket)
      break
    }

    case "worker": {
      if (!config.worker) {
        throw new Error("worker required for worker mode")
      }
      const channel = new MessageChannel()
      config.worker.postMessage({ type: "init", port: channel.port1 }, [channel.port1])
      transport = new MessagePortTransport(channel.port2)
      break
    }

    case "browser": {
      const [daTransport, cmTransport] = createInMemoryTransportPair()
      transport = daTransport
      break
    }
  }

  const desktopAgent = new DesktopAgent(transport, {
    appDirectories: config.appDirectories,
  })

  const connectionManager = new ConnectionManager(transport, {
    getIntentResolverUrl: config.getIntentResolverUrl,
    getChannelSelectorUrl: config.getChannelSelectorUrl,
  })

  return { desktopAgent, connectionManager }
}
```

### Phase 3: Update Transport Implementations

#### Task 3.1: Create/Update SocketIOTransport

**Files**:
- `packages/sail-api/src/transports/socket-io-transport.ts`

**Implementation**: See [TRANSPORT.md](../packages/desktop-agent/TRANSPORT.md)

#### Task 3.2: Create/Update MessagePortTransport

**Files**:
- `packages/sail-api/src/transports/message-port-transport.ts`

**Implementation**: See [TRANSPORT.md](../packages/desktop-agent/TRANSPORT.md)

#### Task 3.3: Create InMemoryTransport

**Files**:
- `packages/desktop-agent/src/transports/in-memory-transport.ts` (NEW)

**Implementation**: See [TRANSPORT.md](../packages/desktop-agent/TRANSPORT.md)

### Phase 4: Update Server-Side Code

#### Task 4.1: Update sail-server to Use New Transport

**Files**:
- `apps/sail-server/src/main.ts`

**Changes**:
- Create transport per Socket.IO connection
- Pass transport to Desktop Agent
- Remove per-app connection logic

**Implementation**:
```typescript
import { Server } from "socket.io"
import { DesktopAgent } from "@finos/fdc3-sail-desktop-agent"
import { SocketIOServerTransport } from "@finos/fdc3-sail-api/server"

const io = new Server(8080, {
  cors: { origin: "*" },
})

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Create transport for this connection
  const transport = new SocketIOServerTransport(socket)

  // Create Desktop Agent with this transport
  const desktopAgent = new DesktopAgent(transport)

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`)
    desktopAgent.disconnect()
  })
})
```

#### Task 4.2: Create SocketIOServerTransport

**Files**:
- `packages/sail-api/src/server/socket-io-server-transport.ts` (NEW)

**Implementation**:
```typescript
import type { Socket } from "socket.io"
import type { Transport, MessageHandler, DisconnectHandler } from "@finos/fdc3-sail-desktop-agent"

export class SocketIOServerTransport implements Transport {
  private socket: Socket
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler

  constructor(socket: Socket) {
    this.socket = socket

    this.socket.on("fdc3_message", (message: unknown) => {
      this.messageHandler?.(message)
    })

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

### Phase 5: Update Sail UI

#### Task 5.1: Refactor use-fdc3-connection Hook

**Status**: Partially addressed in Task 2.2

**Files**:
- `apps/sail/src/hooks/use-fdc3-connection.ts`

**Additional Changes**:
- Remove manual WCP message handling
- Remove manual MessagePort tracking
- Delegate entirely to ConnectionManager

#### Task 5.2: Update use-desktop-agent Hook

**Files**:
- `apps/sail/src/hooks/use-desktop-agent.ts`

**Changes**:
- Remove any EventEmitter code if present
- Keep only Socket.IO connection management
- Simplify to just provide socket instance

#### Task 5.3: Create EventEmitter Wrapper (if needed for UI)

**Files**:
- `packages/sail-api/src/desktop-agent-wrapper.ts` (NEW, if UI synchronization needed)

**Implementation**:
```typescript
import { EventEmitter } from "eventemitter3"
import type { DesktopAgent } from "@finos/fdc3-sail-desktop-agent"

export interface DesktopAgentEvents {
  appConnected: (instanceId: string, appId: string) => void
  appDisconnected: (instanceId: string) => void
  channelChanged: (instanceId: string, channelId: string) => void
  // Add other events as needed for UI
}

export class DesktopAgentWrapper extends EventEmitter<DesktopAgentEvents> {
  private desktopAgent: DesktopAgent

  constructor(desktopAgent: DesktopAgent) {
    super()
    this.desktopAgent = desktopAgent
  }

  // Proxy methods that need event emission
  async handleMessage(message: unknown): Promise<void> {
    const result = await this.desktopAgent.handleMessage(message)

    // Emit events based on message type
    if (message.type === "WCP4ValidateAppIdentity") {
      this.emit("appConnected", message.payload.instanceId, message.payload.appId)
    }

    return result
  }

  // ... other proxied methods with event emission
}
```

### Phase 6: Testing

#### Task 6.1: Update Unit Tests

**Files**:
- All test files in `packages/desktop-agent/src/__tests__/`

**Changes**:
- Update to use MockTransport
- Update assertions for new `send()` signature
- Test message routing via metadata

#### Task 6.2: Add Integration Tests

**Files**:
- `packages/desktop-agent/src/__tests__/integration/` (NEW)

**Tests**:
- Complete WCP handshake flow
- Multi-app message routing
- DACP heartbeat and disconnect
- Context broadcast across apps
- Intent resolution across apps

#### Task 6.3: Add ConnectionManager Tests

**Files**:
- `packages/sail-api/src/browser/__tests__/connection-manager.test.ts` (NEW)

**Tests**:
- WCP1Hello handling
- MessagePort registration
- Message routing to apps
- Message routing to Desktop Agent
- Disconnect cleanup

### Phase 7: Documentation

#### Task 7.1: Update Package READMEs

**Status**: ✅ Completed (CONNECTION_MANAGER.md, WCP_INTEGRATION.md, TRANSPORT.md)

**Files**:
- `packages/desktop-agent/README.md`
- `packages/sail-api/README.md`

**Changes**:
- Add usage examples with new architecture
- Document factory functions
- Link to architecture docs

#### Task 7.2: Update Root CLAUDE.md

**Files**:
- `CLAUDE.md`

**Changes**:
- Update architecture section
- Update common workflows
- Add troubleshooting for new architecture

#### Task 7.3: Create Migration Guide

**Files**:
- `docs/MIGRATION_GUIDE.md` (NEW)

**Contents**:
- Breaking changes summary
- Before/after code examples
- Step-by-step migration instructions
- Common pitfalls and solutions

## Task Dependencies

```
Phase 1: Core Transport Changes
  ├─ 1.1 Update Transport Interface ✅
  ├─ 1.2 Create Mock Transport
  ├─ 1.3 Update Desktop Agent Constructor
  ├─ 1.4 Update DACP Handlers
  └─ 1.5 Remove Transport from Registry

Phase 2: Create ConnectionManager
  ├─ 2.1 Create ConnectionManager Class
  ├─ 2.2 Move WCP Handling
  └─ 2.3 Create Factory Functions
     (depends on 1.3, 2.1)

Phase 3: Update Transport Implementations
  ├─ 3.1 SocketIOTransport
  ├─ 3.2 MessagePortTransport
  └─ 3.3 InMemoryTransport
     (depends on 1.1)

Phase 4: Update Server-Side Code
  ├─ 4.1 Update sail-server
  └─ 4.2 Create SocketIOServerTransport
     (depends on 1.3, 3.1)

Phase 5: Update Sail UI
  ├─ 5.1 Refactor use-fdc3-connection
  ├─ 5.2 Update use-desktop-agent
  └─ 5.3 Create EventEmitter Wrapper
     (depends on 2.1, 2.2)

Phase 6: Testing
  ├─ 6.1 Update Unit Tests
  ├─ 6.2 Add Integration Tests
  └─ 6.3 Add ConnectionManager Tests
     (depends on all previous phases)

Phase 7: Documentation ✅
  ├─ 7.1 Update Package READMEs ✅
  ├─ 7.2 Update Root CLAUDE.md
  └─ 7.3 Create Migration Guide
```

## Breaking Changes Summary

### For Desktop Agent Users

1. **Transport interface changed**:
   - `send(instanceId, message)` → `send(message)`
   - Messages MUST include `meta.destination.instanceId`

2. **Constructor signature**:
   - Still takes single `Transport`, but transport semantics changed

3. **No per-app transport tracking**:
   - `AppInstanceRegistry` no longer stores transports
   - Routing happens via message metadata

### For Sail UI

1. **WCP handling moved to ConnectionManager**:
   - Use `ConnectionManager` instead of manual WCP logic
   - Use factory function for easy setup

2. **EventEmitter moved to wrapper**:
   - Desktop Agent core has no EventEmitter
   - Use `DesktopAgentWrapper` if UI synchronization needed

### For sail-server

1. **One Desktop Agent per Socket.IO connection**:
   - Create `DesktopAgent` per connection, not per app
   - Use `SocketIOServerTransport`

## Rollout Strategy

### Stage 1: Core Infrastructure (Non-Breaking)

- Complete Phase 1 tasks in feature branch
- Update tests to use new interface
- Ensure all tests pass

### Stage 2: ConnectionManager (Additive)

- Complete Phase 2 tasks
- Add ConnectionManager alongside existing code
- Test with new factory functions

### Stage 3: Transport Implementations (Parallel)

- Complete Phase 3 tasks
- Implement all transport types
- Test each independently

### Stage 4: Integration (Breaking)

- Complete Phase 4 and 5 tasks
- Update server and UI to use new architecture
- Remove old WCP handling code

### Stage 5: Testing and Documentation

- Complete Phase 6 and 7 tasks
- Full integration testing
- Migration guide for users

## Success Criteria

- ✅ All unit tests pass with new Transport interface
- ✅ ConnectionManager handles complete WCP flow
- ✅ Multi-app context broadcast works correctly
- ✅ DACP heartbeat detects disconnects
- ✅ Server mode routes messages correctly
- ✅ Browser mode routes messages correctly
- ✅ Worker mode routes messages correctly
- ✅ No browser-specific code in desktop-agent package
- ✅ Documentation is complete and accurate
- ✅ Migration guide helps users transition

## Timeline Estimate

- **Phase 1**: 2-3 days (core transport changes + testing)
- **Phase 2**: 2-3 days (ConnectionManager implementation + testing)
- **Phase 3**: 1-2 days (transport implementations)
- **Phase 4**: 1 day (server updates)
- **Phase 5**: 1-2 days (UI updates)
- **Phase 6**: 2-3 days (comprehensive testing)
- **Phase 7**: 1 day (documentation)

**Total**: ~10-15 days of development

## Notes

- This is a **breaking change** for anyone using the Desktop Agent API directly
- Existing sail-app code will need significant refactoring
- New architecture is **much simpler** and **more aligned with DACP**
- **Better separation** between browser-specific (sail-api) and agnostic (desktop-agent) code
- Easier to **test** with clear boundaries and mock transport

## Related Documents

- [TRANSPORT_ARCHITECTURE_PLANNING.md](./TRANSPORT_ARCHITECTURE_PLANNING.md) - Architectural decisions
- [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - Full architecture overview
- [CONNECTION_MANAGER.md](../packages/sail-api/CONNECTION_MANAGER.md) - ConnectionManager specification
- [WCP_INTEGRATION.md](../packages/desktop-agent/WCP_INTEGRATION.md) - WCP integration guide
- [TRANSPORT.md](../packages/desktop-agent/TRANSPORT.md) - Transport interface documentation