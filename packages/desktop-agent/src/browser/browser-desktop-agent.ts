/**
 * Browser Desktop Agent Factory
 *
 * Functions for creating FDC3 Desktop Agent setups in browser environments.
 *
 * Provides two main patterns:
 * 1. `createWCPClient` - WCPConnector only, for when Desktop Agent is remote (server/worker)
 * 2. `createBrowserDesktopAgent` - Complete local setup (WCPConnector + DesktopAgent in same process)
 *
 * Both patterns use the same WCPConnector, just with different transports:
 * - Local mode: InMemoryTransport pair
 * - Remote mode: SocketIO, WebWorker, or any Transport implementation
 */

import { DesktopAgent } from "../core/desktop-agent"
import type { DesktopAgentConfig } from "../core/desktop-agent"
import { WCPConnector } from "./wcp/wcp-connector"
import type { WCPConnectorOptions } from "./wcp/wcp-connector"
import type { Transport } from "../core/interfaces/transport"
import type { AppLauncher } from "../core/interfaces/app-launcher"
import type { AppInstanceRegistry } from "../core/state/app-instance-registry"
import type { IntentRegistry } from "../core/state/intent-registry"
import type { ChannelContextRegistry } from "../core/state/channel-context-registry"
import type { AppChannelRegistry } from "../core/state/app-channel-registry"
import type { UserChannelRegistry } from "../core/state/user-channel-registry"
import { createInMemoryTransportPair } from "../transports/in-memory-transport"

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
  const wcpConnector = new WCPConnector(options.transport, options.wcpOptions)

  // Set up event handlers for logging/debugging
  wcpConnector.on("appConnected", metadata => {
    console.log(`[WCPClient] App connected: ${metadata.appId} (${metadata.instanceId})`)
  })

  wcpConnector.on("appDisconnected", instanceId => {
    // Cleanup is handled via WCP6Goodbye message through transport
    // No direct Desktop Agent manipulation needed
    console.log(`[WCPClient] App disconnected: ${instanceId}`)
  })

  wcpConnector.on("handshakeFailed", (error, connectionAttemptUuid) => {
    console.error(`[WCPClient] WCP handshake failed for ${connectionAttemptUuid}:`, error)
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
 * Options for creating a browser-based Desktop Agent
 */
export interface BrowserDesktopAgentOptions {
  /**
   * WCP connector configuration
   */
  wcpOptions?: WCPConnectorOptions

  /**
   * App directories to load (URIs to directory JSON files or URLs)
   */
  appDirectories?: string[]

  /**
   * Custom app launcher implementation
   */
  appLauncher?: AppLauncher

  /**
   * Custom registries (for advanced use cases)
   */
  registries?: {
    appInstanceRegistry?: AppInstanceRegistry
    intentRegistry?: IntentRegistry
    channelContextRegistry?: ChannelContextRegistry
    appChannelRegistry?: AppChannelRegistry
    userChannelRegistry?: UserChannelRegistry
  }
}

/**
 * Result of creating a browser Desktop Agent
 */
export interface BrowserDesktopAgentResult {
  /**
   * The Desktop Agent instance
   */
  desktopAgent: DesktopAgent

  /**
   * The WCP connector instance (handles iframe connections)
   */
  wcpConnector: WCPConnector

  /**
   * Start the Desktop Agent and WCP connector
   */
  start: () => void

  /**
   * Stop the Desktop Agent and WCP connector
   */
  stop: () => void
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
 * @returns Object with desktopAgent, wcpConnector, and control methods
 *
 * @example
 * ```typescript
 * // Create browser Desktop Agent (local mode)
 * const { desktopAgent, wcpConnector, start } = createBrowserDesktopAgent({
 *   wcpOptions: {
 *     getIntentResolverUrl: (instanceId) => `/resolver?id=${instanceId}`,
 *     getChannelSelectorUrl: (instanceId) => `/selector?id=${instanceId}`
 *   },
 *   appDirectories: [myAppDirectory]
 * })
 *
 * // Start both Desktop Agent and WCP Connector
 * start()
 *
 * // Desktop Agent is now ready to handle FDC3 apps in iframes
 * // Apps will connect via WCP when they call fdc3.getAgent()
 * ```
 *
 * @example
 * ```typescript
 * // For Sail-controlled UI (no injected iframes)
 * const { desktopAgent, wcpConnector, start } = createBrowserDesktopAgent({
 *   wcpOptions: {
 *     // Return false to indicate Sail provides UI externally
 *     getIntentResolverUrl: () => false,
 *     getChannelSelectorUrl: () => false
 *   }
 * })
 *
 * start()
 *
 * // Apps receive WCP3Handshake with:
 * // { intentResolverUrl: false, channelSelectorUrl: false }
 * // Indicating Sail UI parent window controls UI
 * ```
 */
export function createBrowserDesktopAgent(
  options?: BrowserDesktopAgentOptions
): BrowserDesktopAgentResult {
  // Create in-memory transport pair
  // daTransport: Used by Desktop Agent
  // connectorTransport: Used by WCP Connector
  const [daTransport, connectorTransport] = createInMemoryTransportPair()

  // Create WCP Connector first (so we can reference its methods)
  const wcpConnector = new WCPConnector(connectorTransport, options?.wcpOptions)

  // Build Desktop Agent configuration
  // Wire up WCPConnector's requestIntentResolution for UI-based intent resolution
  const daConfig: DesktopAgentConfig = {
    transport: daTransport,
    appLauncher: options?.appLauncher as AppLauncher,
    appInstanceRegistry: options?.registries?.appInstanceRegistry as AppInstanceRegistry,
    intentRegistry: options?.registries?.intentRegistry as IntentRegistry,
    channelContextRegistry: options?.registries?.channelContextRegistry as ChannelContextRegistry,
    appChannelRegistry: options?.registries?.appChannelRegistry as AppChannelRegistry,
    userChannelRegistry: options?.registries?.userChannelRegistry as UserChannelRegistry,
    // Enable UI-based intent resolution via WCPConnector
    requestIntentResolution: request => wcpConnector.requestIntentResolution(request),
  }

  // Create Desktop Agent
  const desktopAgent = new DesktopAgent(daConfig)

  // Load app directories if provided
  if (options?.appDirectories && options.appDirectories.length > 0) {
    const appDirectory = desktopAgent.getAppDirectory()
    for (const directory of options.appDirectories) {
      void appDirectory.loadDirectory(directory)
    }
  }

  // Set up event forwarding from WCP Connector
  // These are for external observers (e.g., UI updates)
  // Cleanup is now handled via WCP6Goodbye message through transport
  wcpConnector.on("appConnected", metadata => {
    console.log(`[BrowserDA] App connected: ${metadata.appId} (${metadata.instanceId})`)
  })

  wcpConnector.on("appDisconnected", instanceId => {
    // Cleanup is handled via WCP6Goodbye message through transport
    // The Desktop Agent's WCP6Goodbye handler calls cleanupDACPHandlers
    // No direct manipulation of Desktop Agent internals needed
    console.log(`[BrowserDA] App disconnected: ${instanceId}`)
  })

  wcpConnector.on("handshakeFailed", (error, connectionAttemptUuid) => {
    console.error(`[BrowserDA] WCP handshake failed for ${connectionAttemptUuid}:`, error)
  })

  /**
   * Start both Desktop Agent and WCP Connector
   */
  function start(): void {
    desktopAgent.start()
    wcpConnector.start()
  }

  /**
   * Stop both Desktop Agent and WCP Connector
   */
  function stop(): void {
    wcpConnector.stop()
    desktopAgent.stop()
  }

  return {
    desktopAgent,
    wcpConnector,
    start,
    stop,
  }
}
