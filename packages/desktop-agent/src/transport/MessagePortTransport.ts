/**
 * MessagePort Transport Implementation
 *
 * Browser-side transport using MessagePort for communication between
 * FDC3 apps and a Desktop Agent running in the same browser context.
 */

import type { MessageTransport } from "./MessageTransport"

/**
 * MessagePort implementation of MessageTransport
 * Used for browser-side Desktop Agent
 */
export class MessagePortTransport implements MessageTransport {
  private instanceId: string | null = null
  private connected: boolean = true
  private messageHandler?: (message: object) => Promise<void>
  private disconnectHandler?: (instanceId: string) => void

  constructor(private port: MessagePort) {
    // Start the port to enable message reception
    this.port.start()

    // Setup message event handler
    this.port.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data)
    }

    // Setup close/error handlers
    this.port.onmessageerror = (event: MessageEvent) => {
      console.error("[MessagePortTransport] Message error:", event)
    }

    // Note: MessagePort doesn't have a native 'close' event
    // We track connection state manually
  }

  async send(instanceId: string, message: object): Promise<void> {
    if (!this.connected) {
      throw new Error(`Cannot send message: port disconnected (instance: ${instanceId})`)
    }

    try {
      this.port.postMessage(message)
    } catch (error) {
      console.error("[MessagePortTransport] Error sending message:", error)
      this.connected = false
      throw error
    }
  }

  onMessage(handler: (message: object) => Promise<void>): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: (instanceId: string) => void): void {
    this.disconnectHandler = handler
  }

  getInstanceId(): string | null {
    return this.instanceId
  }

  setInstanceId(instanceId: string): void {
    this.instanceId = instanceId
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect(): void {
    if (this.connected) {
      this.connected = false
      this.port.close()

      if (this.disconnectHandler && this.instanceId) {
        this.disconnectHandler(this.instanceId)
      }
    }
  }

  /**
   * Internal message handler
   */
  private async handleMessage(data: unknown): Promise<void> {
    if (!this.messageHandler) {
      console.warn("[MessagePortTransport] No message handler registered")
      return
    }

    try {
      await this.messageHandler(data as object)
    } catch (error) {
      console.error("[MessagePortTransport] Error handling message:", error)
    }
  }

  /**
   * Get the underlying MessagePort
   * Useful for browser-side operations that need direct port access
   */
  getPort(): MessagePort {
    return this.port
  }
}
