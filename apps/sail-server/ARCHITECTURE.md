# Sail Server Architecture

## Overview

The Sail Server provides a multi-user FDC3 Desktop Agent implementation with proper user isolation and security. Each user/session gets their own Desktop Agent instance, ensuring that apps and data from different users cannot interact.

## Architecture: One Desktop Agent Per User/Session

```
┌─────────────────────────────────────────────────────────────────┐
│                         Sail Server                              │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ User A               │  │ User B               │            │
│  │ ┌──────────────────┐ │  │ ┌──────────────────┐ │            │
│  │ │ Desktop Agent    │ │  │ │ Desktop Agent    │ │            │
│  │ │ - App Registry   │ │  │ │ - App Registry   │ │            │
│  │ │ - Channels       │ │  │ │ - Channels       │ │            │
│  │ │ - Intent Registry│ │  │ │ - Intent Registry│ │            │
│  │ └──────────────────┘ │  │ └──────────────────┘ │            │
│  │         ↕             │  │         ↕             │            │
│  │ ┌──────────────────┐ │  │ ┌──────────────────┐ │            │
│  │ │ Transport        │ │  │ │ Transport        │ │            │
│  │ │ (User A sockets) │ │  │ │ (User B sockets) │ │            │
│  │ └──────────────────┘ │  │ └──────────────────┘ │            │
│  └──────────────────────┘  └──────────────────────┘            │
│           ↕                          ↕                           │
│  ┌──────────────────────────────────────────────────┐           │
│  │         Socket.IO Server (io)                     │           │
│  └──────────────────────────────────────────────────┘           │
└───────────────────────────────┬─────────────────────────────────┘
                                │ WebSocket
                                ↕
        ┌───────────────────────────────────┐
        │      Browser (User A)              │
        │  App1  App2  App3                  │
        │   (Socket.IO clients)              │
        └───────────────────────────────────┘

        ┌───────────────────────────────────┐
        │      Browser (User B)              │
        │  App4  App5                        │
        │   (Socket.IO clients)              │
        └───────────────────────────────────┘
```

## Key Components

### 1. User Identification

Users are identified via Socket.IO handshake authentication:

```typescript
io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId // From JWT, session, etc.

  if (!userId) {
    return next(new Error("Authentication required"))
  }

  socket.data.userId = userId
  next()
})
```

**Production Implementation Options:**

1. **JWT Token** (Recommended):
   ```typescript
   // Client
   const socket = io("https://server.com", {
     auth: {
       token: "Bearer eyJhbGc..."
     }
   })

   // Server
   const decoded = verifyJWT(socket.handshake.auth.token)
   const userId = decoded.sub // User ID from token
   ```

2. **Session Cookie**:
   ```typescript
   // Server uses express-session
   const session = await getSession(socket.handshake.headers.cookie)
   const userId = session.userId
   ```

3. **API Key**:
   ```typescript
   // Client
   const socket = io("https://server.com", {
     auth: { apiKey: "..." }
   })

   // Server validates API key and gets userId
   ```

**Development Fallback:**

In development mode, if no userId is provided, the server uses `socket.id` as a fallback:

```typescript
if (process.env.NODE_ENV === "development") {
  return `dev:${socket.id}`
}
```

This allows testing without authentication but creates one agent per socket (not recommended for production).

### 2. Desktop Agent Management

The server maintains a map of `userId` → `UserAgentInfo`:

```typescript
interface UserAgentInfo {
  agent: SailDesktopAgent           // The Desktop Agent instance
  transport: SocketIOServerTransport // User-specific transport
  createdAt: Date                    // When agent was created
  lastActivity: Date                 // Last message timestamp
}

const userAgents = new Map<string, UserAgentInfo>()
```

When a socket connects:
1. Authenticate and get `userId`
2. Get or create Desktop Agent for that `userId`
3. Register the socket with the user's transport
4. Multiple sockets from the same user share the same Desktop Agent

### 3. Transport Layer (SocketIOServerTransport)

Each user gets their own `SocketIOServerTransport` instance that:

- **Tracks sockets**: Maintains a set of socket IDs belonging to this user
- **Routes messages**: Sends messages only to sockets owned by this user
- **Security boundary**: Prevents cross-user message delivery
- **Multi-device support**: Allows same user to connect from multiple devices/tabs

```typescript
class SocketIOServerTransport implements Transport {
  private userSockets = new Set<string>()     // socket IDs
  private readonly userId: string

  constructor(io: Server, userId: string) {
    this.userId = userId
  }

  registerSocket(socket: Socket): void {
    this.userSockets.add(socket.id)
    // Set up message handlers...
  }

  send(message: unknown): void {
    // Extract destination instanceId from message
    // Route only to sockets owned by this user
    // SECURITY: Verify socket belongs to this.userId
  }
}
```

### 4. Session Lifecycle

#### Connection
```
1. Client connects → Socket.IO handshake
2. Server authenticates → Extract userId
3. Get or create Desktop Agent for userId
4. Register socket with user's transport
5. Apps can start sending FDC3 messages
```

#### Active Session
```
- Multiple apps/tabs can connect with same userId
- All share the same Desktop Agent state
- Messages routed by instanceId within user's Desktop Agent
- lastActivity timestamp updated on each message
```

#### Disconnection
```
1. Socket disconnects
2. Transport unregisters the socket
3. If user has other active sockets → Keep Desktop Agent running
4. If no active sockets → Mark for cleanup (after timeout)
```

#### Cleanup
```
Periodic task (every 5 minutes):
- Check each Desktop Agent
- If no active sockets AND inactive for > 30 minutes
  → Stop Desktop Agent
  → Disconnect transport
  → Remove from userAgents map
```

## Security Features

### 1. User Isolation

- Each user has their own Desktop Agent instance
- Separate app registries, channels, and intent registries
- User A cannot see or interact with User B's apps

### 2. Transport-Level Security

```typescript
send(message: unknown): void {
  // SECURITY CHECK: Verify socket belongs to this user
  if (!this.userSockets.has(targetSocket.id)) {
    console.error("SECURITY: Attempted to send to socket not owned by user")
    return
  }

  targetSocket.emit("fdc3_message", message)
}
```

### 3. Authentication Required

In production, sockets without valid authentication are rejected:

```typescript
io.use((socket, next) => {
  if (!userId) {
    return next(new Error("Authentication required"))
  }
  next()
})
```

## Configuration

### Environment Variables

```bash
# Server port
PORT=8080

# Debug mode (verbose logging)
DEBUG=true

# Node environment (affects authentication fallback)
NODE_ENV=production
```

### Timeouts

```typescript
// Session timeout (inactive users)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000  // 30 minutes

// Cleanup interval
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes
```

## Multi-Device Support

The same user can connect from multiple devices/browsers:

```
User Alice:
  - Desktop Browser (Socket 1, 2, 3)  ─┐
  - Laptop Browser (Socket 4)         ├─→ Same Desktop Agent
  - Mobile Browser (Socket 5)         ─┘
```

All devices share:
- App instances
- User channels
- Private channels
- Intent handlers

## Scaling Considerations

### Vertical Scaling
Current implementation supports vertical scaling:
- Multiple users per server
- Limited by server memory and CPU
- Desktop Agent state is in-memory

### Horizontal Scaling (Future)
For horizontal scaling across multiple servers:

1. **Session Affinity**: Route all sockets for a user to the same server
2. **Shared State**: Use Redis or similar for Desktop Agent state
3. **Pub/Sub**: Use Redis Pub/Sub for cross-server message delivery

```
Load Balancer (Session Affinity by userId)
     ↓
┌────────────┐  ┌────────────┐  ┌────────────┐
│ Server 1   │  │ Server 2   │  │ Server 3   │
│ User A, B  │  │ User C, D  │  │ User E, F  │
└────────────┘  └────────────┘  └────────────┘
     ↓               ↓               ↓
     └───────────────┴───────────────┘
              ↓
        ┌──────────┐
        │  Redis   │
        │  (State) │
        └──────────┘
```

## Monitoring

### Logs

The server logs key events:
- `✨ Creating Desktop Agent for user: <userId>`
- `🔌 User <userId> connected: <socketId>`
- `📊 User <userId> now has X connected socket(s)`
- `🧹 Cleaning up inactive Desktop Agent for user <userId>`

### Metrics to Track

- Number of active Desktop Agents (`userAgents.size`)
- Number of connected sockets per user
- Session duration (from `createdAt` to cleanup)
- Message throughput
- Cleanup frequency

## Troubleshooting

### Issue: User can't connect

**Check:**
1. Is authentication working? (Check logs for `❌ Authentication failed`)
2. Is userId being extracted correctly?
3. Are CORS settings correct for the client origin?

### Issue: Apps can't communicate within same user

**Check:**
1. Are all apps using the same `userId`?
2. Check transport stats: `transport.getStats()`
3. Verify instanceId routing in messages

### Issue: Memory leak / agents not cleaning up

**Check:**
1. Are sockets properly disconnecting?
2. Is the cleanup interval running? (Check logs for `🧹 Cleaning up`)
3. Verify `SESSION_TIMEOUT_MS` is appropriate

### Issue: Cross-user data leakage

**This should NEVER happen.** If it does:
1. Check that each user has a separate Desktop Agent instance
2. Verify transport security checks are working
3. Review authentication middleware

## Development vs Production

### Development Mode
- Allows fallback to `socket.id` as userId
- More verbose logging
- May skip authentication for testing

### Production Mode
- Requires authentication on all connections
- No fallback userId generation
- Stricter error handling
- Should use JWT or session-based auth

## Related Documentation

- [Transport Architecture](../../packages/desktop-agent/TRANSPORT.md)
- [Desktop Agent Core](../../packages/desktop-agent/README.md)
- [Sail API](../../packages/sail-api/README.md)