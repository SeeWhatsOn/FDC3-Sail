import { Server, Socket } from "socket.io"
import { dualProtocolHandler } from "../handlers/DualProtocolHandler"

/**
 * Initializes the Socket.IO service with dual protocol support (DACP + Sail)
 * @param io - The Socket.IO server instance
 * @returns The configured Socket.IO server
 */
export function initSocketService(io: Server): Server {
  console.log("=== SAIL Socket Service Initialized ===")
  console.log("📋 Using dual protocol architecture (DACP + Socket.IO)")

  io.on("connection", (socket: Socket) => {
    console.log("🔌 NEW SOCKET CONNECTION:", socket.id)
    console.log("📊 Total connections:", io.sockets.sockets.size)

    // Register dual protocol handlers (DACP + Sail Socket.IO)
    const context = dualProtocolHandler.registerHandlers(socket, {
      enableDACP: true,
      enableSailSocket: true
    })

    console.log("Dual protocol handlers registered for connection:", socket.id)
    console.log("- Sail Socket.IO:", context.sailEnabled)
    console.log("- DACP ready:", context.config.enableDACP)

    // Log protocol statistics periodically
    socket.on('disconnect', () => {
      const stats = dualProtocolHandler.getStats()
      console.log("📊 Protocol Handler Statistics:", stats)
    })
  })

  return io
}
