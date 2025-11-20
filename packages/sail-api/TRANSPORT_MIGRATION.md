# Sail-API Transport Migration Guide

## Overview

The `@finos/fdc3-sail-desktop-agent` package has been updated to use a new Transport API. The sail-api package needs to be updated to align with these changes.

## Key Changes in Desktop-Agent

### 1. Transport `send()` Method Signature Change

**Old API:**
```typescript
transport.send(instanceId: string, message: unknown): void
```

**New API:**
```typescript
transport.send(message: unknown): void
```

The routing information (`instanceId`) is now embedded in the message metadata instead of being a parameter.

### 2. Added `getInstanceId()` Method

All Transport implementations must now implement:
```typescript
getInstanceId(): string | null
```

This returns:
- `null` for shared transports (MessagePort, InMemory)
- `string` for per-instance transports (Socket.IO when used per-app)

## Required Changes

### File: `packages/sail-api/src/adapters/socket-io-transport.ts`

#### Change 1: Update `send()` method signature

**Current (INCORRECT):**
```typescript
send(instanceId: string, message: unknown): void {
  if (!this.socket.connected) {
    throw new Error(`Cannot send message: socket disconnected (instance: ${instanceId})`)
  }
  this.socket.emit("fdc3_message", message)
}
```

**Updated (CORRECT):**
```typescript
send(message: unknown): void {
  if (!this.socket.connected) {
    throw new Error("Cannot send message: socket disconnected")
  }

  // Message already contains routing metadata in message.meta.destination.instanceId
  this.socket.emit("fdc3_message", message)
}
```

#### Change 2: Update `getInstanceId()` implementation

The current implementation stores an instanceId, but this needs to be reviewed based on your architecture choice (see Architecture Decision below).

**If using Option 1 (One Desktop Agent globally):**
```typescript
getInstanceId(): string | null {
  // Socket.IO transport is a shared pipe for multiple apps
  return null
}
```

**If using Option 2 (One Desktop Agent per socket - current but incorrect):**
```typescript
getInstanceId(): string | null {
  // This socket represents a specific connection
  // But this is the wrong architecture - see below
  return this.instanceId
}
```

## Architecture Decision Required

### Current Architecture (INCORRECT)

**Problem:** `apps/sail-server/src/main.ts` creates a new Desktop Agent for EVERY socket connection:

```typescript
io.on("connection", socket => {
  // ❌ Creates separate Desktop Agent per socket
  const agent = new SailDesktopAgent({ socket })
  agent.start()
  agentInstances.set(socket.id, agent)
})
```

**Issue:** If App 1 and App 2 connect via different sockets, they get different Desktop Agents and cannot communicate with each other (no shared channels, no intents, etc.).

### Solution Options

You need to choose ONE of these architectures:

#### **Option 1: One Global Desktop Agent (Simplest)**

All browser windows share the same Desktop Agent instance.

**Pros:**
- Simplest implementation
- Apps across ALL browser windows can communicate
- Shared state across entire application

**Cons:**
- No isolation between browser windows/sessions
- All users share the same channels if deployed as multi-user system

**Implementation:**
```typescript
// apps/sail-server/src/main.ts

import { Server } from "socket.io"
import { DesktopAgent } from "@finos/fdc3-sail-desktop-agent"
import { SocketIOServerTransport } from "./transports/socket-io-server-transport" // New file needed

const io = new Server(8080)

// Create ONE global Desktop Agent
const globalTransport = new SocketIOServerTransport(io) // Manages ALL sockets
const desktopAgent = new DesktopAgent({ transport: globalTransport })
desktopAgent.start()

// No per-connection logic needed - transport handles routing
io.on("connection", socket => {
  console.log("Socket connected:", socket.id)
  // Transport will handle this socket automatically
})
```

You'll need to create `SocketIOServerTransport` that manages multiple sockets internally.

#### **Option 2: One Desktop Agent per Browser Window (Recommended)**

Each browser window gets its own Desktop Agent instance, identified by a persistent window ID.

**Pros:**
- Apps within a browser window can communicate
- Isolation between windows
- Supports multi-user scenarios
- State persists across page refreshes (via window ID)

**Cons:**
- More complex implementation
- Requires window ID tracking (IndexedDB on client)
- Requires session management on server

**Implementation Overview:**

1. **Client-side:** Generate and store a window ID in IndexedDB
2. **Client-side:** Send window ID during Socket.IO connection handshake
3. **Server-side:** Map window IDs to Desktop Agent instances
4. **Server-side:** Route socket connections to the correct Desktop Agent

**Server changes:**
```typescript
// apps/sail-server/src/main.ts

const windowAgents = new Map<string, DesktopAgent>()

io.on("connection", async socket => {
  // Get window ID from handshake auth
  const windowId = socket.handshake.auth.windowId

  if (!windowId) {
    socket.disconnect()
    return
  }

  // Get or create Desktop Agent for this window
  let agent = windowAgents.get(windowId)
  if (!agent) {
    const transport = new SocketIOWindowTransport(windowId, io) // New implementation
    agent = new DesktopAgent({ transport })
    agent.start()
    windowAgents.set(windowId, agent)
  }

  // Register this socket with the window's transport
  // The transport will route messages from this socket to the Desktop Agent
})
```

**Client changes:**
```typescript
// packages/sail-api/src/client/SailClient.ts

import { getOrCreateWindowId } from "./window-identity"

async connect() {
  const windowId = await getOrCreateWindowId() // From IndexedDB

  this.socket = io(serverUrl, {
    auth: { windowId }
  })

  // Rest of connection logic...
}
```

#### **Option 3: One Desktop Agent per Session (Future)**

Similar to Option 2, but uses session ID (from authentication) instead of window ID.

## Recommended Approach

**For immediate fix:** Start with **Option 1** (simplest)

**For production:** Implement **Option 2** (window-based isolation)

## Migration Checklist

- [ ] Update `SocketIOTransport.send()` to remove `instanceId` parameter
- [ ] Update `SocketIOTransport.getInstanceId()` based on architecture choice
- [ ] Decide on architecture (Option 1, 2, or 3)
- [ ] If Option 1: Create `SocketIOServerTransport` that manages all sockets
- [ ] If Option 2: Implement window ID tracking (IndexedDB + handshake)
- [ ] Update `apps/sail-server/src/main.ts` based on chosen architecture
- [ ] Update tests to match new Transport API
- [ ] Update any middleware that depends on Transport.send()

## Testing

After migration, verify:

1. **Cross-app communication:** Apps can broadcast context to each other
2. **User channels:** Apps can join channels and receive broadcasts
3. **Intents:** Apps can raise intents and receive them
4. **Reconnection:** Socket reconnects don't create duplicate Desktop Agents
5. **Multiple windows:** (Option 2 only) Apps in different windows are isolated

## Questions?

Contact the desktop-agent team or refer to:
- `packages/desktop-agent/TRANSPORT.md` - Transport architecture
- `packages/desktop-agent/src/core/interfaces/transport.ts` - Transport interface definition
