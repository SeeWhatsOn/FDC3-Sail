/**
 * WCP Connector
 *
 * Handles Web Connection Protocol (WCP) handshake for browser-based Desktop Agents.
 * Manages WCP1-3 protocol steps and bridges MessagePorts to Desktop Agent transport.
 *
 * Key Responsibilities:
 * - Listen for WCP1Hello from iframe apps
 * - Create MessageChannel per app connection
 * - Send WCP3Handshake with port1 to app
 * - Bridge port2 to Desktop Agent transport
 * - Manage app connection lifecycle
 */

import type { Transport } from "../core/interfaces/transport"
import type { BrowserTypes } from "@finos/fdc3"
import { isWebConnectionProtocol1Hello } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { MessagePortTransport } from "./message-port-transport"

type WCP1HelloMessage = BrowserTypes.WebConnectionProtocol1Hello
type WCP3HandshakeMessage = BrowserTypes.WebConnectionProtocol3Handshake

/**
 * Configuration options for WCPConnector
 */
export interface WCPConnectorOptions {
  /**
   * Function to generate intent resolver URL for a given app instance.
   * Return undefined or false to indicate Sail-controlled UI (no injected iframe).
   *
   * @param instanceId - The app instance ID
   * @returns URL for intent resolver iframe, or undefined/false for Sail-controlled UI
   */
  getIntentResolverUrl?: (instanceId: string) => string | undefined | false

  /**
   * Function to generate channel selector URL for a given app instance.
   * Return undefined or false to indicate Sail-controlled UI (no injected iframe).
   *
   * @param instanceId - The app instance ID
   * @returns URL for channel selector iframe, or undefined/false for Sail-controlled UI
   */
  getChannelSelectorUrl?: (instanceId: string) => string | undefined | false

  /**
   * FDC3 version to advertise in WCP3Handshake.
   * Defaults to "2.2"
   */
  fdc3Version?: string

  /**
   * Timeout for WCP handshake completion (ms).
   * Defaults to 5000ms.
   */
  handshakeTimeout?: number
}

/**
 * Metadata about a connected app instance
 */
export interface AppConnectionMetadata {
  /**
   * Unique instance ID for this app connection
   */
  instanceId: string

  /**
   * App ID from app directory
   */
  appId: string

  /**
   * Connection attempt UUID from WCP1Hello
   */
  connectionAttemptUuid: string

  /**
   * Source window/iframe that initiated connection
   */
  source: Window

  /**
   * MessagePort for communication with this app
   */
  port: MessagePort

  /**
   * Timestamp when connection was established
   */
  connectedAt: Date
}

/**
 * Event types emitted by WCPConnector
 */
export interface WCPConnectorEvents {
  /**
   * Fired when a new app successfully completes WCP handshake
   */
  appConnected: (metadata: AppConnectionMetadata) => void

  /**
   * Fired when an app disconnects
   */
  appDisconnected: (instanceId: string) => void

  /**
   * Fired when handshake fails
   */
  handshakeFailed: (error: Error, connectionAttemptUuid: string) => void
}

/**
 * WCP Connector for browser-based Desktop Agents.
 *
 * This class handles the browser-specific parts of FDC3 app connections:
 * - WCP1-3 handshake protocol
 * - MessageChannel/MessagePort management
 * - Routing between app MessagePorts and Desktop Agent transport
 *
 * WCP Protocol Overview:
 * - WCP1Hello: App initiates connection via postMessage
 * - WCP2LoadUrl: (Optional) Desktop Agent requests app URL
 * - WCP3Handshake: Desktop Agent responds with MessagePort
 * - WCP4-5: App identity validation (handled by Desktop Agent core)
 *
 * @example
 * ```typescript
 * // Create connector with Desktop Agent transport
 * const connector = new WCPConnector(desktopAgentTransport, {
 *   getIntentResolverUrl: (instanceId) => `/intent-resolver?id=${instanceId}`,
 *   getChannelSelectorUrl: (instanceId) => `/channel-selector?id=${instanceId}`
 * })
 *
 * connector.on('appConnected', (metadata) => {
 *   console.log('App connected:', metadata.appId, metadata.instanceId)
 * })
 *
 * connector.start()
 * ```
 */
export class WCPConnector {
  private desktopAgentTransport: Transport
  private options: Required<WCPConnectorOptions>
  private isStarted: boolean = false
  private connections = new Map<string, AppConnectionMetadata>()
  private messagePortTransports = new Map<string, MessagePortTransport>()
  private eventHandlers = new Map<keyof WCPConnectorEvents, Set<Function>>()
  // Store bound handler reference for proper event listener cleanup
  private boundHandleWindowMessage = this.handleWindowMessage.bind(this)

  /**
   * Create a new WCP Connector
   *
   * @param desktopAgentTransport - Transport connected to Desktop Agent
   * @param options - WCP connector configuration
   */
  constructor(desktopAgentTransport: Transport, options?: WCPConnectorOptions) {
    this.desktopAgentTransport = desktopAgentTransport
    this.options = {
      getIntentResolverUrl: options?.getIntentResolverUrl ?? (() => false),
      getChannelSelectorUrl: options?.getChannelSelectorUrl ?? (() => false),
      fdc3Version: options?.fdc3Version ?? "2.2",
      handshakeTimeout: options?.handshakeTimeout ?? 5000,
    }

    // Listen to Desktop Agent transport for messages to route to apps
    this.desktopAgentTransport.onMessage(this.handleDesktopAgentMessage.bind(this))
  }

  /**
   * Start listening for WCP1Hello messages from apps
   */
  start(): void {
    if (this.isStarted) {
      throw new Error("WCPConnector is already started")
    }

    if (typeof window === "undefined") {
      throw new Error("WCPConnector requires browser environment (window object)")
    }

    window.addEventListener("message", this.boundHandleWindowMessage)
    this.isStarted = true
  }

  /**
   * Stop the connector and clean up all connections
   */
  stop(): void {
    if (!this.isStarted) {
      return
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("message", this.boundHandleWindowMessage)
    }

    // Disconnect all apps
    for (const [instanceId] of this.connections) {
      this.disconnectApp(instanceId)
    }

    this.isStarted = false
  }

  /**
   * Register an event handler
   *
   * @param event - Event name
   * @param handler - Event handler function
   */
  on<EventName extends keyof WCPConnectorEvents>(
    event: EventName,
    handler: WCPConnectorEvents[EventName]
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Remove an event handler
   *
   * @param event - Event name
   * @param handler - Event handler function
   */
  off<EventName extends keyof WCPConnectorEvents>(
    event: EventName,
    handler: WCPConnectorEvents[EventName]
  ): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit<EventName extends keyof WCPConnectorEvents>(
    event: EventName,
    ...args: Parameters<WCPConnectorEvents[EventName]>
  ): void {
    const handlers = this.eventHandlers.get(event)
    if (!handlers) {
      return
    }

    for (const handler of handlers) {
      try {
        handler(...args)
      } catch (error) {
        console.error(`Error in ${event} handler:`, error)
      }
    }
  }

  /**
   * Handle incoming window.postMessage events
   */
  private handleWindowMessage(event: MessageEvent): void {
    // Only process WCP1Hello messages
    if (!isWebConnectionProtocol1Hello(event.data)) {
      return
    }

    try {
      this.handleWCP1Hello(event)
    } catch (error) {
      console.error("Error handling WCP1Hello:", error)
      this.emit("handshakeFailed", error as Error, event.data.meta.connectionAttemptUuid)
    }
  }

  /**
   * Handle WCP1Hello message from an app
   *
   * Steps:
   * 1. Create MessageChannel
   * 2. Wrap port2 as MessagePortTransport
   * 3. Bridge app transport to Desktop Agent transport
   * 4. Send WCP3Handshake with port1 to app
   * 5. Store connection metadata
   */
  private handleWCP1Hello(event: MessageEvent<WCP1HelloMessage>): void {
    // Validate event source exists (required for postMessage)
    if (!event.source) {
      console.warn("WCP1Hello received from null source, ignoring")
      return
    }

    const { data: message } = event
    const { connectionAttemptUuid } = message.meta

    // Create MessageChannel for this app connection
    const channel = new MessageChannel()

    // Generate temporary instanceId until WCP4 validation completes.
    // After validation, updateConnectionMetadata() migrates to actual instanceId
    // from AppInstanceRegistry. This allows routing messages during handshake
    // before the Desktop Agent has validated the app identity.
    const instanceId = `temp-${connectionAttemptUuid}`

    // Wrap port2 as Transport for this app
    const appTransport = new MessagePortTransport(channel.port2)

    // Bridge app transport <-> Desktop Agent transport
    this.bridgeTransports(instanceId, appTransport)

    // Store connection metadata
    const metadata: AppConnectionMetadata = {
      instanceId,
      appId: "unknown", // Will be set after WCP4 validation
      connectionAttemptUuid,
      source: event.source as Window,
      port: channel.port2,
      connectedAt: new Date(),
    }
    this.connections.set(instanceId, metadata)
    this.messagePortTransports.set(instanceId, appTransport)

    // Create WCP3Handshake response
    const handshake: WCP3HandshakeMessage = {
      type: "WCP3Handshake",
      meta: {
        connectionAttemptUuid,
        timestamp: new Date(),
      },
      payload: {
        fdc3Version: this.options.fdc3Version,
        intentResolverUrl: this.options.getIntentResolverUrl(instanceId) || false,
        channelSelectorUrl: this.options.getChannelSelectorUrl(instanceId) || false,
      },
    }

    // Send WCP3Handshake to app with port1
    // event.source is validated above, safe to cast
    ;(event.source as Window).postMessage(handshake, event.origin, [channel.port1])

    // Note: appConnected event will be fired after WCP4 validation by Desktop Agent
  }

  /**
   * Bridge messages between app MessagePort and Desktop Agent transport
   *
   * This sets up bidirectional message routing:
   * - App → Desktop Agent: Add source metadata (instanceId) to identify message origin
   * - Desktop Agent → App: Route by destination metadata (instanceId) to target app
   *
   * Message format: DACP messages with meta.source/destination.instanceId for routing
   */
  private bridgeTransports(instanceId: string, appTransport: MessagePortTransport): void {
    // App → Desktop Agent: Enrich messages with source instanceId
    appTransport.onMessage((message: unknown) => {
      // Type guard: ensure message has expected structure
      if (!message || typeof message !== "object") {
        console.warn("Received invalid message from app, ignoring", message)
        return
      }

      // Add source metadata to message for Desktop Agent routing
      const enrichedMessage = {
        ...(message as Record<string, unknown>),
        meta: {
          ...((message as Record<string, unknown>).meta as Record<string, unknown> | undefined),
          source: {
            ...(((message as Record<string, unknown>).meta as Record<string, unknown> | undefined)
              ?.source as Record<string, unknown> | undefined),
            instanceId,
          },
        },
      }

      // Forward enriched message to Desktop Agent
      this.desktopAgentTransport.send(enrichedMessage)
    })

    // Handle app disconnection
    appTransport.onDisconnect(() => {
      this.disconnectApp(instanceId)
    })
  }

  /**
   * Handle messages from Desktop Agent transport
   * Route to appropriate app based on destination metadata
   *
   * Message routing logic:
   * - Messages with meta.destination.instanceId → route to specific app
   * - Messages without destination → broadcast or Desktop Agent internal (ignored here)
   * - Only routes to connected transports
   */
  private handleDesktopAgentMessage(message: unknown): void {
    // Type guard: ensure message has expected structure
    if (!message || typeof message !== "object") {
      console.warn("Received invalid message from Desktop Agent, ignoring", message)
      return
    }

    const messageObj = message as Record<string, unknown>
    const meta = messageObj.meta as Record<string, unknown> | undefined
    const destination = meta?.destination as Record<string, unknown> | undefined

    // Extract destination instanceId from message metadata
    const destinationId = destination?.instanceId as string | undefined

    if (!destinationId) {
      // Broadcast message or Desktop Agent internal message - not routed to apps
      return
    }

    // Route to specific app if transport exists and is connected
    const appTransport = this.messagePortTransports.get(destinationId)
    if (appTransport && appTransport.isConnected()) {
      appTransport.send(message)
    } else {
      console.warn(
        `Cannot route message to app ${destinationId}: transport not found or disconnected`
      )
    }
  }

  /**
   * Disconnect an app and clean up resources
   */
  private disconnectApp(instanceId: string): void {
    const appTransport = this.messagePortTransports.get(instanceId)
    if (appTransport) {
      appTransport.disconnect()
      this.messagePortTransports.delete(instanceId)
    }

    this.connections.delete(instanceId)
    this.emit("appDisconnected", instanceId)
  }

  /**
   * Update connection metadata after WCP4 validation
   * Called by integration code when Desktop Agent validates app identity
   *
   * This method migrates the connection from temporary instanceId (temp-{uuid})
   * to the actual instanceId assigned by the Desktop Agent's AppInstanceRegistry.
   * Both the connections Map and messagePortTransports Map are updated to use
   * the new key, ensuring message routing continues to work correctly.
   */
  updateConnectionMetadata(tempInstanceId: string, actualInstanceId: string, appId: string): void {
    const metadata = this.connections.get(tempInstanceId)
    if (!metadata) {
      console.warn(`Cannot update connection metadata: temp instanceId ${tempInstanceId} not found`)
      return
    }

    // Update metadata with validated info from Desktop Agent
    metadata.instanceId = actualInstanceId
    metadata.appId = appId

    // Migrate connection to actual instanceId key
    // This ensures future lookups use the validated instanceId
    this.connections.delete(tempInstanceId)
    this.connections.set(actualInstanceId, metadata)

    // Migrate transport reference to actual instanceId key
    const appTransport = this.messagePortTransports.get(tempInstanceId)
    if (appTransport) {
      this.messagePortTransports.delete(tempInstanceId)
      this.messagePortTransports.set(actualInstanceId, appTransport)
    } else {
      console.warn(
        `Transport not found for temp instanceId ${tempInstanceId} during metadata update`
      )
    }

    // Fire connected event now that validation is complete
    this.emit("appConnected", metadata)
  }

  /**
   * Get all active connections
   */
  getConnections(): AppConnectionMetadata[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get connection metadata for a specific instance
   */
  getConnection(instanceId: string): AppConnectionMetadata | undefined {
    return this.connections.get(instanceId)
  }

  /**
   * Check if connector is started
   */
  getIsStarted(): boolean {
    return this.isStarted
  }
}
