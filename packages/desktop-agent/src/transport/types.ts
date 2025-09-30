/**
 * Transport Abstraction Layer for FDC3 Desktop Agent
 *
 * Provides a transport-agnostic interface for DACP communication,
 * supporting multiple transport mechanisms (Socket.IO, MessagePort, etc.)
 */

import type { DACPMessage as DACPMessageType } from "@finos/fdc3-schema"

/**
 * DACP Message Format - Standard structure for all DACP messages
 */
export interface DACPMessage<Payload = unknown> {
  /** Message type (e.g., "findIntentRequest", "findIntentResponse") */
  type: string

  /** Message payload */
  payload: Payload

  /** Message metadata */
  meta: {
    /** Request UUID - present on request messages */
    requestUuid?: string

    /** Response UUID - present on response messages (matches original requestUuid) */
    responseUuid?: string

    /** ISO 8601 timestamp */
    timestamp: string

    /** Optional source identifier */
    source?: string

    /** Connection attempt UUID for WCP messages */
    connectionAttemptUuid?: string
  }
}

/**
 * Transport Adapter Interface
 *
 * Provides a unified interface for sending and receiving DACP messages
 * across different transport mechanisms.
 */
export interface TransportAdapter {
  /**
   * Send a DACP message and await response
   *
   * @param message - DACP message to send
   * @returns Promise resolving to the response message
   * @throws Error on timeout (10 seconds per DACP spec)
   */
  send(message: DACPMessage): Promise<DACPMessage>

  /**
   * Listen for DACP messages of a specific type
   *
   * @param messageType - Type of message to listen for
   * @param handler - Callback to handle incoming messages
   */
  listen(messageType: string, handler: (message: DACPMessage) => void): void

  /**
   * Stop listening for a specific message type
   *
   * @param messageType - Type of message to stop listening for
   */
  unlisten?(messageType: string): void

  /**
   * Disconnect and cleanup the transport
   */
  disconnect?(): void
}

/**
 * Transport configuration options
 */
export interface TransportConfig {
  /** Timeout in milliseconds (default: 10000 per DACP spec) */
  timeout?: number

  /** Enable debug logging */
  debug?: boolean
}

/**
 * Transport events
 */
export interface TransportEvents {
  /** Transport connected */
  connect?: () => void

  /** Transport disconnected */
  disconnect?: () => void

  /** Transport error occurred */
  error?: (error: Error) => void

  /** Message received */
  message?: (message: DACPMessage) => void
}
