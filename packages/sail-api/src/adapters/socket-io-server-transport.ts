/**
 * Socket.IO Server Transport Implementation
 *
 * Server-side transport using Socket.IO for real-time bidirectional communication.
 * This transport manages multiple connected sockets and routes messages to the
 * correct socket based on the destination instanceId in the message metadata.
 */

import type { Server, Socket } from "socket.io"
import type { Transport, MessageHandler, DisconnectHandler } from "@finos/fdc3-sail-desktop-agent"

interface FDC3Message {
  meta?: {
    destination?: {
      instanceId?: string
    }
  }
}

/**
 * Socket.IO Server implementation of Transport interface
 * Used for the Global Desktop Agent on the server
 */
export class SocketIOServerTransport implements Transport {
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler

  constructor(private io: Server) {
    this.setupConnectionHandler()
  }

  private setupConnectionHandler() {
    this.io.on("connection", (socket: Socket) => {
      // Handle incoming messages from this socket
      socket.on("fdc3_message", async (message: unknown) => {
        if (this.messageHandler) {
          try {
            // We might want to tag the message with the source socket ID if not present
            // But for now, we just pass it through to the Desktop Agent
            await this.messageHandler(message)
          } catch (error) {
            console.error(
              `[SocketIOServerTransport] Error handling message from ${socket.id}:`,
              error
            )
          }
        }
      })

      // Handle disconnect
      socket.on("disconnect", () => {
        // We don't necessarily want to trigger the global disconnect handler
        // because one client disconnecting shouldn't stop the whole agent.
        // However, we might want to notify the agent that a specific instance is gone.
        // For the Global Agent pattern, we might just log it for now.
        // If we need to clean up app instances, we'd need a way to signal that.
      })
    })
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
        "[SocketIOServerTransport] Cannot route message: No destination instanceId",
        message
      )
      return
    }

    // In the Global Agent pattern (Option 1), the instanceId IS the socket ID
    // (or mapped to it). We assume instanceId == socketId for simplicity now.
    const socket = this.io.sockets.sockets.get(targetInstanceId)

    if (socket) {
      socket.emit("fdc3_message", message)
    } else {
      console.warn(`[SocketIOServerTransport] Target socket not found: ${targetInstanceId}`)
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  getInstanceId(): string | null {
    // Server transport is shared, so it doesn't have a single instance ID
    return null
  }

  isConnected(): boolean {
    return true // Server is always "connected"
  }

  disconnect(): void {
    this.io.close()
    if (this.disconnectHandler) {
      this.disconnectHandler()
    }
  }
}
