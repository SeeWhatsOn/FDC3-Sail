/**
 * Sail Server - FDC3 Desktop Agent Server
 * Handles Socket.IO transport and FDC3 Desktop Agent protocol
 */

import { Server } from "socket.io"
import { SailDesktopAgent } from "@finos/sail-api"
import { APP_CONFIG } from "./constants"
import dotenv from "dotenv"

dotenv.config()

const port = process.env.PORT || APP_CONFIG.DEFAULT_PORT

// Create Socket.IO server
const io = new Server(Number(port), {
  cors: {
    origin: Array.from(APP_CONFIG.CORS_ORIGINS),
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Map to track desktop agent instances per connection
const agentInstances = new Map<string, SailDesktopAgent>()

// Socket.IO connection handling
io.on("connection", socket => {
  console.log("🔌 FDC3 Client connected:", socket.id)

  // Create Sail Desktop Agent for this connection
  const agent = new SailDesktopAgent({
    socket,
    appLauncher: {
      // TODO: Implement app launching via socket messages to UI
      onLaunchApp: async (appMetadata, instanceId, context) => {
        console.log("🚀 App launch requested:", {
          appId: appMetadata.appId,
          instanceId,
          hasContext: !!context,
        })
        // Future: Send message to Sail UI to open app
        // socket.emit('sail_app_open', { appMetadata, instanceId, context })
      },
    },
    debug: process.env.DEBUG === "true",
  })

  // Start the agent
  agent.start()

  // Track the instance
  agentInstances.set(socket.id, agent)

  socket.on("disconnect", () => {
    console.log("🔌 FDC3 Client disconnected:", socket.id)

    // Stop and cleanup agent
    const instance = agentInstances.get(socket.id)
    if (instance) {
      instance.stop()
      agentInstances.delete(socket.id)
    }
  })
})

console.log(`🚢 Sail Server (FDC3 Desktop Agent) listening on port ${port}`)

// Graceful shutdown
const shutdown = () => {
  console.log("Shutting down Sail Server...")
  io.close()
    .then(() => {
      console.log("Sail Server stopped")
      process.exit(0)
    })
    .catch(error => {
      console.error("Error shutting down:", error)
      process.exit(1)
    })
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
