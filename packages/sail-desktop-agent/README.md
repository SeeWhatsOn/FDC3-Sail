# FDC3 Sail Desktop Agent

A pure, transport-agnostic FDC3 Desktop Agent implementation that supports the complete Desktop Agent Communication Protocol (DACP) specification.

## Overview

This package provides a production-ready FDC3 Desktop Agent that manages application instances, channels, intents, and private channels according to the [FDC3 2.2 specification](https://fdc3.finos.org/docs/api/spec).

**Key Features:**

- ✅ **Full FDC3 2.2 Compliance**: All mandatory Desktop Agent APIs implemented
- ✅ **Transport Agnostic**: Core has zero transport dependencies - works with any message transport
- ✅ **Environment Agnostic**: Runs in browser, Node.js, Web Worker, or any JavaScript runtime
- ✅ **WCP Support**: Full Web Connection Protocol (WCP1-6) implementation for browser apps
- ✅ **Flexible Deployment**: Same code runs locally, on server, or in worker
- ✅ **Type Safety**: Built with TypeScript and Zod validation

## Architecture

The package follows a clean three-layer architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser Apps (iframes)                                                 │
│  Using @finos/fdc3-get-agent                                           │
│  fdc3.raiseIntent(), fdc3.broadcast(), etc.                            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ MessagePort (WCP)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  WCPConnector (Browser only)                                            │
│  - Handles WCP1-3 handshake with iframe apps                           │
│  - Manages MessagePorts per app                                         │
│  - Bridges to Transport                                                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ Transport (swappable)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  DesktopAgent (runs anywhere)                                           │
│  - Pure FDC3 logic, zero environment dependencies                       │
│  - DACP message handlers                                                │
│  - State registries (apps, channels, intents)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
packages/sail-desktop-agent/
├── src/
│   ├── core/                      # Pure FDC3 Desktop Agent (environment-agnostic)
│   │   ├── sail-desktop-agent.ts       # Main DesktopAgent class
│   │   ├── handlers/              # DACP message handlers
│   │   │   └── dacp/              # All FDC3 operation handlers
│   │   ├── state/                 # State registries
│   │   │   ├── app-instance-registry.ts
│   │   │   ├── intent-registry.ts
│   │   │   ├── channel-context-registry.ts
│   │   │   └── ...
│   │   ├── interfaces/            # Transport & AppLauncher interfaces
│   │   └── app-directory/         # FDC3 App Directory management
│   ├── browser/                   # Browser-specific code
│   │   ├── browser-sail-desktop-agent.ts  # Factory functions
│   │   └── wcp/                   # WCP implementation
│   │       ├── wcp-connector.ts   # WCP1-6 protocol handler
│   │       └── message-port-transport.ts
│   └── transports/                # Transport implementations
│       └── in-memory-transport.ts # For same-process communication
└── test/                          # Cucumber BDD tests
```

## Installation

```bash
npm install @finos/fdc3-sail-desktop-agent
```

## Quick Start

### Browser Mode (Desktop Agent in same window)

Use when Desktop Agent runs in the browser alongside your UI:

```typescript
import { createBrowserDesktopAgent } from "@finos/fdc3-sail-desktop-agent/browser"

const { desktopAgent, wcpConnector, start, stop } = createBrowserDesktopAgent({
  wcpOptions: {
    // Return false for Sail-controlled UI (recommended)
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
  },
  appDirectories: ["https://example.com/apps.json"],
})

// Start Desktop Agent and WCP Connector
start()

// Apps in iframes can now connect via fdc3.getAgent()
```

### Server Mode (Desktop Agent on server)

Use when Desktop Agent runs on a Node.js server:

```typescript
// Browser client
import { createWCPClient } from "@finos/fdc3-sail-desktop-agent/browser"
import { SocketIOClientTransport } from "@finos/sail-platform-api"

const transport = new SocketIOClientTransport({
  url: "wss://your-server.com",
  auth: { userId: "user123" },
})

const { wcpConnector, start } = createWCPClient({
  transport,
  wcpOptions: {
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
  },
})

start()
// Apps connect via WCP, messages flow to server
```

```typescript
// Server
import { DesktopAgent } from "@finos/fdc3-sail-desktop-agent"
import { SocketIOServerTransport } from "@finos/sail-platform-api"

const transport = new SocketIOServerTransport(io, userId)
const agent = new DesktopAgent({ transport })
agent.start()
```

### Worker Mode (Desktop Agent in Web Worker)

Use when Desktop Agent runs in a Web Worker for isolation:

```typescript
// Main thread
import { createWCPClient } from "@finos/fdc3-sail-desktop-agent/browser"
import { WebWorkerTransport } from "@finos/sail-platform-api"

const worker = new Worker("sail-desktop-agent-worker.js")
const transport = new WebWorkerTransport(worker)

const { wcpConnector, start } = createWCPClient({ transport })
start()
```

### Manual Composition (Advanced)

For full control over component setup:

```typescript
import { DesktopAgent } from "@finos/fdc3-sail-desktop-agent"
import { WCPConnector } from "@finos/fdc3-sail-desktop-agent/browser"
import { createInMemoryTransportPair } from "@finos/fdc3-sail-desktop-agent/transports"

// Create linked transport pair
const [daTransport, wcpTransport] = createInMemoryTransportPair()

// Create Desktop Agent
const desktopAgent = new DesktopAgent({
  transport: daTransport,
  appLauncher: myAppLauncher,
  requestIntentResolution: myIntentResolver,
})

// Create WCP Connector
const wcpConnector = new WCPConnector(wcpTransport, {
  getIntentResolverUrl: () => false,
  getChannelSelectorUrl: () => false,
})

// Start both
desktopAgent.start()
wcpConnector.start()
```

## FDC3 API Coverage

### Context Management

- `broadcast()` - Broadcast context to channel
- `addContextListener()` - Listen for context on channels
- `getCurrentContext()` - Get current context for channel

### Channel Management

- `getCurrentChannel()` - Get current user channel
- `joinUserChannel()` - Join user channel
- `leaveCurrentChannel()` - Leave current channel
- `getUserChannels()` - Get available user channels
- `getOrCreateChannel()` - Get or create app channel

### Intent Management

- `raiseIntent()` - Raise intent with optional target
- `raiseIntentForContext()` - Raise intent by context type
- `addIntentListener()` - Listen for specific intents
- `findIntent()` - Find handlers for intent
- `findIntentsByContext()` - Find intents for context type

### App Management

- `getInfo()` - Get desktop agent metadata
- `open()` - Launch applications
- `findInstances()` - Find running app instances
- `getAppMetadata()` - Get app metadata from directory

### Private Channels

- `createPrivateChannel()` - Create private channels
- Private channel context listeners
- Private channel disconnect handling

## Protocol Support

### DACP (Desktop Agent Communication Protocol)

All FDC3 operations use DACP messages. The Desktop Agent handles:

**Request Messages:** `broadcastRequest`, `raiseIntentRequest`, `addContextListenerRequest`, `joinUserChannelRequest`, `openRequest`, `findIntentRequest`, etc.

**Response Messages:** Automatic response generation with proper error handling.

**Event Messages:** `contextEvent`, `intentEvent`, `listenerEvent` for async notifications.

### WCP (Web Connection Protocol)

Browser app connection handshake:

- **WCP1Hello** - App initiates connection
- **WCP3Handshake** - Desktop Agent responds with MessagePort
- **WCP4ValidateAppIdentity** - App validates identity
- **WCP5ValidateAppIdentityResponse** - Desktop Agent confirms
- **WCP6Goodbye** - App disconnects gracefully

## Transport Interface

The Desktop Agent works with any transport implementing this interface:

```typescript
interface Transport {
  send(message: unknown): void
  onMessage(handler: (message: unknown) => void): void
  onDisconnect(handler: () => void): void
  isConnected(): boolean
  getInstanceId(): string | null
  disconnect(): void
}
```

**Built-in Transports:**

- `InMemoryTransport` - Same-process communication
- `MessagePortTransport` - Browser MessagePort API

**Platform SDK Transports:**

- `SocketIOClientTransport` - Browser to server
- `SocketIOServerTransport` - Server-side Socket.IO

## Testing

### Running Tests

```bash
# Run Cucumber BDD tests
npm run test:cucumber --workspace=@finos/fdc3-sail-desktop-agent

# Run unit tests
npm run test --workspace=@finos/fdc3-sail-desktop-agent

# Type checking
npm run typecheck --workspace=@finos/fdc3-sail-desktop-agent
```

### Test Architecture

Tests use a `MockTransport` that simulates DACP message flow:

```typescript
// Tests send DACP messages directly to the transport
const message: RaiseIntentRequest = {
  type: 'raiseIntentRequest',
  meta: { source: { instanceId: 'app-1' }, ... },
  payload: { intent: 'ViewChart', context: {...} }
}

await mockTransport.receiveMessage(message)

// Verify responses
const responses = mockTransport.getMessagesByType('raiseIntentResponse')
expect(responses[0].payload.resolution).toBeDefined()
```

## Development

### Building

```bash
npm run build --workspace=@finos/fdc3-sail-desktop-agent
```

### Key Design Principles

1. **Pure Core**: `DesktopAgent` has zero browser/Node.js dependencies
2. **Transport Abstraction**: All communication via `Transport` interface
3. **WCP in Browser Only**: `WCPConnector` handles browser-specific concerns
4. **Message-Driven Cleanup**: App disconnects flow through transport (WCP6Goodbye)

### Adding New DACP Handlers

1. Create handler in `src/core/handlers/dacp/`:

```typescript
export function handleNewFeatureRequest(message: unknown, context: DACPHandlerContext): void {
  // Validate, process, send response
}
```

2. Register in `src/core/handlers/dacp/index.ts`:

```typescript
const handlerMap = {
  // ...existing handlers
  newFeatureRequest: newHandlers.handleNewFeatureRequest,
}
```

3. Add Cucumber tests in `test/features/` and `test/step-definitions/`.

## Dependencies

### Runtime

- `@finos/fdc3` - Official FDC3 types
- `@finos/fdc3-schema` - FDC3 JSON schemas and type guards

### Peer Dependencies

- `zod` - Runtime validation (optional, for schema validation)

## License

Apache-2.0

## Related

- [FDC3 Specification](https://fdc3.finos.org/docs/api/spec)
- [@finos/fdc3-get-agent](https://www.npmjs.com/package/@finos/fdc3) - Browser-side FDC3 API
- [Sail Platform API](../sail-platform-api/) - Middleware, app launcher, and Sail integrations
