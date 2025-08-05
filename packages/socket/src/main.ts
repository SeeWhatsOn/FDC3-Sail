// Simplified main.ts - uses new architecture
import { Server } from "socket.io"
import { config as dotenv } from "dotenv"
import { setupSocketHandlers } from "./handlers"
import { getAllSessions, shutdownAllSessions } from "./sessions"
import { logEvent } from "./utils"

// Load environment variables
dotenv()

const PORT = parseInt(process.env.PORT ?? "8090")
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT ?? "5000")

export const createServer = (port = PORT) => {
  const io = new Server(port, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  })

  io.on("connection", (socket) => {
    logEvent("Server", "Socket connected", { socketId: socket.id })

    try {
      // handlers are registered here
      setupSocketHandlers(socket)
      logEvent("Server", "Handlers registered", { socketId: socket.id })
    } catch (error) {
      logEvent("Server", "Failed to register handlers", {
        socketId: socket.id,
        error: error instanceof Error ? error.message : String(error),
      })
      socket.disconnect(true)
    }
  })

  // Simplified graceful shutdown
  const performGracefulShutdown = async () => {
    logEvent("Server", "Initiating graceful shutdown")

    const shutdownPromise = new Promise<void>((resolve, reject) => {
      io.close(async (err) => {
        if (err) {
          logEvent("Server", "Error closing Socket.IO server", {
            error: err.message,
          })
          reject(err)
          return
        }

        logEvent("Server", "Socket.IO server connections closed")

        try {
          await shutdownAllSessions()
          logEvent("Server", "All FDC3 sessions shut down")
          resolve()
        } catch (error) {
          logEvent("Server", "Error during session shutdown", {
            error: error instanceof Error ? error.message : String(error),
          })
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
      logEvent("Server", "Graceful shutdown failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      process.exit(1)
    }
  }

  // Add periodic cleanup monitoring
  const cleanupInterval = setInterval(() => {
    const sessions = getAllSessions()
    logEvent("Server", "Periodic cleanup", { activeSessions: sessions.size })

    // Clean up orphaned sessions
    sessions.forEach(async (server, sessionId) => {
      const socket = server.serverContext.getDesktopAgentSocket()
      if (!socket || !socket.connected) {
        logEvent("Server", "Cleaning up orphaned session", { sessionId })
        // Note: removeSession is handled by disconnect handlers
      } else {
        // Clean up disconnected channel sockets
        server.serverContext.cleanupDisconnectedChannelSockets()
      }
    })
  }, 30000) // Every 30 seconds

  // Clean up interval on server close
  const originalClose = io.close.bind(io)
  io.close = (callback) => {
    clearInterval(cleanupInterval)
    return originalClose(callback)
  }

  process.on("SIGTERM", performGracefulShutdown)
  process.on("SIGINT", performGracefulShutdown)

  logEvent("Server", "FDC3 Socket Server started", { port })
  return io
}

// Only start the server if this file is run directly
if (require.main === module) {
  createServer()
}
