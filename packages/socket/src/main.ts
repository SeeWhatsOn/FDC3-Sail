// src/main.ts
import { Server, Socket } from "socket.io"
import dotenv from "dotenv"
import { ConnectionState } from "./types"
import { registerAllSocketHandlers } from "./setupHandlers"
import { SessionManager } from "./sessionManager"
import { clearPendingSessionRequests } from "./utils/serverUtils"

// Load environment variables
dotenv.config()

const PORT = parseInt(process.env.PORT ?? "8090")
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT ?? "5000")

// Running sessions - the server state
export const sessionManager = new SessionManager()

export const createServer = (port = PORT) => {
  const io = new Server(port, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  })

  io.on("connection", async (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`)

    const connectionState: ConnectionState = {
      socket,
      sessionManager,
    }

    // --- Setup All Handlers ---
    try {
      await registerAllSocketHandlers(socket, connectionState)
    } catch (error) {
      console.error(`Failed to register handlers for socket ${socket.id}, disconnecting:`, error)
      socket.disconnect(true)
    }
  })

  const performGracefulShutdown = async () => {
    console.log("Initiating graceful shutdown...")
    
    const shutdownPromise = new Promise<void>((resolve, reject) => {
      io.close(async (err) => {
        if (err) {
          console.error("Error closing Socket.IO server:", err)
          reject(err)
          return
        }
        
        console.log("Socket.IO server connections closed.")
        
        try {
          await sessionManager.shutdownAllSessions()
          sessionManager.removeAllListeners() // Clean up event listeners
          clearPendingSessionRequests() // Clear any pending session requests
          console.log("All active FDC3 sessions shut down and cleared.")
          resolve()
        } catch (error) {
          console.error("Error during session shutdown:", error)
          reject(error)
        }
      })
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Shutdown timeout"))
      }, SHUTDOWN_TIMEOUT)
    })

    try {
      await Promise.race([shutdownPromise, timeoutPromise])
      process.exit(0)
    } catch (error) {
      console.error("Graceful shutdown failed:", error)
      process.exit(1)
    }
  }

  process.on("SIGTERM", performGracefulShutdown)
  process.on("SIGINT", performGracefulShutdown)

  // Add periodic connection monitoring and cleanup
  const cleanupInterval = setInterval(() => {
    const sessions = sessionManager.getAllSessions()
    console.log(`Active sessions: ${sessions.size}`)
    
    // Clean up any orphaned sessions
    const orphanedSessions: string[] = []
    sessions.forEach(async (server, sessionId) => {
      const socket = server.serverContext.getDesktopAgentSocket()
      if (!socket || !socket.connected) {
        console.warn(`Cleaning up orphaned session: ${sessionId}`)
        orphanedSessions.push(sessionId)
      } else {
        // Clean up disconnected channel sockets within active sessions
        server.serverContext.cleanupDisconnectedChannelSockets()
      }
    })
    
    // Remove orphaned sessions
    orphanedSessions.forEach(async (sessionId) => {
      try {
        await sessionManager.removeSession(sessionId)
      } catch (error) {
        console.error(`Error removing orphaned session ${sessionId}:`, error)
      }
    })
  }, 30000) // Every 30 seconds

  // Clean up interval on server close
  const originalClose = io.close.bind(io)
  io.close = (callback) => {
    clearInterval(cleanupInterval)
    return originalClose(callback)
  }

  console.log(`FDC3 Socket Server started on port ${port}`)

  return io
}

// Only start the server if this file is run directly
if (require.main === module) {
  createServer()
}
