/**
 * Sail Server - FDC3 Desktop Agent Server
 * Handles Socket.IO transport and FDC3 Desktop Agent protocol
 *
 * Architecture: One Desktop Agent per user/session for proper isolation
 */

import { Server } from "socket.io"
import { SailDesktopAgent } from "@finos/sail-api"
import { APP_CONFIG } from "./constants"
import dotenv from "dotenv"
import { AppDirectoryManager } from "@finos/fdc3-sail-desktop-agent"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"

dotenv.config()

const port = process.env.PORT || APP_CONFIG.DEFAULT_PORT
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

import { SocketIOServerTransport } from "@finos/sail-api/dist/adapters/socket-io-server-transport"

// Create Socket.IO server
const io = new Server(Number(port), {
  cors: {
    origin: Array.from(APP_CONFIG.CORS_ORIGINS),
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Track Desktop Agent instances per user/session
interface UserAgentInfo {
  agent: SailDesktopAgent
  transport: SocketIOServerTransport
  createdAt: Date
  lastActivity: Date
}

const userAgents = new Map<string, UserAgentInfo>()

// Configuration
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes of inactivity
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // Check every 5 minutes

// Load app directories
const appDirectory = new AppDirectoryManager()
const appDirectorySources = [
  resolve(__dirname, "../../../apps/example-fdc3-apps/src/apps/training-broadcast/manifest.json"),
  resolve(__dirname, "../../../apps/example-fdc3-apps/src/apps/training-receive/manifest.json"),
  resolve(__dirname, "../../../apps/example-fdc3-apps/src/apps/training-pricer/manifest.json"),
  resolve(__dirname, "../../../apps/example-fdc3-apps/src/apps/training-tradelist/manifest.json"),
  resolve(__dirname, "../../../apps/example-fdc3-apps/src/apps/polygon/manifest.json"),
  resolve(__dirname, "../../../apps/example-fdc3-apps/src/apps/tradingview/manifest.json"),
  resolve(__dirname, "../../../apps/example-fdc3-apps/src/apps/benzinga/manifest.json"),
  resolve(__dirname, "../../../apps/example-fdc3-apps/src/apps/wcp-test/manifest.json"),
]

// Load app directories on startup
;(async () => {
  try {
    await appDirectory.replace(appDirectorySources)
    console.log(`📚 Loaded ${appDirectory.retrieveAllApps().length} apps from directories`)
  } catch (error) {
    console.error("❌ Failed to load app directories:", error)
  }
})()

/**
 * Get userId from socket authentication
 * In production, this should validate a JWT or session token
 */
function getUserId(socket: any): string | null {
  // Option 1: From auth handshake (recommended for production)
  const authUserId = socket.handshake.auth?.userId
  if (authUserId) {
    return authUserId
  }

  // Option 2: From session ID (for development/testing)
  const sessionId = socket.handshake.auth?.sessionId
  if (sessionId) {
    return `session:${sessionId}`
  }

  // Option 3: Development fallback - use socket ID as user ID
  // WARNING: This means each socket gets its own agent (not recommended for production)
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[WARN] No userId or sessionId provided for socket ${socket.id}, using socket ID as userId (development mode only)`
    )
    return `dev:${socket.id}`
  }

  return null
}

/**
 * Get or create Desktop Agent for a user
 */
function getOrCreateUserAgent(userId: string): UserAgentInfo {
  let agentInfo = userAgents.get(userId)

  if (!agentInfo) {
    console.log(`✨ Creating Desktop Agent for user: ${userId}`)

    // Create transport for this user
    const transport = new SocketIOServerTransport(io, userId)

    // Create Desktop Agent
    const agent = new SailDesktopAgent({
      transport,
      appLauncher: {
        onLaunchApp: async (appMetadata, instanceId, context) => {
          console.log(`🚀 User ${userId} launching app:`, {
            appId: appMetadata.appId,
            instanceId,
            hasContext: !!context,
          })
          // TODO: Implement app launching via socket messages to UI
        },
      },
      appDirectory,
      debug: process.env.DEBUG === "true",
    })

    agent.start()

    agentInfo = {
      agent,
      transport,
      createdAt: new Date(),
      lastActivity: new Date(),
    }

    userAgents.set(userId, agentInfo)

    console.log(`📊 Total Desktop Agents: ${userAgents.size}`)
  } else {
    // Update last activity
    agentInfo.lastActivity = new Date()
  }

  return agentInfo
}

/**
 * Clean up inactive user agents
 */
function cleanupInactiveAgents() {
  const now = Date.now()
  const inactiveUsers: string[] = []

  for (const [userId, agentInfo] of userAgents.entries()) {
    const inactiveMs = now - agentInfo.lastActivity.getTime()

    // Check if agent has no active connections
    const stats = agentInfo.transport.getStats()

    if (stats.connectedSockets === 0 && inactiveMs > SESSION_TIMEOUT_MS) {
      console.log(
        `🧹 Cleaning up inactive Desktop Agent for user ${userId} (inactive for ${Math.round(inactiveMs / 1000)}s)`
      )
      inactiveUsers.push(userId)
    }
  }

  // Clean up inactive agents
  for (const userId of inactiveUsers) {
    const agentInfo = userAgents.get(userId)
    if (agentInfo) {
      agentInfo.agent.stop()
      agentInfo.transport.disconnect()
      userAgents.delete(userId)
    }
  }

  if (inactiveUsers.length > 0) {
    console.log(`📊 Cleaned up ${inactiveUsers.length} agents. Total remaining: ${userAgents.size}`)
  }
}

// Start cleanup interval
setInterval(cleanupInactiveAgents, CLEANUP_INTERVAL_MS)

// Authentication middleware
io.use((socket, next) => {
  const userId = getUserId(socket)

  if (!userId) {
    console.error(`❌ Authentication failed for socket ${socket.id}: No userId or sessionId provided`)
    return next(new Error("Authentication required: Please provide userId or sessionId"))
  }

  // Store userId in socket data for later use
  socket.data.userId = userId
  console.log(`✅ Authenticated socket ${socket.id} for user ${userId}`)

  next()
})

// Socket.IO connection handling
io.on("connection", (socket) => {
  const userId = socket.data.userId

  if (!userId) {
    // This shouldn't happen due to middleware, but defensive check
    console.error(`❌ Socket ${socket.id} connected without userId`)
    socket.disconnect()
    return
  }

  console.log(`🔌 User ${userId} connected: ${socket.id}`)

  // Get or create Desktop Agent for this user
  const agentInfo = getOrCreateUserAgent(userId)

  // Register this socket with the user's transport
  agentInfo.transport.registerSocket(socket)

  // Log transport stats
  const stats = agentInfo.transport.getStats()
  console.log(`📊 User ${userId} now has ${stats.connectedSockets} connected socket(s)`)

  // Handle app directory requests - send current directory state
  socket.on("app-directory:get", (callback) => {
    console.log(`📚 User ${userId} requesting app directory`)
    const apps = agentInfo.agent.getAppDirectory()?.retrieveAllApps() || []
    console.log(`📚 Sending ${apps.length} apps to user ${userId}`)

    if (typeof callback === "function") {
      callback({ apps })
    } else {
      // Fallback to emit if no callback provided
      socket.emit("app-directory:apps", { apps })
    }
  })

  socket.on("disconnect", () => {
    console.log(`🔌 User ${userId} disconnected: ${socket.id}`)

    // The transport will handle socket cleanup automatically
    // Agent cleanup happens via the periodic cleanup task
  })
})

console.log(`🚢 Sail Server (FDC3 Desktop Agent) listening on port ${port}`)
console.log(`📋 Configuration:`)
console.log(`   - Session timeout: ${SESSION_TIMEOUT_MS / 1000}s`)
console.log(`   - Cleanup interval: ${CLEANUP_INTERVAL_MS / 1000}s`)
console.log(`   - Debug mode: ${process.env.DEBUG === "true"}`)
console.log(`   - Environment: ${process.env.NODE_ENV || "production"}`)

// Graceful shutdown
const shutdown = () => {
  console.log("Shutting down Sail Server...")

  // Stop cleanup interval
  clearInterval(cleanupInactiveAgents as any)

  // Clean up all user agents
  console.log(`🧹 Cleaning up ${userAgents.size} Desktop Agent(s)...`)
  for (const [userId, agentInfo] of userAgents.entries()) {
    console.log(`   - Stopping agent for user ${userId}`)
    agentInfo.agent.stop()
    agentInfo.transport.disconnect()
  }
  userAgents.clear()

  // Close Socket.IO server
  io.close()
    .then(() => {
      console.log("✅ Sail Server stopped gracefully")
      process.exit(0)
    })
    .catch((error) => {
      console.error("❌ Error shutting down:", error)
      process.exit(1)
    })
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)