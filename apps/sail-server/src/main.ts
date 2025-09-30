/**
 * KISS Sail Server - Thin Transport Layer
 *
 * Only handles Socket.IO transport, authentication, and connection management.
 * All business logic is delegated to @finos/sail-api
 */

import { Server } from "socket.io"
import { createServer } from "http"
import { SailServer, DesktopAgentSingleton } from "@finos/sail-api"
import { APP_CONFIG } from "./constants"
import { authMiddleware } from "./middleware/auth"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// Create HTTP and Socket.IO servers
const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: Array.from(APP_CONFIG.CORS_ORIGINS),
    methods: ["GET", "POST"],
    credentials: true,
  },
})

io.use(authMiddleware)

const port = process.env.PORT || APP_CONFIG.DEFAULT_PORT

// Initialize the FDC3 Desktop Agent Singleton
async function initializeDesktopAgent() {
  const desktopAgent = DesktopAgentSingleton.getInstance()

  // Initialize with default configuration
  await desktopAgent.initialize({
    directories: [
      // Add your FDC3 app directories here
      // "https://directory.example.com/apps.json"
    ],
    customApps: [
      // Add any custom apps here if needed
    ],
    channels: [
      // Default channels are provided by the singleton
    ]
  })

  return desktopAgent
}

// Initialize desktop agent and create Sail server
const desktopAgent = await initializeDesktopAgent()
const sailServer = new SailServer({
  desktopAgent
})

// Set up event forwarding
sailServer.setupEventForwarding(io)

// THIN TRANSPORT LAYER - Only Socket.IO handling
io.on("connection", (socket) => {
  console.log("🔌 Connection:", socket.id)

  // Handle Sail protocol messages - delegate to business logic
  socket.on("sail_event", async (message, callback) => {
    const userId = socket.userId || "anonymous"

    try {
      const result = await sailServer.handleSailMessage(message, userId)
      if (callback) callback(result)
    } catch (error) {
      console.error("Sail message error:", error)
      if (callback) callback(null, error.message)
    }
  })

  // Handle FDC3 protocol messages via Socket.IO - delegate to business logic
  socket.on("fdc3_event", async (message, sourceId) => {
    try {
      await sailServer.handleFDC3Message(message, sourceId || socket.id, (response) => {
        socket.emit("fdc3_event", response)
      })
    } catch (error) {
      console.error("FDC3 message error:", error)
    }
  })

  // Handle DACP MessagePort initialization for FDC3 apps
  socket.on("dacp:init", (instanceId, callback) => {
    try {
      const channel = new MessageChannel()

      // Initialize DACP handlers on port1, return port2 to client
      sailServer.initializeDACPMessagePort(instanceId, channel.port1)

      if (callback) {
        callback(channel.port2)
      }
    } catch (error) {
      console.error("DACP initialization error:", error)
      if (callback) {
        callback(null, error.message)
      }
    }
  })

  socket.on("disconnect", () => {
    console.log("🔌 Disconnected:", socket.id)
  })
})

httpServer.listen(port, () => {
  console.log(`🚀 KISS Sail Server listening on port ${port}`)
  console.log("📊 Stats:", sailServer.getStats())
})

// Simple graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...")
  httpServer.close(() => process.exit(0))
})

process.on("SIGINT", () => {
  console.log("Shutting down...")
  httpServer.close(() => process.exit(0))
})