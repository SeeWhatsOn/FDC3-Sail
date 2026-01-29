---
sidebar_position: 2
---

# Desktop Agent Architecture

## Package: @finos/sail-desktop-agent

**Purpose**: Pure, environment-agnostic FDC3 2.2 Desktop Agent implementation

**Location**: `packages/desktop-agent/`

## Design Philosophy

The Desktop Agent package is designed with one overriding principle: **complete environment independence**.

### Zero Dependencies

The core Desktop Agent has **zero runtime dependencies** on:
- Browser APIs (`window`, `document`, `MessagePort`)
- Node.js APIs (`fs`, `http`, `process`)
- Transport mechanisms (Socket.IO, WebSockets)
- UI frameworks (React, Vue, etc.)

The only runtime dependencies are:
- `@finos/fdc3` - Official FDC3 types and errors
- `@finos/fdc3-schema` - FDC3 JSON schemas and type guards
- `immer` - Immutable state updates

### Why This Matters

**Portability**: Runs anywhere JavaScript runs
- Node.js servers
- Browser windows
- Web Workers
- Electron main/renderer processes

**Testability**: Easy to test with mock transports

**Reusability**: Core logic can be extracted to standalone library

## Package Structure

```
packages/desktop-agent/
├── src/
│   ├── core/                           # Main export (environment-agnostic)
│   │   ├── desktop-agent.ts            # Main DesktopAgent class
│   │   ├── handlers/
│   │   │   └── dacp/                   # DACP message handlers
│   │   ├── state/                      # Functional state management
│   │   │   ├── types.ts                # AgentState type definitions
│   │   │   ├── initial-state.ts        # State factory functions
│   │   │   ├── selectors/              # State query functions
│   │   │   └── mutators/               # State mutation functions
│   │   ├── app-directory/              # App metadata
│   │   └── interfaces/                 # Interfaces ONLY
│   ├── browser/                        # Browser submodule (tree-shakeable)
│   │   ├── wcp-connector.ts            # WCP1-3 handler
│   │   └── message-port-transport.ts
│   └── transports/                     # Transport implementations
│       └── in-memory-transport.ts
```

## Module Exports

### Core (Default Export)

```typescript
import { DesktopAgent } from "@finos/sail-desktop-agent"
```

### Browser Submodule

```typescript
import { WCPConnector } from "@finos/sail-desktop-agent/browser"
```

### Transports Submodule

```typescript
import { InMemoryTransport } from "@finos/sail-desktop-agent/transports"
```

## Core Components

### DesktopAgent Class

```typescript
class DesktopAgent {
  constructor(config?: {
    transport?: Transport
    appLauncher?: AppLauncher
    appDirectoryManager?: AppDirectoryManager
    apps?: DirectoryApp[]
    userChannels?: Channel[]
    requestIntentResolution?: IntentResolutionCallback
    validator?: MessageValidator
    logger?: Logger
    initialState?: Partial<AgentState>
  })

  start(): void
  stop(): void
}
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

## Functional State Management

The Desktop Agent uses a **functional state pattern** with immutable updates.

### Selectors

Pure functions that query state without modification:

```typescript
import { getInstanceById, getIntentListeners } from "./state/selectors"

const instance = getInstanceById(state, instanceId)
const listeners = getIntentListeners(state, intentName)
```

### Mutators

Pure functions that return new state:

```typescript
import { addInstance, removeInstance } from "./state/mutators"

const newState = addInstance(state, newInstance)
```

## API Examples

### Creating Desktop Agent

```typescript
import { DesktopAgent } from "@finos/sail-desktop-agent"

const agent = new DesktopAgent({
  apps: [
    { appId: "my-app", title: "My App", type: "web", details: { url: "..." } }
  ],
  requestIntentResolution: async (options) => {
    // Show UI and return user selection
    return selectedApp
  }
})

agent.start()
```

### Custom App Launcher

```typescript
import type { AppLauncher } from "@finos/sail-desktop-agent"

class MyAppLauncher implements AppLauncher {
  async launchApp(appId: string, context?: Context): Promise<AppInstance> {
    // Custom launch logic
    return { instanceId: "custom-instance", appId }
  }
}

const agent = new DesktopAgent({
  appLauncher: new MyAppLauncher()
})
```

## Testing

### Unit Tests with Mock Transport

```typescript
const mockTransport = new MockTransport()
const agent = new DesktopAgent({ transport: mockTransport })

mockTransport.simulateReceive(broadcastRequest)
expect(mockTransport.sent[0].type).toBe("broadcastResponse")
```

### Cucumber BDD Tests

```bash
npm run test:cucumber --workspace=@finos/sail-desktop-agent
```
