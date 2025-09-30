/**
 * Socket.IO Transport Adapter
 *
 * Routes DACP messages between FDC3 apps and Desktop Agent over Socket.IO.
 * This adapter bridges MessagePort (from WCP) to Socket.IO events.
 */

import type { DACPTransport, SocketIOTransportConfig, DACPMessage } from "../types"

/**
 * Creates a Socket.IO transport adapter for routing DACP messages.
 *
 * Architecture:
 * [FDC3 App] → MessagePort → [This Transport] → Socket.IO → [Desktop Agent]
 *
 * The transport listens for messages on the app's MessagePort and forwards
 * them to the server via Socket.IO. It also listens for messages from the
 * server and posts them back to the app via MessagePort.
 *
 * @param config - Socket.IO transport configuration
 * @returns Transport adapter instance
 *
 * @example
 * ```typescript
 * import { io } from 'socket.io-client'
 * import { createSocketIOTransport } from '@finos/fdc3-dacp-transport'
 *
 * const socket = io('http://localhost:3000')
 * const transport = createSocketIOTransport({
 *   socket,
 *   sessionInfo: { userSessionId: '123', instanceId: 'abc', appId: 'myapp' }
 * })
 * ```
 */
export function createSocketIOTransport(config: SocketIOTransportConfig): DACPTransport {
  const {
    socket,
    sessionInfo,
    appEventName = "fdc3_app_event",
    daEventName = "fdc3_da_event",
    debug = false,
  } = config

  let messageListener: ((message: DACPMessage) => void) | null = null
  let isDisposed = false

  const log = (...args: unknown[]) => {
    if (debug) {
      console.log("[SocketIO-Transport]", ...args)
    }
  }

  // Listen for messages from Desktop Agent (server → app)
  const handleDaEvent = (data: DACPMessage) => {
    if (isDisposed) return

    log("Desktop Agent → App:", data)

    if (messageListener) {
      messageListener(data)
    }
  }

  socket.on(daEventName, handleDaEvent)
  log("Listening for Desktop Agent messages on:", daEventName)

  return {
    send(message: DACPMessage): void {
      if (isDisposed) {
        console.warn("[SocketIO-Transport] Cannot send - transport is disposed")
        return
      }

      log("App → Desktop Agent:", message)

      // Send to server with instance ID for routing
      socket.emit(appEventName, message, sessionInfo.instanceId)
    },

    onMessage(listener: (message: DACPMessage) => void): void {
      if (isDisposed) {
        console.warn("[SocketIO-Transport] Cannot register listener - transport is disposed")
        return
      }

      if (messageListener) {
        console.warn("[SocketIO-Transport] Listener already registered, replacing")
      }

      messageListener = listener
      log("Message listener registered")
    },

    dispose(): void {
      if (isDisposed) return

      log("Disposing transport")

      socket.off(daEventName, handleDaEvent)
      messageListener = null
      isDisposed = true
    },
  }
}
