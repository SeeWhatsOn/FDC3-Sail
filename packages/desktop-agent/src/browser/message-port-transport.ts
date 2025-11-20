/**
 * MessagePort Transport Implementation
 *
 * Transport implementation using browser MessagePort API.
 * Used for direct browser-to-browser communication (iframe to parent window).
 *
 * This is a browser-specific implementation and should only be used in
 * browser environments.
 */

import type { Transport, MessageHandler, DisconnectHandler } from "../core/interfaces/transport"

/**
 * Transport implementation using MessagePort API.
 *
 * This transport wraps a MessagePort for bidirectional communication.
 * Commonly used for:
 * - Iframe to parent window communication (WCP)
 * - Worker to main thread communication
 * - Direct in-browser Desktop Agent connections
 *
 * @example
 * ```typescript
 * // Create MessageChannel
 * const channel = new MessageChannel()
 *
 * // Wrap port2 as transport
 * const transport = new MessagePortTransport(channel.port2)
 *
 * // Set up handlers
 * transport.onMessage((msg) => console.log('Received:', msg))
 * transport.onDisconnect(() => console.log('Disconnected'))
 *
 * // Send messages
 * transport.send({ type: 'hello', payload: { message: 'world' } })
 *
 * // Transfer port1 to iframe
 * iframe.contentWindow.postMessage(handshake, '*', [channel.port1])
 * ```
 */
export class MessagePortTransport implements Transport {
  private port: MessagePort
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler
  private connected: boolean = true

  /**
   * Create a new MessagePort transport
   *
   * @param port - MessagePort to wrap
   */
  constructor(port: MessagePort) {
    if (typeof MessagePort === "undefined") {
      throw new Error("MessagePort is not available (browser environment required)")
    }

    this.port = port

    // Start the port (required for message delivery)
    this.port.start()

    // Listen for messages
    this.port.addEventListener("message", this.handleMessage.bind(this))

    // Listen for errors (indicates connection issues)
    this.port.addEventListener("messageerror", this.handleError.bind(this))

    // Note: MessagePorts don't have a built-in disconnect event
    // Disconnect is detected via DACP heartbeat timeout
  }

  /**
   * Send a message through the MessagePort
   *
   * @param message - Message to send (will be structured cloned)
   */
  send(message: unknown): void {
    if (!this.connected) {
      throw new Error("Cannot send message: MessagePort is disconnected")
    }

    try {
      this.port.postMessage(message)
    } catch (error) {
      console.error("Error sending message through MessagePort:", error)
      // If posting fails, treat as disconnection
      this.handleDisconnect()
      throw error
    }
  }

  /**
   * Register handler for incoming messages
   *
   * @param handler - Function to call when message is received
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  /**
   * Register handler for disconnect events
   *
   * Note: MessagePort doesn't have native disconnect detection.
   * This is typically triggered by:
   * - Explicit disconnect() call
   * - Message posting errors
   * - DACP heartbeat timeout
   *
   * @param handler - Function to call when disconnected
   */
  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  /**
   * Check if the transport is connected
   *
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get the instance ID associated with this transport connection.
   * For MessagePortTransport, this is not applicable as it's not a per-instance connection.
   */
  getInstanceId(): string | null {
    return null
  }

  /**
   * Disconnect the transport and clean up resources
   */
  disconnect(): void {
    if (!this.connected) {
      return
    }

    this.connected = false

    // Remove event listeners
    this.port.removeEventListener("message", this.handleMessage.bind(this))
    this.port.removeEventListener("messageerror", this.handleError.bind(this))

    // Close the port
    this.port.close()

    // Call disconnect handler
    if (this.disconnectHandler) {
      try {
        this.disconnectHandler()
      } catch (error) {
        console.error("Error in disconnect handler:", error)
      }
    }
  }

  /**
   * Handle incoming message event
   */
  private handleMessage(event: MessageEvent): void {
    if (!this.connected) {
      return
    }

    if (this.messageHandler) {
      try {
        this.messageHandler(event.data)
      } catch (error) {
        console.error("Error in message handler:", error)
      }
    }
  }

  /**
   * Handle message error event
   */
  private handleError(event: MessageEvent): void {
    console.error("MessagePort error:", event)
    // Treat errors as disconnection
    this.handleDisconnect()
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    if (!this.connected) {
      return
    }

    this.connected = false

    if (this.disconnectHandler) {
      try {
        this.disconnectHandler()
      } catch (error) {
        console.error("Error in disconnect handler:", error)
      }
    }
  }
}
