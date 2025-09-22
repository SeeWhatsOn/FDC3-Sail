import { Server } from "socket.io"
import { createServer } from "http"
import { initSocketService } from "@finos/fdc3-sail-desktop-agent"
import { APP_CONFIG } from "./constants"
import { authMiddleware } from "./middleware/auth"
import dotenv from "dotenv"

// Load environment variables from .env file
dotenv.config()

// Create HTTP server
const httpServer = createServer()

// Create Socket.IO server with CORS and authentication
const io = new Server(httpServer, {
  cors: {
    origin: Array.from(APP_CONFIG.CORS_ORIGINS),
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Add authentication middleware
io.use(authMiddleware)

const port = process.env.PORT || APP_CONFIG.DEFAULT_PORT

httpServer.listen(port, () => {
  console.log(`🚀 SAIL Socket Server is listening on port ${port}`)
  console.log(`🔐 Authentication middleware enabled`)
  console.log(`📋 Using simple Socket.IO sessions`)
})

// Initialize socket service (no session manager needed!)
initSocketService(io)

// Optional: Periodic cleanup for disconnected sockets
setInterval(() => {
  const connectedSockets = io.sockets.sockets.size
  console.log(`📊 Active connections: ${connectedSockets}`)
}, 5 * 60 * 1000)
