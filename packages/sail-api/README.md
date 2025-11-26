# @finos/sail-api

The core API library for the FDC3 Sail platform. This package provides the fundamental building blocks for creating FDC3 Desktop Agents and connecting clients to them.

It includes:
- **Server Desktop Agent**: `SailServerDesktopAgent` - A transport-agnostic wrapper around the core FDC3 Desktop Agent logic, supporting middleware and various transport layers (e.g., Socket.IO).
- **Browser Desktop Agent**: `createSailBrowserDesktopAgent` - Browser-side Desktop Agent with WCP support.
- **Client APIs**: 
  - `SailServerClientAPI` - Client for connecting to Server Desktop Agent (FDC3 operations)
  - `SailPlatformApi` - Platform API for Sail-specific features (workspaces, layouts, config)
- **Protocol**: Shared message definitions and types for the Sail protocol.

## Installation

```bash
npm install @finos/sail-api
```

## Server Usage

The `SailServerDesktopAgent` is the main entry point for running a Desktop Agent on the server side (e.g., in a Node.js environment). It is designed to be transport-agnostic, meaning it can communicate over different channels (Socket.IO, IPC, etc.) by injecting the appropriate transport adapter.

### Basic Setup with Socket.IO

```typescript
import { Server } from "socket.io";
import { SailServerDesktopAgent, SocketIOTransport } from "@finos/sail-api";

// 1. Create your transport mechanism (e.g., Socket.IO server)
const io = new Server(3000);

io.on("connection", (socket) => {
  // 2. Create a transport adapter for the connection
  const transport = new SocketIOTransport(socket);

  // 3. Initialize the Desktop Agent with the transport
  const agent = new SailServerDesktopAgent({
    transport,
    debug: true
  });

  // 4. Start the agent
  agent.start();

  // Handle cleanup on disconnect
  socket.on("disconnect", () => {
    agent.stop();
  });
});
```

### Middleware

`SailServerDesktopAgent` supports middleware to intercept and process messages before they reach the core agent logic. This is useful for logging, authentication, metrics, or modifying messages.

```typescript
agent.use(async (ctx, next) => {
  console.log(`Incoming message: ${ctx.message.type}`);
  
  // Add custom logic here
  
  await next(); // Proceed to the next middleware or final handler
});
```

## Client Usage

### FDC3 Operations (SailServerClientAPI)

The `SailServerClientAPI` provides a convenient, typed API for clients to communicate with the Server Desktop Agent for FDC3 operations.

```typescript
import { io } from "socket.io-client";
import { SailServerClientAPI } from "@finos/sail-api";

// 1. Connect to the server
const socket = io("http://localhost:3000");

// 2. Initialize the Sail Server Client
const client = new SailServerClientAPI(socket);

// 3. Interact with the agent
async function init() {
  // Send a Hello message to register the client
  await client.desktopAgentHello({
    directories: [],
    channels: [],
    panels: [],
    customApps: [],
    contextHistory: {}
  });

  // Get a list of available apps
  const apps = await client.getDirectoryListing();
  console.log("Available apps:", apps);
}

init();
```

### Sail Platform Features (SailPlatformApi)

The `SailPlatformApi` provides access to Sail-specific features (workspaces, layouts, config) with pluggable storage backends.

```typescript
import { SailPlatformApi } from "@finos/sail-api";

// Default: localStorage (client-side)
const platformApi = new SailPlatformApi();

// Or use remote storage
import { io } from "socket.io-client";
const socket = io("http://localhost:3000");
const platformApi = new SailPlatformApi({
  storage: "remote",
  remote: { socket }
});

// Use the API
const workspaces = await platformApi.getWorkspaces();
await platformApi.saveWorkspaceLayout(workspaceId, layout);
```

## Architecture

### Transport Agnostic
The API is designed to be decoupled from the underlying communication layer. While `SocketIOTransport` is provided out-of-the-box, you can implement the `Transport` interface to support other protocols (e.g., Electron IPC, WebSockets, etc.).

### Protocol
The package exports shared type definitions (`SailMessage`, `SailMessages`, etc.) ensuring type safety across the client-server boundary.

## License

Copyright 2025 Finos. Distributed under the Apache 2.0 License.
