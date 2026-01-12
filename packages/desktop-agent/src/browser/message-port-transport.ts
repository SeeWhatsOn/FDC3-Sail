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

    const messageType =
      message && typeof message === "object" && "type" in message
        ? (message as { type: unknown }).type
        : "unknown"

    console.log("[MessagePortTransport] Sending message", {
      messageType,
      connected: this.connected,
    })

    try {
      this.port.postMessage(message)
      console.log("[MessagePortTransport] Message posted successfully", { messageType })
    } catch (error) {
      console.error("[MessagePortTransport] Error sending message through MessagePort:", error)
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

    const message = event.data
    const messageType =
      message && typeof message === "object" && "type" in message
        ? (message as { type: unknown }).type
        : "unknown"

    console.log("[MessagePortTransport] Received message", {
      messageType,
      hasHandler: !!this.messageHandler,
      connected: this.connected,
    })

    // Log broadcastEvent details for debugging
    if (messageType === "broadcastEvent" && message && typeof message === "object") {
      const msg = message as Record<string, unknown>
      const payload = msg.payload as Record<string, unknown> | undefined
      console.log("[MessagePortTransport] BroadcastEvent details", {
        type: msg.type,
        hasPayload: !!payload,
        channelId: payload?.channelId,
        contextType: (payload?.context as Record<string, unknown>)?.type,
        contextId: (payload?.context as Record<string, unknown>)?.id,
        fullMessage: JSON.stringify(message, null, 2),
      })
    }

    if (this.messageHandler) {
      try {
        const result = this.messageHandler(message)
        // Handle promise if handler is async
        if (result instanceof Promise) {
          void result.catch(error => {
            console.error("[MessagePortTransport] Error in async message handler:", error, {
              messageType,
            })
          })
        }
        console.log("[MessagePortTransport] Message handler executed successfully", { messageType })
      } catch (error) {
        console.error("[MessagePortTransport] Error in message handler:", error, { messageType })
      }
    } else {
      console.warn("[MessagePortTransport] No message handler registered", { messageType })
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
