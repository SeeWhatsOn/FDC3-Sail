/**
 * Browser Desktop Agent Factory
 *
 * Factory function for creating a complete browser-based Desktop Agent
 * with WCP connector for handling iframe app connections.
 *
 * This module combines:
 * - Pure Desktop Agent core
 * - WCP Connector for browser app connections
 * - InMemory transport pair for local communication
 */

import { DesktopAgent } from "../core/desktop-agent"
import type { DesktopAgentConfig } from "../core/desktop-agent"
import { WCPConnector } from "./wcp-connector"
import type { WCPConnectorOptions } from "./wcp-connector"
import type { AppLauncher } from "../core/interfaces/app-launcher"
import type { AppInstanceRegistry } from "../core/state/app-instance-registry"
import type { IntentRegistry } from "../core/state/intent-registry"
import type { ChannelContextRegistry } from "../core/state/channel-context-registry"
import type { AppChannelRegistry } from "../core/state/app-channel-registry"
import type { UserChannelRegistry } from "../core/state/user-channel-registry"
import { createInMemoryTransportPair } from "../transports/in-memory-transport"
import { cleanupDACPHandlers } from "../core/handlers/dacp/index"

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
 * This factory creates a complete FDC3 Desktop Agent setup for browser environments:
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
 * // Create browser Desktop Agent
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
    appLauncher: options?.appLauncher as any,
    appInstanceRegistry: options?.registries?.appInstanceRegistry as any,
    intentRegistry: options?.registries?.intentRegistry as any,
    channelContextRegistry: options?.registries?.channelContextRegistry as any,
    appChannelRegistry: options?.registries?.appChannelRegistry as any,
    userChannelRegistry: options?.registries?.userChannelRegistry as any,
    // Enable UI-based intent resolution via WCPConnector
    requestIntentResolution: (request) => wcpConnector.requestIntentResolution(request),
  }

  // Create Desktop Agent
  const desktopAgent = new DesktopAgent(daConfig)

  // Load app directories if provided
  if (options?.appDirectories && options.appDirectories.length > 0) {
    const appDirectory = desktopAgent.getAppDirectory()
    for (const directory of options.appDirectories) {
      appDirectory.loadDirectory(directory)
    }
  }

  // Set up event forwarding from WCP Connector to Desktop Agent
  // When WCP Connector establishes a connection, we need to notify Desktop Agent
  wcpConnector.on("appConnected", (metadata) => {
    // Desktop Agent will have already processed WCP4 validation via transport
    // This event is for external observers (e.g., UI updates)
    console.log(`App connected: ${metadata.appId} (${metadata.instanceId})`)
  })

  wcpConnector.on("appDisconnected", (instanceId) => {
    // Explicitly trigger desktop agent cleanup for this instance
    // This ensures the instance is removed from all registries (including intent registry)
    // so that the intent resolver no longer sees it as a running instance
    console.log(`App disconnected: ${instanceId}, triggering cleanup`)
    try {
      // Create handler context for cleanup
      const context = {
        transport: daTransport,
        instanceId,
        appInstanceRegistry: desktopAgent.getAppInstanceRegistry(),
        intentRegistry: desktopAgent.getIntentRegistry(),
        channelContextRegistry: desktopAgent.getChannelContextRegistry(),
        appChannelRegistry: desktopAgent.getAppChannelRegistry(),
        userChannelRegistry: desktopAgent.getUserChannelRegistry(),
        appDirectory: desktopAgent.getAppDirectory(),
        appLauncher: daConfig.appLauncher,
        requestIntentResolution: daConfig.requestIntentResolution,
      }
      // Call cleanup function to remove instance from all registries
      cleanupDACPHandlers(context)
      console.log(`Cleanup completed for instance ${instanceId}`)
    } catch (error) {
      console.error(`Error cleaning up instance ${instanceId}:`, error)
    }
  })

  wcpConnector.on("handshakeFailed", (error, connectionAttemptUuid) => {
    console.error(`WCP handshake failed for ${connectionAttemptUuid}:`, error)
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
