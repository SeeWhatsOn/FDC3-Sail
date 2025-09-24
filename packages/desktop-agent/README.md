# FDC3 Sail Desktop Agent

A fully compliant FDC3 Desktop Agent implementation that supports the complete Desktop Agent Communication Protocol (DACP) specification while remaining transport-agnostic.

## Overview

This package provides a production-ready FDC3 Desktop Agent that manages application instances, channels, intents, and private channels according to the [FDC3 2.2 specification](https://fdc3.finos.org/docs/api/spec). It's designed to be transport-agnostic, supporting both MessagePort (DACP) and Socket.IO communication protocols.

**Key Features:**
- ✅ **Full FDC3 2.2 Compliance**: All mandatory Desktop Agent APIs implemented
- ✅ **DACP Protocol Support**: Complete Desktop Agent Communication Protocol implementation
- ✅ **Transport Agnostic**: Works with MessagePort, Socket.IO, WebSocket, or any message transport
- ✅ **State Management**: Comprehensive app, channel, and intent registry management
- ✅ **Type Safety**: Built with TypeScript and Zod validation
- ✅ **Production Ready**: Comprehensive test coverage and error handling

## Architecture

```
packages/desktop-agent/
├── src/
│   ├── handlers/
│   │   ├── dacp/                    # FDC3 DACP message handlers
│   │   │   ├── channel.handlers.ts  # Channel management
│   │   │   ├── context.handlers.ts  # Context broadcasting/listening
│   │   │   ├── intent.handlers.ts   # Intent resolution
│   │   │   └── index.ts            # Message router
│   │   └── validation/             # DACP message validation
│   │       ├── dacp-schemas.ts     # Zod schemas for DACP messages
│   │       └── dacp-validator.ts   # Validation utilities
│   ├── state/                      # Core state management
│   │   ├── AppInstanceRegistry.ts  # App instance lifecycle
│   │   ├── IntentRegistry.ts       # Intent handler registration
│   │   └── PrivateChannelRegistry.ts # Private channel management
│   ├── app-directory/              # FDC3 app directory
│   └── index.ts                    # Main exports
└── ARCHITECTURE.md                 # Detailed architecture docs
```

## Quick Start

### Installation

```bash
npm install @finos/fdc3-sail-desktop-agent
```

### Basic Usage

#### MessagePort (DACP) Setup

```typescript
import { registerDACPHandlers } from '@finos/fdc3-sail-desktop-agent'

// After WCP handshake establishes MessagePort
const messagePort = /* obtained from WCP handshake */
const serverContext = /* your app instance manager */
const fdc3Server = /* your FDC3 server instance */

// Register DACP handlers
registerDACPHandlers(messagePort, serverContext, fdc3Server)

console.log('FDC3 Desktop Agent ready for DACP messages')
```

#### Socket.IO Integration

```typescript
import { initSocketService } from '@finos/fdc3-sail-desktop-agent'
import { Server } from 'socket.io'

const io = new Server(httpServer)

// Initialize FDC3 handlers on socket connections
io.on('connection', (socket) => {
  initSocketService(socket, serverContext)
})
```

## FDC3 API Coverage

### ✅ Implemented APIs

**Context Management:**
- `broadcast()` - Broadcast context to channel
- `addContextListener()` - Listen for context on channels
- `getCurrentContext()` - Get current context for channel

**Channel Management:**
- `getCurrentChannel()` - Get current user channel
- `joinUserChannel()` - Join user channel
- `leaveCurrentChannel()` - Leave current channel
- `getUserChannels()` - Get available user channels
- `getOrCreateChannel()` - Get or create app channel

**Intent Management:**
- `raiseIntent()` - Raise intent with optional target
- `raiseIntentForContext()` - Raise intent by context type
- `addIntentListener()` - Listen for specific intents
- `findIntent()` - Find handlers for intent
- `findIntentsByContext()` - Find intents for context type

**App Management:**
- `getInfo()` - Get desktop agent metadata
- `open()` - Launch applications
- `findInstances()` - Find running app instances
- `getAppMetadata()` - Get app metadata from directory

**Private Channels:**
- `createPrivateChannel()` - Create private channels
- Private channel event listeners
- Private channel disconnect handling

## DACP Message Types

This desktop agent handles all standard DACP message types:

**Request Messages:**
- `broadcastRequest`
- `addContextListenerRequest`
- `raiseIntentRequest`
- `addIntentListenerRequest`
- `getCurrentChannelRequest`
- `joinUserChannelRequest`
- `getInfoRequest`
- `openRequest`
- `findInstancesRequest`
- `createPrivateChannelRequest`
- And many more...

**Response Messages:**
- Automatic response generation for all request types
- Proper error handling with standard FDC3 error types

**Event Messages:**
- `contextEvent` - Context broadcast notifications
- `intentEvent` - Intent delivery to handlers
- `listenerEvent` - Listener lifecycle notifications

## Configuration

### Environment Variables

```bash
# Optional: Enable debug logging
DEBUG=fdc3-desktop-agent:*

# Optional: Configure timeouts (milliseconds)
FDC3_DEFAULT_TIMEOUT=10000
FDC3_APP_LAUNCH_TIMEOUT=100000
```

### TypeScript Configuration

```typescript
import type { DACPHandlerContext } from '@finos/fdc3-sail-desktop-agent'

// Extend the handler context if needed
interface CustomHandlerContext extends DACPHandlerContext {
  customProperty: string
}
```

## State Management

The desktop agent maintains several registries for FDC3 entities:

### App Instance Registry

Tracks all connected applications and their state:

```typescript
import { AppInstanceRegistry } from '@finos/fdc3-sail-desktop-agent'

const registry = new AppInstanceRegistry()

// Register new app instance
registry.register({
  instanceId: 'app-123',
  appId: 'my-trading-app',
  state: State.Connected,
  started: new Date(),
  metaData: appMetadata,
  currentChannel: 'red'
})

// Find instances
const instances = registry.getInstancesByApp('my-trading-app')
```

### Intent Registry

Manages intent handlers across all applications:

```typescript
import { IntentRegistry } from '@finos/fdc3-sail-desktop-agent'

const intentRegistry = new IntentRegistry()

// Register intent handler
intentRegistry.registerHandler({
  appId: 'chart-app',
  instanceId: 'chart-123',
  intent: 'ViewChart',
  contexts: ['fdc3.instrument', 'fdc3.portfolio'],
  metadata: appMetadata
})

// Find handlers for intent
const handlers = intentRegistry.findHandlers('ViewChart', 'fdc3.instrument')
```

### Private Channel Registry

Manages private channels and their participants:

```typescript
import { PrivateChannelRegistry } from '@finos/fdc3-sail-desktop-agent'

const channelRegistry = new PrivateChannelRegistry()

// Create private channel
const channel = channelRegistry.create('creator-instance-id')

// Add participants
channelRegistry.addParticipant(channel.id, 'participant-instance-id')
```

## Error Handling

The desktop agent provides comprehensive error handling following FDC3 specifications:

```typescript
// DACP errors are automatically handled and sent as response messages
{
  "type": "broadcastResponse",
  "payload": {
    "error": "ChannelError"  // Standard FDC3 error type
  },
  "meta": {
    "responseUuid": "...",
    "requestUuid": "...",
    "timestamp": "2024-09-24T10:00:00Z"
  }
}
```

**Standard Error Types:**
- `AgentError` - General desktop agent errors
- `ChannelError` - Channel operation failures
- `IntentDeliveryFailed` - Intent routing failures
- `AppNotFound` - Application not in directory
- `CreationFailed` - Resource creation failures

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- channel.handlers.test.ts

# Run with coverage
npm test -- --coverage

# Run tests in watch mode
npm run test:watch
```

### Integration Testing

```typescript
import { describe, it, expect } from 'vitest'
import { registerDACPHandlers } from '@finos/fdc3-sail-desktop-agent'

describe('FDC3 Desktop Agent Integration', () => {
  it('should handle complete broadcast flow', async () => {
    const { port1, port2 } = new MessageChannel()

    registerDACPHandlers(port1, mockServerContext, mockFdc3Server)

    // Send broadcast request
    port2.postMessage({
      type: 'broadcastRequest',
      payload: {
        channelId: 'red',
        context: { type: 'fdc3.instrument', id: { ticker: 'AAPL' } }
      },
      meta: {
        requestUuid: 'test-123',
        timestamp: new Date()
      }
    })

    // Verify response
    const response = await waitForMessage(port2)
    expect(response.type).toBe('broadcastResponse')
    expect(response.payload.error).toBeUndefined()
  })
})
```

## Development

### Building

```bash
# Build the package
npm run build

# Build and watch for changes
npm run build:watch

# Type checking
npm run typecheck
```

### Contributing

1. **Follow the Architecture**: Keep FDC3 logic separate from transport concerns
2. **Add Tests**: All new handlers must have integration tests
3. **Update Schemas**: Regenerate DACP schemas when FDC3 spec updates
4. **Maintain Types**: Use official FDC3 types from `@finos/fdc3`

### Adding New DACP Handlers

1. **Create Handler Function:**
```typescript
// src/handlers/dacp/new-feature.handlers.ts
export async function handleNewFeatureRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const request = validateDACPMessage(message, NewFeatureRequestSchema)
  // Implementation
  const response = createDACPSuccessResponse(request, 'newFeatureResponse', result)
  context.messagePort.postMessage(response)
}
```

2. **Register in Router:**
```typescript
// src/handlers/dacp/index.ts
const handlerMap = {
  // ... existing handlers
  'newFeatureRequest': newFeatureHandlers.handleNewFeatureRequest,
}
```

3. **Add Tests:**
```typescript
// src/handlers/dacp/__tests__/new-feature.test.ts
describe('New Feature Handler', () => {
  it('should handle new feature request', async () => {
    // Test implementation
  })
})
```

## Dependencies

### Runtime Dependencies
- `@finos/fdc3` - Official FDC3 types and interfaces
- `zod` - Runtime type validation for DACP messages
- `uuid` - Unique identifier generation

### Development Dependencies
- `typescript` - Type safety and compilation
- `vitest` - Fast unit testing framework
- `@types/node` - Node.js type definitions

## Related Packages

- [`@apps/sail-socket`](../../apps/sail-socket/) - Socket server with Sail platform integration
- [`@packages/sail-app`](../sail-app/) - Frontend application using FDC3

## License

ISC

## Support

- **Documentation**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design
- **Implementation Guide**: See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for development roadmap
- **FDC3 Specification**: [https://fdc3.finos.org/docs/api/spec](https://fdc3.finos.org/docs/api/spec)

## Changelog

### 0.0.1
- Initial implementation with core DACP handlers
- App instance, intent, and private channel registries
- Complete FDC3 2.2 API coverage
- Transport-agnostic architecture