/**
 * Socket.IO Transport Adapter for FDC3 Desktop Agent
 *
 * Implements the TransportAdapter interface using Socket.IO as the transport mechanism.
 * Follows DACP specification for message routing and timeout handling.
 */

import type { Socket } from 'socket.io-client'
import { v4 as uuid } from 'uuid'
import type { DACPMessage, TransportAdapter, TransportConfig } from './types'

/**
 * Default timeout per DACP specification (10 seconds)
 */
const DEFAULT_TIMEOUT_MS = 10000

/**
 * Socket.IO event names for FDC3 DACP communication
 */
const SOCKET_EVENTS = {
  REQUEST: 'fdc3:request',
  RESPONSE: 'fdc3:response',
  EVENT_PREFIX: 'fdc3:event:'
} as const

/**
 * Creates a Socket.IO transport adapter for DACP communication
 *
 * @param socket - Socket.IO client socket instance
 * @param config - Optional transport configuration
 * @returns TransportAdapter implementation
 */
export function createSocketIOAdapter(
  socket: Socket,
  config: TransportConfig = {}
): TransportAdapter {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS
  const debug = config.debug ?? false

  // Map to track pending requests: requestUuid -> { resolve, reject }
  const pendingRequests = new Map<string, {
    resolve: (message: DACPMessage) => void
    reject: (error: Error) => void
    timeoutId: NodeJS.Timeout
  }>()

  // Map to track event listeners: messageType -> handler
  const eventListeners = new Map<string, (message: DACPMessage) => void>()

  // Listen for all response messages
  socket.on(SOCKET_EVENTS.RESPONSE, (message: DACPMessage) => {
    const { responseUuid } = message.meta

    if (debug) {
      console.log('[SocketIO Adapter] Received response:', {
        type: message.type,
        responseUuid
      })
    }

    if (responseUuid && pendingRequests.has(responseUuid)) {
      const pending = pendingRequests.get(responseUuid)!
      clearTimeout(pending.timeoutId)
      pendingRequests.delete(responseUuid)
      pending.resolve(message)
    }
  })

  /**
   * Send a DACP message and await response
   */
  const send = (message: DACPMessage): Promise<DACPMessage> => {
    return new Promise((resolve, reject) => {
      const requestUuid = uuid()

      // Add request metadata
      message.meta = {
        ...message.meta,
        requestUuid,
        timestamp: new Date().toISOString()
      }

      if (debug) {
        console.log('[SocketIO Adapter] Sending request:', {
          type: message.type,
          requestUuid
        })
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (pendingRequests.has(requestUuid)) {
          pendingRequests.delete(requestUuid)
          reject(new Error(`Timeout: ${message.type} (${timeout}ms)`))
        }
      }, timeout)

      // Store pending request
      pendingRequests.set(requestUuid, { resolve, reject, timeoutId })

      // Send the message
      socket.emit(SOCKET_EVENTS.REQUEST, message)
    })
  }

  /**
   * Listen for DACP event messages of a specific type
   */
  const listen = (messageType: string, handler: (message: DACPMessage) => void): void => {
    const eventName = `${SOCKET_EVENTS.EVENT_PREFIX}${messageType}`

    if (debug) {
      console.log('[SocketIO Adapter] Listening for events:', { messageType, eventName })
    }

    // Store handler for cleanup
    eventListeners.set(messageType, handler)

    // Register Socket.IO listener
    socket.on(eventName, handler)
  }

  /**
   * Stop listening for a specific message type
   */
  const unlisten = (messageType: string): void => {
    const eventName = `${SOCKET_EVENTS.EVENT_PREFIX}${messageType}`

    if (debug) {
      console.log('[SocketIO Adapter] Stopping listener:', { messageType, eventName })
    }

    const handler = eventListeners.get(messageType)
    if (handler) {
      socket.off(eventName, handler)
      eventListeners.delete(messageType)
    }
  }

  /**
   * Disconnect and cleanup
   */
  const disconnect = (): void => {
    if (debug) {
      console.log('[SocketIO Adapter] Disconnecting...')
    }

    // Clear all pending requests
    for (const [requestUuid, pending] of pendingRequests.entries()) {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error('Transport disconnected'))
    }
    pendingRequests.clear()

    // Remove all event listeners
    for (const [messageType] of eventListeners.entries()) {
      unlisten(messageType)
    }

    // Remove response listener
    socket.off(SOCKET_EVENTS.RESPONSE)

    if (debug) {
      console.log('[SocketIO Adapter] Disconnected')
    }
  }

  return {
    send,
    listen,
    unlisten,
    disconnect
  }
}

/**
 * Type guard to check if a value is a Socket.IO socket
 */
export function isSocketIOSocket(value: any): value is Socket {
  return value && typeof value === 'object' && 'emit' in value && 'on' in value && 'off' in value
}