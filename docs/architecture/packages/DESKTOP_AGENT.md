# Desktop Agent Package Architecture

## Package: @finos/fdc3-sail-desktop-agent

**Purpose**: Pure, environment-agnostic FDC3 2.2 Desktop Agent implementation

**Location**: `packages/desktop-agent/`

---

## Design Philosophy

The Desktop Agent package is designed with one overriding principle: **complete environment independence**.

### Zero Dependencies

The core Desktop Agent has **zero runtime dependencies** on:
- ❌ Browser APIs (`window`, `document`, `MessagePort`)
- ❌ Node.js APIs (`fs`, `http`, `process`)
- ❌ Transport mechanisms (Socket.IO, WebSockets)
- ❌ UI frameworks (React, Vue, etc.)

The only dependencies are:
- ✅ `@finos/fdc3` - Official FDC3 types
- ✅ `zod` - Runtime type validation
- ✅ `uuid` - Identifier generation

### Why This Matters

**Portability**: Runs anywhere JavaScript runs
- Node.js servers
- Browser windows
- Web Workers
- Electron main/renderer processes
- React Native
- Future JavaScript environments

**Testability**: Easy to test with mock transports
```typescript
const mockTransport = new MockTransport()
const agent = new DesktopAgent({ transport: mockTransport })

mockTransport.simulateReceive(broadcastRequest)
expect(mockTransport.sent[0].type).toBe('broadcastResponse')
```

**Reusability**: Core logic can be extracted to standalone library
- No Sail-specific code in core
- Can contribute upstream to FDC3 reference implementations
- Other projects can use it

---

## Package Structure

```
packages/desktop-agent/
├── src/
│   ├── core/                           # Main export (environment-agnostic)
│   │   ├── desktop-agent.ts            # Main DesktopAgent class
│   │   ├── handlers/
│   │   │   ├── dacp/                   # DACP message handlers
│   │   │   │   ├── index.ts            # Message router
│   │   │   │   ├── context-handlers.ts # broadcast, addContextListener, etc.
│   │   │   │   ├── intent-handlers.ts  # raiseIntent, addIntentListener, etc.
│   │   │   │   ├── channel-handlers.ts # joinUserChannel, getCurrentChannel, etc.
│   │   │   │   ├── app-handlers.ts     # open, getInfo, findInstances, etc.
│   │   │   │   ├── wcp-handlers.ts     # WCP4-5 validation logic
│   │   │   │   ├── event-handlers.ts   # Listener unsubscribe, etc.
│   │   │   │   ├── private-channel-handlers.ts
│   │   │   │   └── heartbeat-handlers.ts
│   │   │   ├── validation/             # DACP message validation
│   │   │   │   ├── dacp-schemas.ts     # Zod schemas
│   │   │   │   └── dacp-validator.ts   # Validation utilities
│   │   │   └── types.ts                # Handler context types
│   │   ├── state/                      # State registries
│   │   │   ├── app-instance-registry.ts
│   │   │   ├── intent-registry.ts
│   │   │   ├── channel-context-registry.ts
│   │   │   ├── app-channel-registry.ts
│   │   │   ├── user-channel-registry.ts
│   │   │   └── private-channel-registry.ts
│   │   ├── app-directory/              # App metadata
│   │   │   └── app-directory-manager.ts
│   │   ├── interfaces/                 # Interfaces ONLY
│   │   │   ├── transport.ts            # Transport interface (no implementations)
│   │   │   └── app-launcher.ts         # App launcher interface
│   │   └── protocol/
│   │       └── dacp-messages.ts        # DACP message types
│   ├── browser/                        # Browser submodule (tree-shakeable)
│   │   ├── browser-desktop-agent.ts    # Factory for browser mode
│   │   ├── wcp-connector.ts            # WCP1-3 handler (uses window, postMessage)
│   │   └── message-port-transport.ts   # MessagePort transport impl
│   └── transports/                     # Shared transport implementations
│       └── in-memory-transport.ts      # For testing & WCP connector
├── __tests__/
│   ├── utils/
│   │   ├── mock-transport.ts           # Mock transport for testing
│   │   └── test-helpers.ts
│   └── setup/
│       └── setup-tests.ts
└── index.ts                            # Main exports
```

---

## Module Exports

### Core (Default Export)

```typescript
import {
  DesktopAgent,
  AppInstanceRegistry,
  IntentRegistry,
  ChannelContextRegistry,
  AppDirectoryManager,
  // ... etc
} from '@finos/fdc3-sail-desktop-agent'
```

**What's Included**:
- DesktopAgent class
- All registries
- DACP handler utilities
- Type definitions
- Transport interface (types only, no implementations)

**What's NOT Included**:
- Browser-specific code (WCPConnector, MessagePortTransport)
- Transport implementations

### Browser Submodule

```typescript
import {
  createBrowserDesktopAgent,
  type BrowserDesktopAgentOptions
} from '@finos/fdc3-sail-desktop-agent/browser'
```

**What's Included**:
- `createBrowserDesktopAgent()` factory function
- WCPConnector (WCP1-3 handshake)
- MessagePortTransport
- Browser-specific types

**Why Separate?**
- **Tree-shaking**: Server builds don't include browser code
- **Type safety**: Browser APIs only in browser submodule
- **Clear boundaries**: WCP1-3 vs pure validation

### Transports Submodule

```typescript
import {
  createInMemoryTransportPair
} from '@finos/fdc3-sail-desktop-agent/transports'
```

**What's Included**:
- InMemoryTransport
- createInMemoryTransportPair() helper

**Use Cases**:
- Testing (mock transport pairs)
- WCP connector (bridge MessagePort to Desktop Agent)
- Same-process communication

---

## Core Components

### DesktopAgent Class

**Responsibility**: Orchestrates all FDC3 operations

```typescript
export class DesktopAgent {
  constructor(config: DesktopAgentConfig)
  start(): void
  stop(): void
}

interface DesktopAgentConfig {
  transport: Transport                          // REQUIRED
  appLauncher?: AppLauncher                     // Optional
  appInstanceRegistry?: AppInstanceRegistry     // Optional (has defaults)
  intentRegistry?: IntentRegistry               // Optional
  channelContextRegistry?: ChannelContextRegistry
  appChannelRegistry?: AppChannelRegistry
  userChannelRegistry?: UserChannelRegistry
  appDirectory?: AppDirectoryManager
}
```

**Key Design Points**:
1. **Transport is required** - all other dependencies optional
2. **Dependency injection** - registries can be shared or customized
3. **No state in constructor** - call `start()` to begin processing

**Message Flow**:
```
Transport receives message
    ↓
DesktopAgent.handleMessage()
    ↓
routeDACPMessage() routes by type
    ↓
Specific handler (e.g., broadcastHandler)
    ↓
Handler updates registries
    ↓
Handler sends response via transport
```

### Transport Interface

```typescript
interface Transport {
  send(message: unknown): void
  onMessage(handler: (message: unknown) => void): void
  onDisconnect(handler: () => void): void
  isConnected(): boolean
  disconnect(): void
}
```

**Design Decisions**:

**No `instanceId` in `send()`**:
- Each Transport is 1:1 with a connection
- Routing handled by DACP message metadata
- Simpler interface

**Message is `unknown`**:
- Transport doesn't validate messages
- Validation happens in DACP handlers
- Allows flexibility for different message formats

### DACP Message Handlers

**Location**: `src/core/handlers/dacp/`

All FDC3 operations are implemented as pure functions:

```typescript
type DACPHandler = (
  message: unknown,
  context: DACPHandlerContext
) => Promise<void>

interface DACPHandlerContext {
  transport: Transport
  appInstanceRegistry: AppInstanceRegistry
  intentRegistry: IntentRegistry
  channelContextRegistry: ChannelContextRegistry
  appChannelRegistry: AppChannelRegistry
  userChannelRegistry: UserChannelRegistry
  appDirectory: AppDirectoryManager
  appLauncher?: AppLauncher
}
```

**Handler Pattern**:
```typescript
export async function broadcastHandler(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  // 1. Validate message
  const request = validateDACPMessage(message, broadcastRequestSchema)

  // 2. Extract source instance
  const sourceInstance = context.appInstanceRegistry.getInstance(
    request.meta.source.instanceId
  )

  // 3. Perform operation
  const channelId = sourceInstance.currentChannel || request.payload.channelId
  context.channelContextRegistry.setContext(channelId, request.payload.context)

  // 4. Send response to requester
  const response = createSuccessResponse(request, 'broadcastResponse', null)
  context.transport.send(response)

  // 5. Notify listeners
  const listeners = context.appInstanceRegistry.getContextListeners(
    channelId,
    request.payload.context.type
  )

  for (const listener of listeners) {
    const event = createContextEvent(request.payload.context, sourceInstance)
    context.transport.send(event)
  }
}
```

**Why Pure Functions?**
- Easy to test (no hidden dependencies)
- Clear inputs and outputs
- No side effects (besides registry updates and transport sends)
- Composable

### State Registries

Each registry manages a specific aspect of FDC3 state:

**AppInstanceRegistry**:
```typescript
class AppInstanceRegistry {
  register(instance: AppInstance): void
  unregister(instanceId: string): void
  getInstance(instanceId: string): AppInstance | undefined
  getAllInstances(): AppInstance[]
  getInstancesByApp(appId: string): AppInstance[]
  setChannel(instanceId: string, channelId: string): void
  addContextListener(instanceId: string, contextType: string, listenerId: string): void
  getContextListeners(channelId: string, contextType?: string): Listener[]
}
```

**IntentRegistry**:
```typescript
class IntentRegistry {
  registerHandler(handler: IntentHandler): void
  unregisterHandler(instanceId: string, intent: string): void
  findHandlers(intent: string, contextType?: string, resultType?: string): IntentHandler[]
  findIntents(contextType: string): Intent[]
  cleanup(instanceId: string): void
}
```

**ChannelContextRegistry**:
```typescript
class ChannelContextRegistry {
  setContext(channelId: string, context: Context): void
  getContext(channelId: string, contextType?: string): Context | Context[] | undefined
  clear(channelId: string): void
}
```

**Design Principle**: Single Responsibility
- Each registry manages one concern
- No cross-registry dependencies
- Desktop Agent orchestrates between them

---

## Browser Submodule

### WCPConnector

**Responsibility**: Handle WCP1-3 handshake for iframe apps

**Location**: `src/browser/wcp-connector.ts`

```typescript
class WCPConnector {
  constructor(config: WCPConnectorConfig)
  start(): void
  stop(): void
}

interface WCPConnectorConfig {
  desktopAgent: DesktopAgent
  getIntentResolverUrl?: (instanceId: string) => string | false
  getChannelSelectorUrl?: (instanceId: string) => string | false
  fdc3Version?: string
}
```

**Message Flow**:
```
FDC3 App (iframe)
    ↓ window.postMessage('WCP1Hello')
WCPConnector listens on window
    ↓ Creates MessageChannel
    ↓ Wraps port2 as MessagePortTransport
    ↓ Bridges to Desktop Agent via InMemoryTransport
    ↓ window.postMessage('WCP3Handshake', [port1])
FDC3 App receives port1
    ↓ port1.postMessage('WCP4ValidateAppIdentity')
Desktop Agent (via bridge)
    ↓ Validates identity
    ↓ Sends WCP5 response
```

**Why InMemoryTransport Bridge?**
- WCPConnector is in the same process as Desktop Agent
- But FDC3 apps use MessagePort
- InMemoryTransport bridges the gap without Socket.IO overhead

### createBrowserDesktopAgent Factory

```typescript
function createBrowserDesktopAgent(
  options?: BrowserDesktopAgentOptions
): BrowserDesktopAgentResult

interface BrowserDesktopAgentResult {
  desktopAgent: DesktopAgent
  wcpConnector: WCPConnector
  start: () => void
  stop: () => void
}
```

**What It Does**:
1. Creates InMemoryTransport pair
2. Creates DesktopAgent with transport
3. Creates WCPConnector with Desktop Agent
4. Returns all components + convenience methods

**Usage**:
```typescript
const { desktopAgent, wcpConnector, start } = createBrowserDesktopAgent({
  wcpOptions: {
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false
  }
})

start() // Starts both Desktop Agent and WCP listener
```

---

## DACP Message Validation

All DACP messages are validated using Zod schemas before processing.

**Location**: `src/core/handlers/validation/`

```typescript
// Define schema
const broadcastRequestSchema = z.object({
  type: z.literal('broadcastRequest'),
  payload: z.object({
    channelId: z.string().optional(),
    context: contextSchema
  }),
  meta: metaSchema
})

// Validate in handler
function broadcastHandler(message: unknown, context: HandlerContext) {
  const request = validateDACPMessage(message, broadcastRequestSchema)
  // TypeScript now knows request is BroadcastRequest
}
```

**Why Zod?**
- Runtime type safety (TypeScript is compile-time only)
- Clear error messages for invalid messages
- Schema can be auto-generated from FDC3 spec
- Type inference (schema → TypeScript types)

---

## Testing Strategy

### Unit Tests

**Mock Transport**:
```typescript
const mockTransport = new MockTransport()
const agent = new DesktopAgent({ transport: mockTransport })

// Send message
mockTransport.simulateReceive({
  type: 'broadcastRequest',
  payload: { context: { type: 'fdc3.instrument' } },
  meta: { requestUuid: '123', source: { instanceId: 'app1' } }
})

// Verify response
expect(mockTransport.sent).toHaveLength(1)
expect(mockTransport.sent[0].type).toBe('broadcastResponse')
```

### Integration Tests

**InMemoryTransport Pairs**:
```typescript
const [transport1, transport2] = createInMemoryTransportPair()

const agent = new DesktopAgent({ transport: transport1 })
agent.start()

// Simulate app connection
transport2.send(wcp4ValidateMessage)

// Wait for response
const response = await waitForMessage(transport2)
expect(response.type).toBe('wcp5ValidateAppIdentityResponse')
```

### Test Coverage

All DACP handlers have tests:
- ✅ Broadcast context
- ✅ Add context listener
- ✅ Raise intent
- ✅ Add intent listener
- ✅ Join user channel
- ✅ Get current channel
- ✅ Create private channel
- ✅ Open app
- ✅ Find instances
- ✅ Get info
- ✅ Heartbeat
- ✅ WCP validation

---

## Design Decisions

### Why No EventEmitter in Core?

**Problem**: Different environments need different event patterns
- Browser: DOM events, custom events
- Node.js: EventEmitter
- React: useState, useEffect
- Server: WebSocket broadcasts

**Solution**: Wrappers add events
- Core Desktop Agent has no events
- `SailServerDesktopAgent` (in sail-api) adds EventEmitter
- `SailBrowserDesktopAgent` (in sail-api) adds events for React

### Why Separate Browser Code?

**Tree-Shaking**:
```typescript
// Server bundle - does NOT include browser code
import { DesktopAgent } from '@finos/fdc3-sail-desktop-agent'

// Browser bundle - includes browser code
import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'
```

**Type Safety**:
- Browser APIs (`window`, `MessageChannel`) only in browser submodule
- No `if (typeof window !== 'undefined')` checks needed
- Clear compile-time boundaries

### Why Inject Registries?

**Testing**: Use in-memory registries for fast tests

**Customization**: Use persistent registries for production
```typescript
const agent = new DesktopAgent({
  transport,
  appInstanceRegistry: new PostgresAppInstanceRegistry(db),
  intentRegistry: new RedisIntentRegistry(redis)
})
```

**Multi-User**: Share registries across Desktop Agent instances
```typescript
const sharedIntentRegistry = new IntentRegistry()

// User 1
const agent1 = new DesktopAgent({
  transport: transport1,
  intentRegistry: sharedIntentRegistry
})

// User 2
const agent2 = new DesktopAgent({
  transport: transport2,
  intentRegistry: sharedIntentRegistry
})
```

---

## API Examples

### Creating Desktop Agent (Server Mode)

```typescript
import { DesktopAgent } from '@finos/fdc3-sail-desktop-agent'
import { SocketIOServerTransport } from '@finos/sail-api'

io.on('connection', (socket) => {
  const transport = new SocketIOServerTransport(socket)
  const agent = new DesktopAgent({ transport })
  agent.start()

  socket.on('disconnect', () => agent.stop())
})
```

### Creating Desktop Agent (Browser Mode)

```typescript
import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'

const { desktopAgent, wcpConnector, start } = createBrowserDesktopAgent({
  wcpOptions: {
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
    fdc3Version: '2.2'
  }
})

start()
```

### Custom App Launcher

```typescript
import type { AppLauncher } from '@finos/fdc3-sail-desktop-agent'

class MyAppLauncher implements AppLauncher {
  async launchApp(appId: string, context?: Context): Promise<AppInstance> {
    // Custom launch logic (open window, spawn process, etc.)
    return { instanceId: 'custom-instance', appId }
  }
}

const agent = new DesktopAgent({
  transport,
  appLauncher: new MyAppLauncher()
})
```

---

## Further Reading

- [Sail API Architecture](./SAIL_API.md) - How Sail wraps Desktop Agent
- [Transport Layer](../TRANSPORT.md) - Transport interface details
- [WCP Integration](../WCP_INTEGRATION.md) - WCP flow and implementation
- [FDC3 2.2 Specification](https://fdc3.finos.org/docs/api/spec)
- [DACP Specification](https://fdc3.finos.org/docs/api/specs/desktopAgentCommunicationProtocol)
