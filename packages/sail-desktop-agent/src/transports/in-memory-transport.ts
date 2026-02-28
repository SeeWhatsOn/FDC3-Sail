/**
 * In-Memory Transport Implementation
 *
 * Transport implementation for same-process communication.
 * Used when Desktop Agent and connection manager are in the same process.
 *
 * This transport is environment-agnostic and can be used in any JavaScript
 * runtime (browser, Node.js, Deno, etc.).
 */

import type { Transport, MessageHandler, DisconnectHandler } from "../core/interfaces/transport"
import { consoleLogger } from "../core/interfaces/logger"

/**
 * In-memory transport for same-process communication.
 *
 * This transport enables direct function calls between two components
 * in the same process. Messages are passed synchronously without
 * serialization overhead.
 *
 * Commonly used for:
 * - Browser Desktop Agent + WCP Connector in same window
 * - Testing and development
 * - Embedded Desktop Agent scenarios
 *
 * @example
 * ```typescript
 * // Create a pair of linked transports
 * const [transport1, transport2] = createInMemoryTransportPair()
 *
 * // Messages sent to transport1 are received by transport2
 * transport2.onMessage((msg) => console.log('Transport2 received:', msg))
 * transport1.send({ hello: 'from transport1' })
 *
 * // And vice versa
 * transport1.onMessage((msg) => console.log('Transport1 received:', msg))
 * transport2.send({ hello: 'from transport2' })
 * ```
 */
export class InMemoryTransport implements Transport {
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler
  private connected: boolean = true
  private peer?: InMemoryTransport

  /**
   * Set the peer transport for bidirectional communication.
   * This is typically called by createInMemoryTransportPair().
   *
   * @param peer - The other transport to link with
   * @internal
   */
  setPeer(peer: InMemoryTransport): void {
    this.peer = peer
  }

  /**
   * Send a message to the peer transport
   *
   * @param message - Message to send
   */
  send(message: unknown): void {
    if (!this.connected) {
      throw new Error("Cannot send message: InMemoryTransport is disconnected")
    }

    if (!this.peer) {
      throw new Error("Cannot send message: No peer transport connected")
    }

    if (!this.peer.isConnected()) {
      throw new Error("Cannot send message: Peer transport is disconnected")
    }

    // Use setTimeout to make delivery async, preventing:
    // 1. Stack overflow with rapid back-and-forth messages
    // 2. Synchronous call stack issues that could block the event loop
    setTimeout(() => {
      if (this.peer?.isConnected() && this.peer?.messageHandler) {
        try {
          // Deep clone the message to prevent shared references
          const clonedMessage = this.deepClone(message)
          void Promise.resolve(this.peer.messageHandler(clonedMessage)).catch(error => {
            consoleLogger.error("Error in peer message handler:", error)
          })
        } catch (error) {
          consoleLogger.error("Error in peer message handler:", error)
        }
      }
    }, 0)
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
   * For InMemoryTransport, this is not applicable as it's not a per-instance connection.
   */
  getInstanceId(): string | null {
    return null
  }

  /**
   * Disconnect the transport
   *
   * This will also notify the peer transport of the disconnection.
   */
  disconnect(): void {
    if (!this.connected) {
      return
    }

    this.connected = false

    // Notify peer of disconnection
    if (this.peer && this.peer.isConnected()) {
      setTimeout(() => {
        if (this.peer?.disconnectHandler) {
          try {
            this.peer.disconnectHandler()
          } catch (error) {
            consoleLogger.error("Error in peer disconnect handler:", error)
          }
        }
      }, 0)
    }

    // Call local disconnect handler
    if (this.disconnectHandler) {
      try {
        this.disconnectHandler()
      } catch (error) {
        consoleLogger.error("Error in disconnect handler:", error)
      }
    }

    // Clear peer reference
    this.peer = undefined
  }

  /**
   * Deep clone a message to prevent shared object references
   * between the two transports.
   *
   * This uses newer structuredClone API for better performance and security.
   * NOTE:We may need to fallback to JSON serialization for environments that don't have structuredClone.
   */
  private deepClone(obj: unknown): unknown {
    if (typeof structuredClone === "undefined") {
      throw new Error("structuredClone is required but not available in this environment")
    }

    try {
      return structuredClone(obj)
    } catch (error) {
      // structuredClone throws for functions, DOM nodes, etc.
      // This is actually good - we want to know if we're trying to clone unsupported types
      consoleLogger.error("Cannot clone message - contains unsupported types:", error)
      throw error
    }
  }
}
/**
 * Create a pair of linked InMemoryTransport instances.
 *
 * Messages sent to transport1 are received by transport2, and vice versa.
 * This is useful for connecting two components in the same process.
 *
 * @returns Tuple of [transport1, transport2]
 *
 * @example
 * ```typescript
 * // Create linked transports for Desktop Agent and WCP Connector
 * const [daTransport, connectorTransport] = createInMemoryTransportPair()
 *
 * // Desktop Agent uses daTransport
 * const desktopAgent = new DesktopAgent({ transport: daTransport })
 *
 * // WCP Connector uses connectorTransport
 * const wcpConnector = new WCPConnector(connectorTransport)
 *
 * // Messages flow bidirectionally between them
 * ```
 */
export function createInMemoryTransportPair(): [InMemoryTransport, InMemoryTransport] {
  const transport1 = new InMemoryTransport()
  const transport2 = new InMemoryTransport()

  transport1.setPeer(transport2)
  transport2.setPeer(transport1)

  return [transport1, transport2]
}
