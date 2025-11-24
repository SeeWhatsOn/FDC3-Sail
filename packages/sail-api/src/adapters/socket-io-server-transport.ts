/**
 * Socket.IO Server Transport Implementation
 *
 * Server-side transport using Socket.IO for real-time bidirectional communication.
 * This transport manages multiple connected sockets for a SINGLE user/session and routes
 * messages to the correct socket based on the destination instanceId in the message metadata.
 *
 * SECURITY: This transport is designed to be used PER USER/SESSION, ensuring isolation
 * between different users. Each user gets their own Transport instance.
 */

import type { Server, Socket } from "socket.io"
import type { Transport, MessageHandler, DisconnectHandler } from "@finos/fdc3-sail-desktop-agent"

interface FDC3Message {
  meta?: {
    destination?: {
      instanceId?: string
    }
    source?: {
      instanceId?: string
    }
  }
}

/**
 * Socket.IO Server implementation of Transport interface
 * Used for per-user/session Desktop Agent on the server
 */
export class SocketIOServerTransport implements Transport {
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler

  // Track sockets belonging to this user/session
  private userSockets = new Set<string>() // socket IDs
  private socketInstanceMap = new Map<string, string>() // socketId -> instanceId

  private readonly userId: string
  private cleanupCallbacks = new Set<() => void>()

  constructor(
    private io: Server,
    userId: string
  ) {
    this.userId = userId
  }

  /**
   * Register a socket as belonging to this user's session.
   * This should be called when a socket connects and is authenticated.
   */
  registerSocket(socket: Socket): void {
    const socketId = socket.id

    if (this.userSockets.has(socketId)) {
      console.warn(`[SocketIOServerTransport] Socket ${socketId} already registered for user ${this.userId}`)
      return
    }

    console.log(`[SocketIOServerTransport] Registering socket ${socketId} for user ${this.userId}`)
    this.userSockets.add(socketId)

    // Handle incoming messages from this socket
    const messageHandler = async (message: unknown) => {
      if (this.messageHandler) {
        try {
          const fdc3Message = message as FDC3Message
          const sourceInstanceId = fdc3Message.meta?.source?.instanceId

          // Track the mapping of socket -> instanceId for routing responses
          if (sourceInstanceId) {
            this.socketInstanceMap.set(socketId, sourceInstanceId)
          }

          await this.messageHandler(message)
        } catch (error) {
          console.error(
            `[SocketIOServerTransport] Error handling message from user ${this.userId}, socket ${socketId}:`,
            error
          )
        }
      }
    }

    // Handle disconnect
    const disconnectHandler = () => {
      console.log(`[SocketIOServerTransport] Socket ${socketId} disconnected for user ${this.userId}`)
      this.unregisterSocket(socketId)
    }

    socket.on("fdc3_message", messageHandler)
    socket.on("disconnect", disconnectHandler)

    // Store cleanup callback
    this.cleanupCallbacks.add(() => {
      socket.off("fdc3_message", messageHandler)
      socket.off("disconnect", disconnectHandler)
    })
  }

  /**
   * Unregister a socket (called on disconnect)
   */
  private unregisterSocket(socketId: string): void {
    this.userSockets.delete(socketId)
    this.socketInstanceMap.delete(socketId)

    // If no more sockets for this user, potentially trigger cleanup
    if (this.userSockets.size === 0) {
      console.log(`[SocketIOServerTransport] No more sockets for user ${this.userId}`)
      // Note: We don't auto-disconnect the agent here - let the heartbeat handle it
      // or implement a configurable timeout
    }
  }

  /**
   * Send a message to a specific client
   * The destination instanceId is extracted from the message metadata
   */
  send(message: unknown): void {
    const fdc3Message = message as FDC3Message
    const targetInstanceId = fdc3Message.meta?.destination?.instanceId

    if (!targetInstanceId) {
      console.warn(
        `[SocketIOServerTransport] Cannot route message for user ${this.userId}: No destination instanceId`,
        message
      )
      return
    }

    // Find the socket that owns this instanceId
    // The instanceId is typically the socket.id from WCP handshake
    let targetSocket: Socket | undefined

    // First, try direct socket ID match
    if (this.userSockets.has(targetInstanceId)) {
      targetSocket = this.io.sockets.sockets.get(targetInstanceId)
    }

    // If not found, search the instance map
    if (!targetSocket) {
      for (const [socketId, instanceId] of this.socketInstanceMap.entries()) {
        if (instanceId === targetInstanceId && this.userSockets.has(socketId)) {
          targetSocket = this.io.sockets.sockets.get(socketId)
          break
        }
      }
    }

    if (targetSocket) {
      // SECURITY CHECK: Verify this socket belongs to our user
      if (!this.userSockets.has(targetSocket.id)) {
        console.error(
          `[SocketIOServerTransport] SECURITY: Attempted to send to socket ${targetSocket.id} not owned by user ${this.userId}`
        )
        return
      }

      targetSocket.emit("fdc3_message", message)
    } else {
      console.warn(
        `[SocketIOServerTransport] Target socket not found for user ${this.userId}, instanceId: ${targetInstanceId}`
      )
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  getInstanceId(): string | null {
    // Server transport is shared across multiple app instances for a user
    return null
  }

  isConnected(): boolean {
    // Connected if we have at least one active socket
    return this.userSockets.size > 0
  }

  disconnect(): void {
    console.log(`[SocketIOServerTransport] Disconnecting all sockets for user ${this.userId}`)

    // Clean up all registered sockets
    this.cleanupCallbacks.forEach(cleanup => cleanup())
    this.cleanupCallbacks.clear()

    // Disconnect all user's sockets
    for (const socketId of this.userSockets) {
      const socket = this.io.sockets.sockets.get(socketId)
      if (socket) {
        socket.disconnect(true)
      }
    }

    this.userSockets.clear()
    this.socketInstanceMap.clear()

    if (this.disconnectHandler) {
      this.disconnectHandler()
    }
  }

  /**
   * Get statistics about this transport
   */
  getStats() {
    return {
      userId: this.userId,
      connectedSockets: this.userSockets.size,
      trackedInstances: this.socketInstanceMap.size,
    }
  }
}