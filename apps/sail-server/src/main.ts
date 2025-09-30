/**
 * Sail Server - Transport Layer
 * Handles Socket.IO transport and delegates FDC3 logic to SailServer
 */

import { Server } from "socket.io"
// import { SailServer } from "@finos/sail-api"
import { APP_CONFIG } from "./constants"
// import { authMiddleware } from "./middleware/auth"
import dotenv from "dotenv"

dotenv.config()

const port = process.env.PORT || APP_CONFIG.DEFAULT_PORT

// Create Sail Server
// const sailServer = new SailServer({ desktopAgent })

// Create Socket.IO server
const io = new Server(Number(port), {
  cors: {
    origin: Array.from(APP_CONFIG.CORS_ORIGINS),
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// io.use(authMiddleware)

// Socket.IO connection handling
io.on("connection", socket => {
  console.log("🔌 Connection:", socket.id)

  socket.on("sail_event", (message, callback) => {
    console.log("Sail message:", message)
  })

  socket.on("fdc3_event", async (message: DACPMessage) => {
    handleDACPMessage(message)
    // FDC3 desktop agent will handle the message
  })
})

console.log(`🚢 Sail Server listening on port ${port}`)

// Graceful shutdown
const shutdown = () => {
  console.log("Shutting down...")
  io.close()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Error shutting down:", error)
      process.exit(1)
    })
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
