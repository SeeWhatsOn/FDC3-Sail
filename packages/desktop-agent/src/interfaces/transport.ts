/**
 * Transport Interface
 *
 * Abstraction for bidirectional message transport between the Desktop Agent
 * and FDC3 applications. Implementations handle environment-specific details
 * (Socket.IO, MessagePort, IPC, etc.)
 */

/**
 * Handler function for incoming messages from apps
 */
export type MessageHandler = (message: unknown) => void | Promise<void>

/**
 * Handler function for disconnect events
 */
export type DisconnectHandler = () => void

/**
 * Transport interface for sending and receiving DACP messages.
 * The desktop agent uses this to communicate with FDC3 applications
 * without knowing the underlying transport mechanism.
 */
export interface Transport {
  /**
   * Send a message to a specific app instance.
   *
   * @param instanceId - Target app instance ID
   * @param message - DACP message to send
   */
  send(instanceId: string, message: unknown): void

  /**
   * Register a handler for incoming messages from the app.
   * The transport should call this handler when it receives a message.
   *
   * @param handler - Function to call when a message is received
   */
  onMessage(handler: MessageHandler): void

  /**
   * Register a handler for disconnect events.
   * The transport should call this handler when the connection closes.
   *
   * @param handler - Function to call when disconnected
   */
  onDisconnect(handler: DisconnectHandler): void

  /**
   * Get the instance ID associated with this transport connection.
   * Returns empty string if not yet set (e.g., before WCP handshake).
   */
  getInstanceId(): string

  /**
   * Set the instance ID for this transport connection.
   * Called after WCP handshake validates the app identity.
   *
   * @param instanceId - The validated instance ID
   */
  setInstanceId(instanceId: string): void

  /**
   * Check if the transport connection is still active.
   */
  isConnected(): boolean

  /**
   * Close the transport connection and clean up resources.
   */
  disconnect(): void
}
