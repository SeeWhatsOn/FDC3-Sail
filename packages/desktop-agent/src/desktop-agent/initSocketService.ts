import { Server, Socket } from "socket.io"
import {
  SocketConnectionState,
  HandlerContext,
  registerElectronHandlers,
  registerDesktopAgentHandlers,
  registerAppHandlers,
  registerChannelHandlers,
  registerDisconnectHandler,
} from "./handlers"

/**
 * Initializes the Socket.IO service for handling FDC3 communications
 * @param io - The Socket.IO server instance
 * @returns The configured Socket.IO server
 */
export function initSocketService(io: Server): Server {
  console.log("=== SAIL Socket Service Initialized ===")
  console.log("📋 Using simple Socket.IO sessions")

  io.on("connection", (socket: Socket) => {
    console.log("🔌 NEW SOCKET CONNECTION:", socket.id)
    console.log("📊 Total connections:", io.sockets.sockets.size)

    // Initialize connection state
    const connectionState: SocketConnectionState = {}

    // Create handler context
    const context: HandlerContext = {
      socket,
      connectionState,
    }

    // Register all handlers
    registerElectronHandlers(context)
    registerDesktopAgentHandlers(context)
    registerAppHandlers(context)
    registerChannelHandlers(context)
    registerDisconnectHandler(context)

    console.log("All socket handlers registered for connection:", socket.id)
  })

  return io
}
