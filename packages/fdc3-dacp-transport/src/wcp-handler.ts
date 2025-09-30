/**
 * WCP (Web Connection Protocol) Handler
 *
 * Handles the FDC3 Web Connection Protocol handshake and bridges
 * MessagePort communication to the configured transport.
 *
 * This is the glue that connects:
 * 1. FDC3 app's WCP handshake (postMessage)
 * 2. MessagePort from WCP handshake
 * 3. Your chosen transport (Socket.IO, MessagePort, etc.)
 */

import { BrowserTypes } from "@finos/fdc3"
import { isWebConnectionProtocol1Hello } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import type { WCPHandlerConfig, WCPHandlerResult, DACPMessage } from "./types"

/**
 * Creates a WCP handler that manages FDC3 Web Connection Protocol handshakes
 * and bridges MessagePort to the configured transport.
 *
 * @param config - WCP handler configuration
 * @returns Handler result with message handler and cleanup function
 *
 * @example
 * ```typescript
 * import { createWCPHandler, createSocketIOTransport } from '@finos/fdc3-dacp-transport'
 * import { io } from 'socket.io-client'
 *
 * const socket = io('http://localhost:3000')
 * const transport = createSocketIOTransport({ socket, sessionInfo })
 * const handler = createWCPHandler({ transport, sessionInfo })
 *
 * // Register to listen for WCP messages
 * window.addEventListener('message', (event) => {
 *   handler.handleWCPMessage(event, iframeWindow)
 * })
 *
 * // Cleanup when done
 * handler.dispose()
 * ```
 */
export function createWCPHandler(config: WCPHandlerConfig): WCPHandlerResult {
  const {
    transport,
    // sessionInfo,
    intentResolverUrl,
    channelSelectorUrl,
    fdc3Version = "2.2",
    debug = false,
  } = config

  const activeChannels = new Set<MessageChannel>()
  let isDisposed = false

  const log = (...args: unknown[]) => {
    if (debug) {
      console.log("[WCP-Handler]", ...args)
    }
  }

  /**
   * Links a MessagePort to the transport.
   * Creates a bidirectional bridge between the FDC3 app and Desktop Agent.
   */
  function linkMessagePortToTransport(channel: MessageChannel): void {
    log("Linking MessagePort to transport")

    // App → Transport → Desktop Agent
    channel.port2.onmessage = (event: MessageEvent) => {
      if (isDisposed) return

      const message = event.data
      log("App → Desktop Agent:", message)
      transport.send(message)
    }

    // Desktop Agent → Transport → App
    transport.onMessage((message: DACPMessage) => {
      if (isDisposed) return

      log("Desktop Agent → App:", message)
      channel.port2.postMessage(message)
    })

    activeChannels.add(channel)
    log("MessagePort linked to transport")
  }

  /**
   * Handles incoming WCP1Hello messages and completes the handshake.
   */
  async function handleWCPMessage(event: MessageEvent, contentWindow: Window): Promise<void> {
    if (isDisposed) {
      log("Handler disposed, ignoring message")
      return
    }

    log("Received message from:", event.origin)

    // Validate it's a WCP1Hello message from the expected window
    if (!isWebConnectionProtocol1Hello(event.data)) {
      log("Not a valid WCP1Hello message:", event.data)
      return
    }

    const messageData = event.data

    if (event.source !== contentWindow) {
      log("Message source mismatch, ignoring")
      return
    }

    log("Valid WCP1Hello received:", messageData)

    try {
      // Per FDC3 WCP spec: Desktop Agent responds immediately with WCP3Handshake + MessagePort
      // App identity validation happens AFTER via WCP4ValidateAppIdentity on the MessagePort

      // 1. Create MessageChannel for app communication
      const channel = new MessageChannel()
      log("Created MessageChannel for app communication")

      // 2. Link the MessagePort to our transport
      // This allows the Desktop Agent to receive WCP4ValidateAppIdentity and DACP messages
      linkMessagePortToTransport(channel)

      // 3. Build WCP3Handshake response per FDC3 spec
      const handshakeResponse: BrowserTypes.WebConnectionProtocol3Handshake = {
        type: "WCP3Handshake",
        meta: {
          connectionAttemptUuid: messageData.meta.connectionAttemptUuid,
          timestamp: new Date(),
        },
        payload: {
          fdc3Version,
          intentResolverUrl,
          channelSelectorUrl,
        },
      }

      log("Sending WCP3Handshake response with MessagePort:", handshakeResponse)

      // 4. Send WCP3Handshake with MessagePort to the app
      // App will then send WCP4ValidateAppIdentity on this MessagePort
      contentWindow.postMessage(handshakeResponse, "*", [channel.port1])

      log("WCP3Handshake sent. App will now send WCP4ValidateAppIdentity for validation.")
    } catch (error) {
      console.error("[WCP-Handler] Error during handshake:", error)
      throw error
    }
  }

  /**
   * Cleans up all resources.
   */
  function dispose(): void {
    if (isDisposed) return

    log("Disposing WCP handler")

    // Close all active MessageChannels
    activeChannels.forEach(channel => {
      channel.port2.close()
    })
    activeChannels.clear()

    // Dispose the transport
    transport.dispose()

    isDisposed = true
    log("WCP handler disposed")
  }

  return {
    handleWCPMessage,
    dispose,
  }
}
