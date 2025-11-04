/**
 * Message Transport Interface
 *
 * Abstraction layer for sending/receiving FDC3 DACP messages.
 * Enables the Desktop Agent to work with different transport mechanisms:
 * - Socket.IO (server-side, Node.js)
 * - MessagePort (browser-side, Web Workers)
 * - Future: WebRTC, HTTP, etc.
 */

/**
 * Transport abstraction for FDC3 message delivery
 */
export interface MessageTransport {
  /**
   * Send a message to a specific app instance
   * @param instanceId - Target app instance ID
   * @param message - DACP message to send
   */
  send(instanceId: string, message: object): Promise<void>

  /**
   * Register handler for incoming messages
   * @param handler - Async function to process received messages
   */
  onMessage(handler: (message: object) => Promise<void>): void

  /**
   * Register handler for disconnect events
   * @param handler - Function called when connection closes
   */
  onDisconnect(handler: (instanceId: string) => void): void

  /**
   * Get the instance ID associated with this transport
   * Used to identify which app instance this transport represents
   */
  getInstanceId(): string | null

  /**
   * Set the instance ID for this transport
   * Called after WCP validation establishes identity
   */
  setInstanceId(instanceId: string): void

  /**
   * Check if transport is currently connected
   */
  isConnected(): boolean

  /**
   * Close the transport connection
   */
  disconnect(): void
}
