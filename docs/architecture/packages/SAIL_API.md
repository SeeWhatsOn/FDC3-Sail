# Sail API Package Architecture

## Package: @finos/sail-api

**Purpose**: Sail platform services and Desktop Agent wrappers for different environments

**Location**: `packages/sail-api/`

---

## Overview

The `sail-api` package serves as the **composition layer** between the pure FDC3 Desktop Agent and specific runtime environments. It provides:

1. **Desktop Agent Wrappers** - Environment-specific wrappers (server, browser)
2. **Transport Implementations** - Socket.IO, MessagePort transports
3. **Platform API** - Sail-specific features (workspaces, layouts, config)
4. **Client APIs** - Clients for connecting to Desktop Agents
5. **Middleware** - Logging, auth, metrics support

**Key Principle**: Keeps environment-specific code separate from FDC3 core

---

## Package Structure

```
packages/sail-api/
├── src/
│   ├── SailDesktopAgent.ts            # Server Desktop Agent wrapper (main export)
│   ├── SailBrowserDesktopAgent.ts     # Browser Desktop Agent wrapper
│   ├── adapters/                      # Transport implementations
│   │   ├── socket-io-transport.ts             # Client Socket.IO transport
│   │   ├── socket-io-server-transport.ts      # Server Socket.IO transport
│   │   └── SailAppLauncher.ts                 # App launcher impl
│   ├── client/                        # Client APIs
│   │   ├── SailServerClientAPI.ts     # FDC3 operations client
│   │   └── SailPlatformApi.ts         # Platform features client
│   ├── platform/                      # Platform API implementations
│   │   ├── ISailPlatformApi.ts        # Platform API interface
│   │   ├── LocalStoragePlatformApi.ts # localStorage backend
│   │   └── RemotePlatformApi.ts       # Remote backend
│   ├── server/                        # Server utilities
│   │   ├── index.ts
│   │   └── SailServer.ts              # Server setup utilities
│   ├── middleware.ts                  # Middleware pipeline
│   ├── protocol/
│   │   └── sail-messages.ts           # Sail protocol message types
│   └── types/
│       └── sail-types.ts              # Shared types
└── index.ts                           # Main exports
```

---

## Main Exports

### Server Desktop Agent

```typescript
import {
  SailServerDesktopAgent,
  type SailServerDesktopAgentConfig
} from '@finos/sail-api'
```

**Purpose**: Wrap Desktop Agent for server-side use (Node.js)

**Features**:
- Transport-agnostic (works with Socket.IO, any custom transport)
- Middleware support (logging, auth, metrics)
- Per-user Desktop Agent isolation
- App launcher integration

### Browser Desktop Agent

```typescript
import {
  createSailBrowserDesktopAgent,
  type SailBrowserDesktopAgentConfig
} from '@finos/sail-api'
```

**Purpose**: Wrap Desktop Agent for browser-side use

**Features**:
- WCP connector with Sail-specific defaults
- Middleware support
- Returns `{ desktopAgent, wcpConnector, start, stop }`

### Client APIs

```typescript
import {
  SailServerClientAPI,    // For FDC3 operations
  SailPlatformApi         // For Sail platform features
} from '@finos/sail-api'
```

**Purpose**: Type-safe clients for connecting to Sail servers

### Transport Implementations

```typescript
import {
  SocketIOServerTransport,  // Server-side Socket.IO
  SocketIOTransport         // Client-side Socket.IO
} from '@finos/sail-api'
```

---

## Core Components

### SailServerDesktopAgent

**Responsibility**: Wrap Desktop Agent for server-side use with Sail-specific features

```typescript
class SailServerDesktopAgent {
  constructor(config: SailServerDesktopAgentConfig)
  use(middleware: Middleware): this
  start(): void
  stop(): void
}

interface SailServerDesktopAgentConfig {
  transport: Transport              // REQUIRED
  appLauncher?: SailAppLauncherConfig
  appInstanceRegistry?: AppInstanceRegistry
  intentRegistry?: IntentRegistry
  // ... other registries
  debug?: boolean
}
```

**What It Adds to Desktop Agent**:

1. **Middleware Pipeline**:
```typescript
agent.use(async (ctx, next) => {
  console.log(`[${ctx.message.type}] from ${ctx.message.meta.source.instanceId}`)
  await next()
  console.log(`[${ctx.message.type}] handled`)
})
```

2. **App Launcher Integration**:
```typescript
const agent = new SailServerDesktopAgent({
  transport,
  appLauncher: {
    baseUrl: 'http://localhost:5174',
    onLaunch: (appId, url) => {
      io.emit('openApp', { appId, url })
    }
  }
})
```

3. **Debug Logging**:
```typescript
const agent = new SailServerDesktopAgent({
  transport,
  debug: true  // Logs all messages
})
```

**Usage Example**:
```typescript
import { SailServerDesktopAgent, SocketIOServerTransport } from '@finos/sail-api'
import { Server } from 'socket.io'

const io = new Server(3000)

io.on('connection', (socket) => {
  const transport = new SocketIOServerTransport(socket)
  const agent = new SailServerDesktopAgent({ transport })

  // Add middleware
  agent.use(loggingMiddleware)
  agent.use(metricsMiddleware)

  agent.start()

  socket.on('disconnect', () => agent.stop())
})
```

---

### createSailBrowserDesktopAgent

**Responsibility**: Factory for browser Desktop Agent with Sail defaults

```typescript
function createSailBrowserDesktopAgent(
  config?: SailBrowserDesktopAgentConfig
): BrowserDesktopAgentResult & { middleware: MiddlewarePipeline }

interface SailBrowserDesktopAgentConfig {
  wcpOptions?: {
    getIntentResolverUrl?: (instanceId: string) => string | false
    getChannelSelectorUrl?: (instanceId: string) => string | false
    fdc3Version?: string
  }
  debug?: boolean
}
```

**What It Does**:
1. Creates browser Desktop Agent from `@finos/fdc3-sail-desktop-agent/browser`
2. Applies Sail-specific WCP defaults:
   - `intentResolverUrl: false` (Sail provides UI externally)
   - `channelSelectorUrl: false` (Sail provides UI externally)
3. Wraps with middleware support
4. Returns all components for full control

**Usage Example**:
```typescript
import { createSailBrowserDesktopAgent } from '@finos/sail-api'

const { desktopAgent, wcpConnector, start, middleware } = createSailBrowserDesktopAgent({
  wcpOptions: {
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false
  },
  debug: true
})

// Add middleware
middleware.use(loggingMiddleware)

start()
```

---

### SailServerClientAPI

**Responsibility**: Type-safe client for FDC3 operations on remote Desktop Agent

```typescript
class SailServerClientAPI {
  constructor(socket: Socket)

  // FDC3 Operations
  desktopAgentHello(config: SailConfig): Promise<void>
  getDirectoryListing(): Promise<AppMetadata[]>

  // Direct socket access for DACP messages
  getSocket(): Socket
}
```

**Purpose**: Simplifies connecting to server Desktop Agent

**Why Use This?**
- Type-safe API (no manual Socket.IO event names)
- Automatic request/response correlation
- Promise-based (cleaner than callbacks)
- Handles Sail protocol messages

**Usage Example**:
```typescript
import { io } from 'socket.io-client'
import { SailServerClientAPI } from '@finos/sail-api'

const socket = io('http://localhost:8091')
const client = new SailServerClientAPI(socket)

// Send Hello message
await client.desktopAgentHello({
  directories: [],
  channels: [],
  panels: [],
  customApps: []
})

// Get app directory
const apps = await client.getDirectoryListing()

// Direct DACP messages
const socket = client.getSocket()
socket.emit('fdc3_event', dacpMessage)
```

---

### SailPlatformApi

**Responsibility**: Client for Sail platform features (workspaces, layouts, config)

**Why Separate from FDC3?**
- Workspaces, layouts, and config are **Sail-specific** (not FDC3 standard)
- Platform API has **pluggable storage backends** (localStorage, remote, etc.)
- Clear separation between FDC3 operations and Sail platform features

```typescript
class SailPlatformApi implements ISailPlatformApi {
  constructor(config?: SailPlatformApiConfig)

  // Workspace operations
  getWorkspaces(): Promise<Workspace[]>
  saveWorkspaceLayout(workspaceId: string, layout: Layout): Promise<void>
  loadWorkspaceLayout(workspaceId: string): Promise<Layout>

  // Config operations
  getConfig(): Promise<SailConfig>
  updateConfig(config: Partial<SailConfig>): Promise<void>
}

interface SailPlatformApiConfig {
  storage?: 'localStorage' | 'remote'
  localStorage?: LocalStoragePlatformApiConfig
  remote?: RemotePlatformApiConfig
}
```

**Storage Backends**:

**1. localStorage (default)**:
```typescript
const platformApi = new SailPlatformApi({
  storage: 'localStorage',
  localStorage: {
    keyPrefix: 'sail_',
    debug: true
  }
})
```

**2. Remote (via WebSocket)**:
```typescript
const platformApi = new SailPlatformApi({
  storage: 'remote',
  remote: {
    socket: io('http://localhost:8091'),
    debug: true
  }
})
```

**3. Remote (via REST)**:
```typescript
const platformApi = new SailPlatformApi({
  storage: 'remote',
  remote: {
    restApiUrl: 'https://api.example.com',
    debug: true
  }
})
```

**Usage Example**:
```typescript
import { SailPlatformApi } from '@finos/sail-api'

// Default: localStorage
const platformApi = new SailPlatformApi()

// Get workspaces
const workspaces = await platformApi.getWorkspaces()

// Save layout
await platformApi.saveWorkspaceLayout('workspace-1', {
  panels: [...],
  channelSelectors: [...]
})
```

---

## Transport Implementations

### SocketIOServerTransport

**Purpose**: Server-side Socket.IO transport for Desktop Agent

```typescript
class SocketIOServerTransport implements Transport {
  constructor(socket: Socket)

  send(message: unknown): void
  onMessage(handler: MessageHandler): void
  onDisconnect(handler: DisconnectHandler): void
  isConnected(): boolean
  disconnect(): void
}
```

**How It Works**:
```typescript
import { SocketIOServerTransport } from '@finos/sail-api'

io.on('connection', (socket) => {
  const transport = new SocketIOServerTransport(socket)

  // Transport listens for 'fdc3_event' from client
  transport.onMessage((message) => {
    console.log('Received DACP message:', message)
  })

  // Transport sends via 'fdc3_event' to client
  transport.send({
    type: 'broadcastResponse',
    payload: { ... }
  })
})
```

**Protocol**:
- Receives messages on `fdc3_event` channel
- Sends messages on `fdc3_event` channel
- Disconnect handled by Socket.IO `disconnect` event

---

### SocketIOTransport (Client-Side)

**Purpose**: Client-side Socket.IO transport

```typescript
class SocketIOTransport implements Transport {
  constructor(socket: Socket)

  send(message: unknown): void
  onMessage(handler: MessageHandler): void
  onDisconnect(handler: DisconnectHandler): void
  isConnected(): boolean
  disconnect(): void
}
```

**Usage**:
```typescript
import { io } from 'socket.io-client'
import { SocketIOTransport } from '@finos/sail-api'

const socket = io('http://localhost:8091')
const transport = new SocketIOTransport(socket)

// Use with Desktop Agent (if running locally)
const agent = new DesktopAgent({ transport })
```

---

## Middleware System

### Middleware Interface

```typescript
type Middleware = (
  ctx: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void>

interface MiddlewareContext {
  message: unknown
  transport: Transport
  // Add custom properties as needed
}
```

### Middleware Pipeline

```typescript
class MiddlewarePipeline {
  use(middleware: Middleware): this
  execute(ctx: MiddlewareContext): Promise<void>
}
```

### Example Middlewares

**Logging Middleware**:
```typescript
const loggingMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now()
  console.log(`→ ${ctx.message.type}`)

  await next()

  const duration = Date.now() - start
  console.log(`← ${ctx.message.type} (${duration}ms)`)
}
```

**Metrics Middleware**:
```typescript
const metricsMiddleware: Middleware = async (ctx, next) => {
  metrics.increment('fdc3.messages.total')
  metrics.increment(`fdc3.messages.${ctx.message.type}`)

  await next()
}
```

**Auth Middleware**:
```typescript
const authMiddleware: Middleware = async (ctx, next) => {
  const userId = ctx.message.meta.userId

  if (!isAuthorized(userId)) {
    throw new Error('Unauthorized')
  }

  await next()
}
```

**OpenTelemetry Middleware** (provided out-of-the-box):
```typescript
import { openTelemetryMiddleware } from '@finos/sail-api/middlewares/opentelemetry'

agent.use(openTelemetryMiddleware)
```

---

## Platform API Interface

### ISailPlatformApi

**Purpose**: Define contract for platform storage backends

```typescript
interface ISailPlatformApi {
  // Workspaces
  getWorkspaces(): Promise<Workspace[]>
  createWorkspace(workspace: CreateWorkspaceInput): Promise<Workspace>
  deleteWorkspace(workspaceId: string): Promise<void>

  // Layouts
  saveWorkspaceLayout(workspaceId: string, layout: Layout): Promise<void>
  loadWorkspaceLayout(workspaceId: string): Promise<Layout>

  // Config
  getConfig(): Promise<SailConfig>
  updateConfig(config: Partial<SailConfig>): Promise<void>
}
```

### Implementations

**LocalStoragePlatformApi**:
- Stores data in browser localStorage
- Synchronous operations
- No server needed
- Great for single-user, local apps

**RemotePlatformApi**:
- Stores data on remote server
- Supports both REST and WebSocket
- Multi-user capable
- Persistent across devices

**Custom Implementations**:
```typescript
class PostgresPlatformApi implements ISailPlatformApi {
  async getWorkspaces(): Promise<Workspace[]> {
    return await db.query('SELECT * FROM workspaces')
  }

  async saveWorkspaceLayout(workspaceId: string, layout: Layout): Promise<void> {
    await db.query(
      'UPDATE workspaces SET layout = $1 WHERE id = $2',
      [layout, workspaceId]
    )
  }

  // ... implement other methods
}
```

---

## Design Decisions

### Why Wrappers Instead of Inheritance?

**Composition over Inheritance**:
```typescript
// ✅ GOOD: Composition
class SailServerDesktopAgent {
  private desktopAgent: DesktopAgent  // Wraps, doesn't extend

  start() {
    this.middleware.execute(...)
    this.desktopAgent.start()
  }
}

// ❌ BAD: Inheritance
class SailServerDesktopAgent extends DesktopAgent {
  // Pollutes Desktop Agent with Sail-specific code
}
```

**Benefits**:
- Desktop Agent stays pure (no Sail-specific code)
- Can swap Desktop Agent implementation
- Clear boundaries between layers
- Easier to test in isolation

---

### Why Separate FDC3 and Platform APIs?

**SailServerClientAPI** (FDC3 operations):
- Standard FDC3 operations
- Uses `fdc3_event` channel
- Talks to Desktop Agent

**SailPlatformApi** (Sail features):
- Sail-specific operations (workspaces, layouts)
- Uses `sail_event` channel (if remote) or localStorage
- Talks to Sail platform services

**Why?**
- **Clear separation** between FDC3 standard and Sail proprietary
- **Pluggable storage** for platform features
- **Different lifecycles** (FDC3 session vs. platform persistence)
- **API clarity** (developers know which API for what purpose)

---

### Why Middleware in Wrapper, Not Core?

**Desktop Agent Core**: No middleware
- Pure FDC3 logic
- No EventEmitter, no middleware
- Testable in isolation

**Sail Wrappers**: Add middleware
- Server needs logging, auth, metrics
- Browser might need different middleware
- Flexibility for different environments

---

## Migration from Old Architecture

### Old: SailClient

```typescript
// OLD (deprecated)
import { SailClient } from '@finos/sail-api'

const client = new SailClient(socket)
const apps = await client.getDirectoryListing()
```

### New: SailServerClientAPI + SailPlatformApi

```typescript
// NEW (recommended)
import { SailServerClientAPI, SailPlatformApi } from '@finos/sail-api'

// FDC3 operations
const serverClient = new SailServerClientAPI(socket)
const apps = await serverClient.getDirectoryListing()

// Sail platform features
const platformApi = new SailPlatformApi()
const workspaces = await platformApi.getWorkspaces()
```

**Why Split?**
- Clearer API separation
- Pluggable storage for platform features
- Better type safety
- Easier to maintain

---

## API Examples

### Server Setup (Complete)

```typescript
import { SailServerDesktopAgent, SocketIOServerTransport } from '@finos/sail-api'
import { Server } from 'socket.io'

const io = new Server(8091, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Create transport
  const transport = new SocketIOServerTransport(socket)

  // Create Desktop Agent with Sail wrapper
  const agent = new SailServerDesktopAgent({
    transport,
    appLauncher: {
      baseUrl: 'http://localhost:5174',
      onLaunch: (appId, url) => {
        socket.emit('openApp', { appId, url })
      }
    },
    debug: true
  })

  // Add middleware
  agent.use(loggingMiddleware)
  agent.use(metricsMiddleware)

  // Start agent
  agent.start()

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
    agent.stop()
  })
})
```

### Browser Setup (Complete)

```typescript
import { createSailBrowserDesktopAgent } from '@finos/sail-api'

const { desktopAgent, wcpConnector, start, middleware } = createSailBrowserDesktopAgent({
  wcpOptions: {
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
    fdc3Version: '2.2'
  },
  debug: true
})

// Add middleware
middleware.use(loggingMiddleware)

// Start Desktop Agent and WCP listener
start()
```

### Client Usage (Complete)

```typescript
import { io } from 'socket.io-client'
import { SailServerClientAPI, SailPlatformApi } from '@finos/sail-api'

// Connect to server
const socket = io('http://localhost:8091')

// FDC3 operations
const fdc3Client = new SailServerClientAPI(socket)

await fdc3Client.desktopAgentHello({
  directories: [],
  channels: [],
  panels: []
})

const apps = await fdc3Client.getDirectoryListing()

// Sail platform operations
const platformApi = new SailPlatformApi({
  storage: 'remote',
  remote: { socket }
})

const workspaces = await platformApi.getWorkspaces()
await platformApi.saveWorkspaceLayout('workspace-1', layout)
```

---

## Further Reading

- [Desktop Agent Architecture](./DESKTOP_AGENT.md)
- [Transport Layer Details](../TRANSPORT.md)
- [System Architecture Overview](../OVERVIEW.md)
- [FDC3 Specification](https://fdc3.finos.org/docs/api/spec)
