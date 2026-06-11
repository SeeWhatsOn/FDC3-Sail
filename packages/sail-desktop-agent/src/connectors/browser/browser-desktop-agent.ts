/**
 * Browser Desktop Agent Factory
 *
 * EXAMPLE/REFERENCE IMPLEMENTATION
 *
 * This file provides example factory functions for creating FDC3 Desktop Agent
 * setups in browser environments. These serve as reference implementations
 * showing how to wire up the core components (DesktopAgent, WCPConnector,
 * InMemoryTransport) together.
 *
 * For Sail-specific usage, see `SailPlatform` in @finos/sail-platform-api which
 * inlines this logic with Sail-specific customizations.
 *
 * Provides two patterns:
 * 1. `createWCPClient` - WCPConnector only, for when Desktop Agent is remote (server/worker)
 * 2. `createBrowserDesktopAgent` - Complete local setup (WCPConnector + DesktopAgent in same process)
 *
 * Both patterns use the same WCPConnector, just with different transports:
 * - Local mode: InMemoryTransport pair
 * - Remote mode: SocketIO, WebWorker, or any Transport implementation
 */

import { DesktopAgent } from "../../core"
import type { DesktopAgentOptions, Transport } from "../../core"
import type { SailImplementationMetadata } from "../../core/sail-default-config"
import { consoleLogger } from "../../core/interfaces/logger"
import type { Logger, LogPayloadDetail } from "../../core/interfaces/logger"
import { WCPConnector } from "./wcp-connector"
import type { AppConnectionMetadata, WCPConnectorOptions } from "./wcp-connector"
import { createInMemoryTransportPair } from "../../transports/in-memory-transport"
import { registerBrowserDesktopAgentSession } from "./browser-desktop-agent-session"

// ============================================================================
// WCP CLIENT (for remote Desktop Agent - server mode, worker mode)
// ============================================================================

/**
 * Options for creating a WCP client (WCPConnector only)
 */
export interface WCPClientOptions {
  /**
   * Transport to connect to the Desktop Agent.
   * This could be SocketIOClientTransport, WebWorkerTransport, etc.
   */
  transport: Transport

  /**
   * WCP connector configuration
   */
  wcpOptions?: WCPConnectorOptions

  /**
   * Logger instance for WCP and Desktop Agent operations.
   * OPTIONAL - defaults to consoleLogger if not provided.
   */
  logger?: Logger
}

/**
 * Result of creating a WCP client
 */
export interface WCPClientResult {
  /**
   * The WCP connector instance (handles iframe connections)
   */
  wcpConnector: WCPConnector

  /**
   * Start the WCP connector
   */
  start: () => void

  /**
   * Stop the WCP connector
   */
  stop: () => void
}

/**
 * Create a WCP client for connecting to a remote Desktop Agent.
 *
 * Use this when the Desktop Agent runs elsewhere (server, worker, etc.)
 * and you only need the browser-side WCP handling.
 *
 * @param options - Configuration options with transport
 * @returns WCPConnector with start/stop methods
 *
 * @example
 * ```typescript
 * // Server mode - Desktop Agent on server
 * const transport = new SocketIOClientTransport({ url: "wss://server.com" })
 * const { wcpConnector, start } = createWCPClient({
 *   transport,
 *   wcpOptions: {
 *     getIntentResolverUrl: () => false,  // Sail-controlled UI
 *     getChannelSelectorUrl: () => false,
 *   }
 * })
 * start()
 *
 * // Worker mode - Desktop Agent in Web Worker
 * const transport = new WebWorkerTransport(worker)
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

// ============================================================================
// BROWSER DESKTOP AGENT (local mode - WCPConnector + DesktopAgent same process)
// ============================================================================

/**
 * Options for creating a browser-based Desktop Agent.
 *
 * Extends core DesktopAgentConfig for appLauncher and userChannels,
 * adds browser-specific options for WCP and app directories.
 */
export interface BrowserDesktopAgentOptions extends Pick<
  DesktopAgentOptions,
  | "appLauncher"
  | "userChannels"
  | "apps"
  | "openContextListenerTimeoutMs"
  | "heartbeatEnabled"
  | "heartbeatIntervalMs"
  | "heartbeatTimeoutMs"
> {
  /**
   * Override FDC3 implementation metadata (FDC3-Sail defaults applied by factory).
   */
  implementationMetadata?: Partial<SailImplementationMetadata>
  /**
   * WCP connector configuration
   */
  wcpOptions?: WCPConnectorOptions

  /**
   * App directories to load (URIs to directory JSON files or URLs)
   */
  appDirectories?: string[]

  /**
   * Logger instance for WCP and Desktop Agent operations.
   * OPTIONAL - defaults to consoleLogger if not provided.
   */
  logger?: Logger

  /**
   * How much message/context detail agent-internal structured logs include.
   *
   * @defaultValue `'metadata'`
   *
   * @remarks Use with {@link BrowserDesktopAgentOptions.logger}: config selects
   * *what* to log; the logger selects *where* it goes. Full payloads appear on
   * {@link Logger.debug} only when set to `'full'`.
   */
  logPayloadDetail?: LogPayloadDetail

  /**
   * Call {@link DesktopAgent.start} (and the coupled browser edge) before returning.
   * Set to `false` when you need to configure the agent before it listens.
   *
   * @defaultValue `true`
   */
  autoStart?: boolean

  /** Fired when an iframe app completes the WCP handshake. */
  onAppConnected?: (metadata: AppConnectionMetadata) => void

  /** Fired when an iframe app disconnects. */
  onAppDisconnected?: (instanceId: string) => void

  /** Fired when WCP handshake fails before WCP4 completes. */
  onHandshakeFailed?: (error: Error, connectionAttemptUuid: string) => void
}

function wireBrowserDesktopAgentLifecycle(
  desktopAgent: DesktopAgent,
  wcpConnector: WCPConnector
): void {
  const originalStart = desktopAgent.start.bind(desktopAgent)
  const originalStop = desktopAgent.stop.bind(desktopAgent)

  desktopAgent.start = () => {
    if (!wcpConnector.getIsStarted()) {
      wcpConnector.start()
    }
    originalStart()
  }

  desktopAgent.stop = () => {
    wcpConnector.stop()
    originalStop()
  }
}

/**
 * Create a browser-based Desktop Agent with WCP connector.
 *
 * This factory creates a complete FDC3 Desktop Agent setup for browser environments
 * where both WCPConnector and DesktopAgent run in the same process:
 *
 * 1. Creates InMemoryTransport pair for Desktop Agent ↔ WCP Connector communication
 * 2. Creates Desktop Agent instance with the transport
 * 3. Creates WCP Connector instance to handle iframe app connections
 * 4. Returns both instances with convenience start/stop methods
 *
 * The WCP Connector automatically:
 * - Listens for WCP1Hello from iframe apps
 * - Creates MessageChannels and MessagePortTransports per app
 * - Bridges app MessagePorts to Desktop Agent transport
 * - Routes messages based on DACP metadata
 *
 * @param options - Configuration options
 * @returns DesktopAgent with browser edge coupled to {@link DesktopAgent.start} / {@link DesktopAgent.stop}
 *
 * @example
 * ```typescript
 * const desktopAgent = createBrowserDesktopAgent({
 *   appLauncher: myLauncher,
 *   intentResolver: myResolver,
 * })
 *
 * // Auto-started by default — iframe apps connect via fdc3.getAgent()
 * ```
 */
export function createBrowserDesktopAgent(options?: BrowserDesktopAgentOptions): DesktopAgent {
  const logger = options?.logger ?? consoleLogger

  // Create in-memory transport pair
  // daTransport: Used by Desktop Agent
  // connectorTransport: Used by WCP Connector
  const [daTransport, connectorTransport] = createInMemoryTransportPair()

  // Create WCP Connector first (so we can reference its methods)
  const wcpConnector = new WCPConnector(connectorTransport, { ...options?.wcpOptions, logger })

  const desktopAgent = new DesktopAgent({
    transport: daTransport,
    appLauncher: options?.appLauncher,
    apps: options?.apps,
    userChannels: options?.userChannels,
    implementationMetadata: options?.implementationMetadata,
    openContextListenerTimeoutMs: options?.openContextListenerTimeoutMs,
    heartbeatEnabled: options?.heartbeatEnabled,
    heartbeatIntervalMs: options?.heartbeatIntervalMs,
    heartbeatTimeoutMs: options?.heartbeatTimeoutMs,
    logger,
    logPayloadDetail: options?.logPayloadDetail,
    requestIntentResolution: request => wcpConnector.requestIntentResolution(request),
  })

  // Load app directories if provided
  if (options?.appDirectories && options.appDirectories.length > 0) {
    const appDirectory = desktopAgent.getAppDirectory()
    for (const directory of options.appDirectories) {
      void appDirectory.loadDirectory(directory)
    }
  }

  wcpConnector.on("appConnected", metadata => {
    logger.info(`[BrowserDA] App connected: ${metadata.appId} (${metadata.instanceId})`)
    options?.onAppConnected?.(metadata)
  })

  wcpConnector.on("appDisconnected", instanceId => {
    logger.info(`[BrowserDA] App disconnected: ${instanceId}`)
    options?.onAppDisconnected?.(instanceId)
  })

  wcpConnector.on("handshakeFailed", (error, connectionAttemptUuid) => {
    logger.error(`[BrowserDA] WCP handshake failed for ${connectionAttemptUuid}:`, error)
    options?.onHandshakeFailed?.(error, connectionAttemptUuid)
  })

  registerBrowserDesktopAgentSession(desktopAgent, { wcpConnector, connectorTransport })
  wireBrowserDesktopAgentLifecycle(desktopAgent, wcpConnector)

  if (options?.autoStart !== false) {
    desktopAgent.start()
  }

  return desktopAgent
}
