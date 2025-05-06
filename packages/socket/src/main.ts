import { Server, Socket } from "socket.io"
import { SailFDC3Server } from "./handlers/desktop-agent/SailFDC3Server"
import dotenv from "dotenv"
import { ConnectionState } from "./handlers/connectionState"
import { setupAllHandlers } from "./setupHandlers"

// Load environment variables from .env file
dotenv.config()

const PORT = parseInt(process.env.PORT ?? "8090")

// Running sessions - the server state
const sessions = new Map<string, SailFDC3Server>()

const io = new Server(PORT, {
  cors: { origin: "*", methods: ["GET", "POST"] }, // Example CORS config
})

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`)

  const connectionState: ConnectionState = {
    socket,
    sessions,
  }

  // --- Setup All Handlers ---
  setupAllHandlers(socket, connectionState)
})

const shutdown = () => {
  console.log("Initiating graceful shutdown...")
  io.close(() => {
    console.log("Socket.IO server connections closed.")
    sessions.forEach((server, sessionId) => {
      console.log(`Shutting down FDC3 session: ${sessionId}`)
      server.shutdown()
    })
    sessions.clear()
    console.log("All active FDC3 sessions shut down and cleared.")
  })
  setTimeout(() => {
    console.error("Shutdown timeout. Forcing exit.")
    process.exit(1)
  }, 5000)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
