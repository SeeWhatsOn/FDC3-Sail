/**
 * Remote Desktop Agent preset — WCPConnector only (server/worker mode).
 */

import type { Transport } from "../core/interfaces/transport"
import { consoleLogger } from "../core/interfaces/logger"
import type { Logger } from "../core/interfaces/logger"
import { WCPConnector } from "../app-connection/wcp-connector"
import type { WCPConnectorOptions } from "../app-connection/wcp-connector"

export interface WCPClientOptions {
  /** Transport to the remote Desktop Agent (Socket.IO, Web Worker, etc.). */
  transport: Transport
  wcpOptions?: WCPConnectorOptions
  logger?: Logger
}

export interface WCPClientResult {
  wcpConnector: WCPConnector
  start: () => void
  stop: () => void
}

/**
 * Create a WCP client for connecting to a remote Desktop Agent.
 *
 * @example
 * ```typescript
 * const { wcpConnector, start } = createWCPClient({ transport })
 * start()
 * ```
 */
export function createWCPClient(options: WCPClientOptions): WCPClientResult {
  const logger = options.logger ?? consoleLogger
  const wcpConnector = new WCPConnector(options.transport, { ...options.wcpOptions, logger })

  wcpConnector.on("appConnected", metadata => {
    logger.info(`[WCPClient] App connected: ${metadata.appId} (${metadata.instanceId})`)
  })

  wcpConnector.on("appDisconnected", instanceId => {
    logger.info(`[WCPClient] App disconnected: ${instanceId}`)
  })

  wcpConnector.on("handshakeFailed", (error, connectionAttemptUuid) => {
    logger.error(`[WCPClient] WCP handshake failed for ${connectionAttemptUuid}:`, error)
  })

  return {
    wcpConnector,
    start: () => wcpConnector.start(),
    stop: () => wcpConnector.stop(),
  }
}
