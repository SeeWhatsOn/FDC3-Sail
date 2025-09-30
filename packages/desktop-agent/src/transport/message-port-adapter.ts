/**
 * MessagePort Transport Adapter for FDC3 Desktop Agent
 *
 * Implements the TransportAdapter interface using browser MessagePort as the transport mechanism.
 * Follows DACP specification for message routing and timeout handling.
 */

import { v4 as uuid } from 'uuid'
import type { DACPMessage, TransportAdapter, TransportConfig } from './types'

/**
 * Default timeout per DACP specification (10 seconds)
 */
const DEFAULT_TIMEOUT_MS = 10000

/**
 * Creates a MessagePort transport adapter for DACP communication
 *
 * @param port - Browser MessagePort instance
 * @param config - Optional transport configuration
 * @returns TransportAdapter implementation
 */
export function createMessagePortAdapter(
  port: MessagePort,
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

  // Track original onmessage handler to chain calls
  const originalOnMessage = port.onmessage

  /**
   * Main message handler - routes messages to appropriate handlers
   */
  port.onmessage = (event: MessageEvent) => {
    const message: DACPMessage = event.data

    if (debug) {
      console.log('[MessagePort Adapter] Received message:', {
        type: message.type,
        hasResponseUuid: !!message.meta.responseUuid,
        hasRequestUuid: !!message.meta.requestUuid
      })
    }

    // Check if it's a response to a pending request
    if (message.meta.responseUuid) {
      const pending = pendingRequests.get(message.meta.responseUuid)
      if (pending) {
        clearTimeout(pending.timeoutId)
        pendingRequests.delete(message.meta.responseUuid)
        pending.resolve(message)
        return
      }
    }

    // Check if it's an event message with a registered listener
    const eventHandler = eventListeners.get(message.type)
    if (eventHandler) {
      eventHandler(message)
      return
    }

    // Chain to original handler if present
    if (originalOnMessage) {
      originalOnMessage.call(port, event)
    }
  }

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
        console.log('[MessagePort Adapter] Sending request:', {
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
      port.postMessage(message)
    })
  }

  /**
   * Listen for DACP event messages of a specific type
   */
  const listen = (messageType: string, handler: (message: DACPMessage) => void): void => {
    if (debug) {
      console.log('[MessagePort Adapter] Listening for events:', { messageType })
    }

    // Store handler for routing
    eventListeners.set(messageType, handler)
  }

  /**
   * Stop listening for a specific message type
   */
  const unlisten = (messageType: string): void => {
    if (debug) {
      console.log('[MessagePort Adapter] Stopping listener:', { messageType })
    }

    eventListeners.delete(messageType)
  }

  /**
   * Disconnect and cleanup
   */
  const disconnect = (): void => {
    if (debug) {
      console.log('[MessagePort Adapter] Disconnecting...')
    }

    // Clear all pending requests
    for (const [requestUuid, pending] of pendingRequests.entries()) {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error('Transport disconnected'))
    }
    pendingRequests.clear()

    // Clear all event listeners
    eventListeners.clear()

    // Reset message handler
    port.onmessage = originalOnMessage

    // Close the port
    port.close()

    if (debug) {
      console.log('[MessagePort Adapter] Disconnected')
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
 * Type guard to check if a value is a MessagePort
 */
export function isMessagePort(value: any): value is MessagePort {
  return value && typeof value === 'object' && 'postMessage' in value && 'close' in value
}