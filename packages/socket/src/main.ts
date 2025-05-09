import { Server, Socket } from "socket.io"
import dotenv from "dotenv"
import { ConnectionState } from "./types"
import { registerAllSocketHandlers } from "./setupHandlers"
import { SessionManager } from "./sessionManager"

// Load environment variables from .env file
dotenv.config()

const PORT = parseInt(process.env.PORT ?? "8090")
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT ?? "5000")

// Running sessions - the server state
const sessionManager = new SessionManager()

const io = new Server(PORT, {
  cors: { origin: "*", methods: ["GET", "POST"] }, // Example CORS config
})

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`)

  const connectionState: ConnectionState = {
    socket,
    sessionManager,
  }

  // --- Setup All Handlers ---
  registerAllSocketHandlers(socket, connectionState)
})

const performGracefulShutdown = () => {
  console.log("Initiating graceful shutdown...")
  io.close(() => {
    console.log("Socket.IO server connections closed.")
    sessionManager.shutdownAllSessions().then(() => {
      console.log("All active FDC3 sessions shut down and cleared.")
    })
  })
  setTimeout(() => {
    console.error("Shutdown timeout. Forcing exit.")
    process.exit(1)
  }, SHUTDOWN_TIMEOUT)
}

process.on("SIGTERM", performGracefulShutdown)
process.on("SIGINT", performGracefulShutdown)
