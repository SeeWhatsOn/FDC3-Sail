/**
 * Socket.IO Transport Implementation
 *
 * Server-side transport using Socket.IO for real-time bidirectional communication
 * between FDC3 apps and the Desktop Agent.
 */

import type { Socket } from "socket.io"
import type { MessageTransport } from "./MessageTransport"

/**
 * Socket.IO implementation of MessageTransport
 * Used for server-side Desktop Agent with Node.js
 */
export class SocketIOTransport implements MessageTransport {
  private instanceId: string | null = null

  constructor(private socket: Socket) {}

  async send(instanceId: string, message: object): Promise<void> {
    if (!this.socket.connected) {
      throw new Error(`Cannot send message: socket disconnected (instance: ${instanceId})`)
    }

    this.socket.emit("fdc3_message", message)
  }

  onMessage(handler: (message: object) => Promise<void>): void {
    this.socket.on("fdc3_message", async (message: unknown) => {
      try {
        await handler(message as object)
      } catch (error) {
        console.error("[SocketIOTransport] Error handling message:", error)
      }
    })
  }

  onDisconnect(handler: (instanceId: string) => void): void {
    this.socket.on("disconnect", () => {
      if (this.instanceId) {
        handler(this.instanceId)
      }
    })
  }

  getInstanceId(): string | null {
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
