/**
 * MessagePort Transport Adapter
 *
 * Routes DACP messages between FDC3 apps and Desktop Agent over MessagePort.
 * This adapter is used when the Desktop Agent runs locally in the same process
 * (e.g., in the parent window for iframe-to-iframe communication).
 */

import type { DACPTransport, MessagePortTransportConfig, DACPMessage } from '../types'

/**
 * Creates a MessagePort transport adapter for routing DACP messages.
 *
 * Architecture:
 * [FDC3 App] → MessagePort (port1) → [This Transport (port2)] → [Desktop Agent]
 *
 * This is a simple pass-through transport that directly connects two MessagePorts.
 * Used when the Desktop Agent is local (same window/process).
 *
 * @param config - MessagePort transport configuration
 * @returns Transport adapter instance
 *
 * @example
 * ```typescript
 * import { createMessagePortTransport } from '@finos/fdc3-dacp-transport'
 *
 * const channel = new MessageChannel()
 * const transport = createMessagePortTransport({ port: channel.port2 })
 *
 * // port1 goes to the FDC3 app
 * // port2 (via this transport) connects to local Desktop Agent
 * ```
 */
export function createMessagePortTransport(config: MessagePortTransportConfig): DACPTransport {
  const { port, debug = false } = config

  let messageListener: ((message: DACPMessage) => void) | null = null
  let isDisposed = false

  const log = (...args: any[]) => {
    if (debug) {
      console.log('[MessagePort-Transport]', ...args)
    }
  }

  // Listen for messages from FDC3 app
  const handleMessage = (event: MessageEvent) => {
    if (isDisposed) return

    const message: DACPMessage = event.data
    log('Received message:', message)

    if (messageListener) {
      messageListener(message)
    }
  }

  port.onmessage = handleMessage
  log('MessagePort transport initialized')

  return {
    send(message: DACPMessage): void {
      if (isDisposed) {
        console.warn('[MessagePort-Transport] Cannot send - transport is disposed')
        return
      }

      log('Sending message:', message)
      port.postMessage(message)
    },

    onMessage(listener: (message: DACPMessage) => void): void {
      if (isDisposed) {
        console.warn('[MessagePort-Transport] Cannot register listener - transport is disposed')
        return
      }

      if (messageListener) {
        console.warn('[MessagePort-Transport] Listener already registered, replacing')
      }

      messageListener = listener
      log('Message listener registered')
    },

    dispose(): void {
      if (isDisposed) return

      log('Disposing transport')

      port.onmessage = null
      messageListener = null
      isDisposed = true

      // Note: We don't close the port here as it may be managed externally
      // The caller is responsible for closing the port if needed
    }
  }
}