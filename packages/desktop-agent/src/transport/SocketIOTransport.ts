/**
 * Socket.IO Transport Implementation
 *
 * Server-side transport using Socket.IO for real-time bidirectional communication
 * between FDC3 apps and the Desktop Agent.
 */

import type { Socket } from "socket.io"
import type { Transport, MessageHandler, DisconnectHandler } from "../interfaces/Transport"

/**
 * Socket.IO implementation of Transport interface
 * Used for server-side Desktop Agent with Node.js
 */
export class SocketIOTransport implements Transport {
  private instanceId: string = ""

  constructor(private socket: Socket) {}

  send(instanceId: string, message: unknown): void {
    if (!this.socket.connected) {
      throw new Error(`Cannot send message: socket disconnected (instance: ${instanceId})`)
    }

    this.socket.emit("fdc3_message", message)
  }

  onMessage(handler: MessageHandler): void {
    this.socket.on("fdc3_message", async (message: unknown) => {
      try {
        await handler(message)
      } catch (error) {
        console.error("[SocketIOTransport] Error handling message:", error)
      }
    })
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.socket.on("disconnect", () => {
      handler()
    })
  }

  getInstanceId(): string {
    return this.instanceId
  }

  setInstanceId(instanceId: string): void {
    this.instanceId = instanceId
  }

  isConnected(): boolean {
    return this.socket.connected
  }

  disconnect(): void {
    this.socket.disconnect()
  }

  /**
   * Get the underlying Socket.IO socket
   * Useful for server-side operations that need direct socket access
   */
  getSocket(): Socket {
    return this.socket
  }
}
