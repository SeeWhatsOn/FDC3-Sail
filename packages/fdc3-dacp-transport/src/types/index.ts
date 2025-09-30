/**
 * FDC3 DACP Transport Types
 *
 * These types define the transport abstraction layer for routing
 * FDC3 Desktop Agent Communication Protocol (DACP) messages over
 * different transport mechanisms (Socket.IO, MessagePort, etc.)
 */

// import type { BrowserTypes } from "@finos/fdc3"
import type { Socket } from "socket.io-client"

/**
 * A DACP message that conforms to FDC3 specifications.
 * This is the wire format for all FDC3 API operations.
 */
export type DACPMessage = any // Will be properly typed from @finos/fdc3-schema

/**
 * Transport adapter interface - abstracts the underlying transport mechanism.
 * Implementations handle the actual sending/receiving of DACP messages.
 */
export interface DACPTransport {
  /**
   * Sends a DACP message from the FDC3 app to the Desktop Agent.
   * The transport is responsible for delivering this message and
   * handling any transport-specific concerns (acknowledgments, retries, etc.)
   *
   * @param message - DACP message from the FDC3 app
   */
  send(message: DACPMessage): void

  /**
   * Registers a listener for incoming DACP messages from the Desktop Agent.
   * The transport invokes this callback when it receives a message
   * destined for the FDC3 app.
   *
   * @param listener - Callback to handle incoming DACP messages
   */
  onMessage(listener: (message: DACPMessage) => void): void

  /**
   * Cleans up transport resources (close connections, remove listeners, etc.)
   */
  dispose(): void
}

/**
 * Session information for an FDC3 app instance.
 * Used to identify and route messages for a specific app.
 */
export interface SessionInfo {
  /** Unique identifier for the user session / desktop agent instance */
  userSessionId: string

  /** Unique identifier for this specific app instance */
  instanceId: string

  /** FDC3 App ID */
  appId: string
}

/**
 * Configuration for creating a WCP handler.
 */
export interface WCPHandlerConfig {
  /** Transport to use for routing DACP messages */
  transport: DACPTransport

  /** Session information for this app instance */
  sessionInfo: SessionInfo

  /** Optional URLs for FDC3 UI components */
  intentResolverUrl?: string
  channelSelectorUrl?: string

  /** FDC3 version to report in handshake */
  fdc3Version?: string

  /** Enable debug logging */
  debug?: boolean
}

/**
 * Result of WCP handshake setup.
 * Contains cleanup function and handshake handler.
 */
export interface WCPHandlerResult {
  /**
   * Handles incoming WCP1Hello messages from FDC3 apps.
   * Call this when a postMessage with WCP1Hello is received.
   *
   * @param event - MessageEvent containing WCP1Hello
   * @param contentWindow - The iframe's window that sent the message
   */
  handleWCPMessage(event: MessageEvent, contentWindow: Window): Promise<void>

  /**
   * Cleans up all listeners and resources.
   */
  dispose(): void
}

/**
 * Factory function type for creating transport adapters.
 */
export type TransportFactory<TConfig = any> = (config: TConfig) => DACPTransport

/**
 * Socket.IO transport configuration.
 */
export interface SocketIOTransportConfig {
  /** Socket.IO client socket instance */
  socket: Socket // Socket from 'socket.io-client'

  /** Session information for routing */
  sessionInfo: SessionInfo

  /** Event name for app→agent messages (default: 'fdc3_app_event') */
  appEventName?: string

  /** Event name for agent→app messages (default: 'fdc3_da_event') */
  daEventName?: string

  /** Enable debug logging */
  debug?: boolean
}

/**
 * MessagePort transport configuration.
 */
export interface MessagePortTransportConfig {
  /** MessagePort to communicate over */
  port: MessagePort

  /** Enable debug logging */
  debug?: boolean
}
