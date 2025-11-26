# FDC3 Sail Documentation

Welcome to the FDC3 Sail documentation. This guide will help you understand the architecture, use the APIs, and contribute to the project.

## 📚 Documentation Structure

### Getting Started
- **[Quick Start](#quick-start)** - Get up and running in 5 minutes
- **[Development Guide](./DEVELOPMENT.md)** - Setup and contribution workflow

### Architecture
- **[System Architecture](./architecture/OVERVIEW.md)** - High-level system design and principles
- **[Package Architecture](./architecture/packages/)** - Deep dives into each package

### API Reference
- **[@finos/fdc3-sail-desktop-agent](../packages/desktop-agent/README.md)** - Pure FDC3 engine
- **[@finos/sail-api](../packages/sail-api/README.md)** - Sail platform services
- **[@finos/sail-ui](../packages/sail-ui/README.md)** - Shared UI components

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 8+

### Installation

```bash
git clone https://github.com/finos/FDC3-Sail.git
cd FDC3-Sail
npm install
```

### Running the Application

```bash
# Start the server (backend)
npm run dev:server

# Start the Sail UI (frontend) in a new terminal
npm run dev:sail

# Open http://localhost:5173
```

### Running Example Apps

```bash
# Start example FDC3 applications
npm run dev:apps

# Example apps will be available at http://localhost:5174
```

---

## Architecture at a Glance

FDC3 Sail is built on a **clean, layered architecture**:

```
┌─────────────────────────────────────────────────────────┐
│  Sail UI (apps/sail)                                    │
│  - React application shell                              │
│  - WCP integration for iframe apps                      │
│  - Sail-controlled UI (channel selector, intent resolver)│
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Sail API (@finos/sail-api)                             │
│  - SailServerDesktopAgent (server-side wrapper)         │
│  - SailBrowserDesktopAgent (browser-side wrapper)       │
│  - SailPlatformApi (workspaces, layouts, config)        │
│  - Transport implementations (Socket.IO, MessagePort)   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  Desktop Agent (@finos/fdc3-sail-desktop-agent)         │
│  - Pure FDC3 2.2 implementation                         │
│  - Transport-agnostic DACP message processing           │
│  - State registries (apps, intents, channels)           │
│  - Environment-independent (no browser/Node.js deps)    │
└─────────────────────────────────────────────────────────┘
```

### Key Principles

1. **FDC3 Compliance**: Strict adherence to FDC3 2.2 standards (DACP, WCP)
2. **Separation of Concerns**: Pure FDC3 engine vs. platform services
3. **Transport Agnostic**: Desktop Agent works with any message transport
4. **Environment Independent**: Core logic has zero runtime dependencies

---

## Project Structure

```
FDC3-Sail/
├── packages/
│   ├── desktop-agent/      # Pure FDC3 Desktop Agent (core engine)
│   ├── sail-api/           # Sail platform services & wrappers
│   ├── sail-ui/            # Shared UI components
│   └── app-directories/    # FDC3 app metadata
├── apps/
│   ├── sail/               # Sail UI (React frontend)
│   ├── sail-server/        # Server runtime (Node.js backend)
│   └── example-fdc3-apps/  # Demo FDC3 applications
└── docs/
    ├── README.md           # This file
    ├── DEVELOPMENT.md      # Developer guide
    └── architecture/       # Architecture documentation
```

---

## Common Use Cases

### Using the Desktop Agent (Server-Side)

```typescript
import { SailServerDesktopAgent, SocketIOTransport } from "@finos/sail-api"
import { Server } from "socket.io"

const io = new Server(3000)

io.on("connection", (socket) => {
  const transport = new SocketIOTransport(socket)
  const agent = new SailServerDesktopAgent({ transport })
  agent.start()

  socket.on("disconnect", () => agent.stop())
})
```

### Using the Desktop Agent (Browser-Side)

```typescript
import { createSailBrowserDesktopAgent } from "@finos/sail-api"

const { desktopAgent, wcpConnector, start } = createSailBrowserDesktopAgent({
  wcpOptions: {
    getIntentResolverUrl: () => false,  // Sail provides UI externally
    getChannelSelectorUrl: () => false,
    fdc3Version: '2.2'
  }
})

start()
```

### Using the Platform API (Workspaces/Layouts)

```typescript
import { SailPlatformApi } from "@finos/sail-api"

// Default: localStorage
const platformApi = new SailPlatformApi()

// Or use remote storage
const platformApi = new SailPlatformApi({
  storage: "remote",
  remote: { socket: io("http://localhost:3000") }
})

// Use the API
const workspaces = await platformApi.getWorkspaces()
await platformApi.saveWorkspaceLayout(workspaceId, layout)
```

---

## Key Concepts

### Desktop Agent vs. Platform Services

**Desktop Agent** (`@finos/fdc3-sail-desktop-agent`):
- Pure FDC3 2.2 implementation
- Manages apps, channels, intents, private channels
- Processes DACP messages
- Transport-agnostic (no Socket.IO, no MessagePort dependencies)

**Platform Services** (`@finos/sail-api`):
- Wraps Desktop Agent for different environments (server, browser)
- Adds Sail-specific features (workspaces, layouts, config)
- Provides transport implementations
- Middleware support (logging, auth, metrics)

### Transport Layer

The transport layer is abstracted via the `Transport` interface, allowing the Desktop Agent to work with:
- **Socket.IO** - Remote Desktop Agent (multi-user, server-side)
- **MessagePort** - Local Desktop Agent (iframe communication)
- **InMemory** - Same-process communication (testing, WCP connector)

### WCP Integration

FDC3 apps connect using the standard [Web Connection Protocol (WCP)](https://fdc3.finos.org/docs/api/specs/webConnectionProtocol):

1. App calls `fdc3.getAgent()`
2. App sends `WCP1Hello` via `window.postMessage`
3. Sail creates `MessageChannel` and sends `WCP3Handshake` with port
4. App validates identity via `WCP4ValidateAppIdentity`
5. Desktop Agent processes DACP messages over the MessagePort

### Sail-Controlled UI

Sail uses **Option 2: External UI** from the FDC3 spec:
- Channel selector and intent resolver are React components in the Sail UI
- Apps receive standard DACP events (e.g., `userChannelChangedEvent`)
- No injected iframes - cleaner, faster, more testable

---

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md) for:
- Setup instructions
- Code quality requirements
- Contribution workflow
- Testing guidelines

---

## Further Reading

### Architecture Deep Dives
- [System Architecture Overview](./architecture/OVERVIEW.md)
- [Desktop Agent Architecture](./architecture/packages/DESKTOP_AGENT.md)
- [Sail API Architecture](./architecture/packages/SAIL_API.md)
- [Transport Layer](./architecture/TRANSPORT.md)
- [WCP Integration](./architecture/WCP_INTEGRATION.md)

### Specifications
- [FDC3 2.2 Specification](https://fdc3.finos.org/docs/api/spec)
- [DACP (Desktop Agent Communication Protocol)](https://fdc3.finos.org/docs/api/specs/desktopAgentCommunicationProtocol)
- [WCP (Web Connection Protocol)](https://fdc3.finos.org/docs/api/specs/webConnectionProtocol)

---

## License

Copyright 2025 FINOS. Distributed under the Apache 2.0 License.
