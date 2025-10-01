/**
 * Sail Server - FDC3 Desktop Agent Server
 * Handles Socket.IO transport and FDC3 Desktop Agent protocol
 */

import { Server } from "socket.io"
import { startDesktopAgent } from "@finos/fdc3-sail-desktop-agent"
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

// Start FDC3 Desktop Agent
const desktopAgent = startDesktopAgent()

// Socket.IO connection handling
io.on("connection", socket => {
  console.log("🔌 FDC3 Client connected:", socket.id)

  // Delegate to desktop agent
  desktopAgent.handleConnection(socket)

  socket.on("disconnect", () => {
    console.log("🔌 FDC3 Client disconnected:", socket.id)
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
