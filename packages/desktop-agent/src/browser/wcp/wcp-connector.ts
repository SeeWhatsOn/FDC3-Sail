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

import type { Transport } from "../../core/interfaces/transport"
import type { BrowserTypes } from "@finos/fdc3"
import { isWebConnectionProtocol1Hello } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { MessagePortTransport } from "./message-port-transport"
import type {
  AppRequestMessage,
  AgentResponseMessage,
  AgentEventMessage,
  WebConnectionProtocolMessage,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"

type WCP1HelloMessage = BrowserTypes.WebConnectionProtocol1Hello
type WCP3HandshakeMessage = BrowserTypes.WebConnectionProtocol3Handshake

/**
 * Union type for all DACP and WCP messages
 * Uses official FDC3 schema types for full type safety
 */
type DACPMessage =
  | AppRequestMessage
  | AgentResponseMessage
  | AgentEventMessage
  | WebConnectionProtocolMessage

/**
 * Type guard to check if a message has the basic structure of a DACP message
 *
 * Note: Type guard parameters MUST be 'unknown' per TypeScript type narrowing requirements.
 * This is the correct pattern for validating untrusted external input.
 */
function isDACPMessage(message: unknown): message is DACPMessage {
  return (
    message !== null &&
    typeof message === "object" &&
    "type" in message &&
    typeof message.type === "string" &&
    "meta" in message &&
    message.meta !== null &&
    typeof message.meta === "object"
  )
}

/**
 * Type guard to check if a message is from an app (request or WCP message)
 *
 * Note: Type guard parameters MUST be 'unknown' per TypeScript type narrowing requirements.
 */
function isAppMessage(
  message: unknown
): message is AppRequestMessage | WebConnectionProtocolMessage {
  return (
    isDACPMessage(message) && (message.type.endsWith("Request") || message.type.startsWith("WCP"))
  )
}

/**
 * Type guard to check if a message is from Desktop Agent (response or event)
 *
 * Note: Type guard parameters MUST be 'unknown' per TypeScript type narrowing requirements.
 */
function isAgentMessage(
  message: unknown
): message is AgentResponseMessage | AgentEventMessage | WebConnectionProtocolMessage {
  return (
    isDACPMessage(message) &&
    (message.type.endsWith("Response") ||
      message.type.endsWith("Event") ||
      message.type.startsWith("WCP"))
  )
}

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

  /**
   * Grace period for app disconnection after WCP6Goodbye (ms).
   * Allows reconnection during false-positive pagehide events (e.g., tab moves).
   * Defaults to 2000ms.
   */
  disconnectGracePeriod?: number

  /**
   * Timeout for intent resolution UI response (ms).
   * Defaults to 60000ms (60 seconds).
   */
  intentResolutionTimeout?: number

  /**
   * Enable debug logging.
   * Defaults to false.
   */
  debug?: boolean
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

  /**
   * Optional identifier from the iframe's name attribute.
   * Can be used by hosting applications to correlate connections with UI elements.
   */
  hostIdentifier?: string
}

/**
 * Handler option for intent resolution
 */
export interface IntentHandler {
  /** Instance ID if this is a running listener */
  instanceId?: string
  /** App ID from directory */
  appId: string
  /** Display name for the app */
  appName?: string
  /** Icon URL for the app */
  appIcon?: string
  /** Whether this is a running instance (has active listener) */
  isRunning: boolean
}

/**
 * Payload for intent resolution request to UI
 */
export interface IntentResolverPayload {
  /** Unique request ID for correlation */
  requestId: string
  /** Intent name being raised */
  intent: string
  /** Context being passed with intent */
  context: unknown
  /** Available handlers to choose from */
  handlers: IntentHandler[]
}

/**
 * Response from UI with user's handler selection
 */
export interface IntentResolverResponse {
  /** Request ID this is responding to */
  requestId: string
  /** Selected handler, or null if cancelled */
  selectedHandler: { instanceId?: string; appId: string } | null
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

  /**
   * Fired when an app's channel membership changes
   * channelId is null when app leaves all channels
   */
  channelChanged: (instanceId: string, channelId: string | null) => void

  /**
   * Fired when intent resolution UI is needed
   * UI should display handler options and call resolveIntentSelection()
   */
  intentResolverNeeded: (payload: IntentResolverPayload) => void
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
  // Reverse lookup: transport → instanceId (updated after WCP5 migration)
  private transportToInstanceId = new Map<MessagePortTransport, string>()
  private eventHandlers: { [K in keyof WCPConnectorEvents]?: Set<WCPConnectorEvents[K]> } = {}
  // Store bound handler reference for proper event listener cleanup
  private boundHandleWindowMessage = this.handleWindowMessage.bind(this)
  // Pending intent resolution requests awaiting UI response
  private pendingIntentResolutions = new Map<
    string,
    {
      resolve: (response: IntentResolverResponse) => void
      reject: (error: Error) => void
      timeoutId: ReturnType<typeof setTimeout>
    }
  >()
  // Track pending disconnects that may be cancelled if reconnection happens
  private pendingDisconnects = new Map<string, ReturnType<typeof setTimeout>>()
  // Track recently disconnected instances that can be restored on reconnection
  // This handles cases where pagehide events trigger premature disconnects (e.g., tab moves)
  // TODO: Consider using heartbeat-based detection instead of WCP6Goodbye for disconnection.
  //       Heartbeat already runs (30s interval, 60s timeout) and can detect actual disconnections.
  //       This would eliminate false-positive disconnects from pagehide events, but would delay
  //       cleanup of actual disconnections by up to 60 seconds. See WCP6Goodbye handler for details.
  private recentlyDisconnected = new Map<
    string,
    { metadata: AppConnectionMetadata; disconnectedAt: number }
  >()
  // Cleanup interval for stale disconnected entries
  private cleanupInterval?: ReturnType<typeof setInterval>

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
      disconnectGracePeriod: options?.disconnectGracePeriod ?? 2000,
      intentResolutionTimeout: options?.intentResolutionTimeout ?? 60000,
      debug: options?.debug ?? false,
    }

    // Listen to Desktop Agent transport for messages to route to apps
    this.desktopAgentTransport.onMessage(this.handleDesktopAgentMessage.bind(this))
  }

  /**
   * Internal debug logging method
   */
  private log(
    message: string,
    data?: Record<string, string | number | boolean | null | undefined>
  ): void {
    if (this.options.debug) {
      console.log(`[WCPConnector] ${message}`, data)
    }
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

    // Start periodic cleanup of stale disconnected entries (every 30 seconds)
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleDisconnects()
    }, 30000)

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

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
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
    if (!this.eventHandlers[event]) {
      // Type assertion needed: TypeScript can't infer the relationship between
      // generic EventName and the mapped type in eventHandlers
      ;(this.eventHandlers as Record<EventName, Set<WCPConnectorEvents[EventName]>>)[event] =
        new Set()
    }
    this.eventHandlers[event]!.add(handler)
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
    this.eventHandlers[event]?.delete(handler)
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit<EventName extends keyof WCPConnectorEvents>(
    event: EventName,
    ...args: Parameters<WCPConnectorEvents[EventName]>
  ): void {
    const handlers = this.eventHandlers[event]
    if (!handlers) {
      return
    }

    for (const handler of handlers) {
      try {
        ;(handler as (...args: Parameters<WCPConnectorEvents[EventName]>) => void)(...args)
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
      this.handleWCP1Hello(event as MessageEvent<WCP1HelloMessage>)
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

    // Extract host identifier from iframe's name attribute
    // This enables hosting applications to correlate connections with UI elements
    // Note: For cross-origin iframes, accessing window.name will throw SecurityError
    // so we wrap it in try-catch and gracefully fall back to undefined
    const sourceWindow = event.source as Window
    let hostIdentifier: string | undefined
    try {
      hostIdentifier = sourceWindow.name || undefined
    } catch (error) {
      // Cross-origin iframe - cannot access window.name due to same-origin policy
      // This is expected for apps hosted on different origins
      // Connection will still work, just without host identifier
      if (error instanceof Error && error.name === "SecurityError") {
        this.log(
          `Cannot access window.name for cross-origin iframe from ${event.origin}, hostIdentifier will be undefined`
        )
      } else {
        // Re-throw unexpected errors
        throw error
      }
    }

    // Store connection metadata
    const metadata: AppConnectionMetadata = {
      instanceId,
      appId: "unknown", // Will be set after WCP4 validation
      connectionAttemptUuid,
      source: sourceWindow,
      port: channel.port2,
      connectedAt: new Date(),
      hostIdentifier,
    }
    this.connections.set(instanceId, metadata)
    this.messagePortTransports.set(instanceId, appTransport)
    this.transportToInstanceId.set(appTransport, instanceId)

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

    // Set timeout to clean up stale connections that don't complete WCP4 validation
    // If appId is still "unknown" after timeout, the handshake failed
    setTimeout(() => {
      const connection = this.connections.get(instanceId)
      if (connection && connection.appId === "unknown") {
        console.warn(
          `[WCPConnector] Connection ${instanceId} timed out waiting for WCP4 validation, cleaning up`
        )
        this.disconnectApp(instanceId)
        this.emit("handshakeFailed", new Error("WCP4 validation timeout"), connectionAttemptUuid)
      }
    }, this.options.handshakeTimeout)

    // Note: appConnected event will be fired after WCP4 validation by Desktop Agent
  }

  /**
   * Enrich message with source instanceId for Desktop Agent routing
   * Adds the instanceId to meta.source.instanceId per FDC3 spec
   */
  private enrichMessageWithSource(
    message: AppRequestMessage | WebConnectionProtocolMessage,
    instanceId: string
  ): AppRequestMessage | WebConnectionProtocolMessage {
    if ("meta" in message && message.meta && "source" in message.meta) {
      return {
        ...message,
        meta: {
          ...message.meta,
          source: {
            appId: (message.meta as { source?: { appId: string } }).source?.appId,
            instanceId,
          },
        },
      } as AppRequestMessage | WebConnectionProtocolMessage
    }
    return message
  }

  /**
   * Handle WCP6Goodbye message from app
   * Implements delayed disconnect with grace period for reconnection
   */
  private handleWCP6Goodbye(instanceId: string): void {
    this.log(`Received WCP6Goodbye from app instance ${instanceId}`)

    // NOTE: WCP6Goodbye is sent by FDC3 get-agent library on pagehide events with persisted=false.
    // This includes false positives like tab moves, navigation, etc. where the app is still active.
    //
    // Current approach: Delay disconnect to allow reconnection within grace period.
    // This handles false-positive pagehide events from tab moves/navigation.
    //
    // Alternative approach (TODO): Consider using heartbeat-based detection instead.
    // Heartbeat already runs (30s interval, 60s timeout) and can detect actual disconnections.
    // Trade-offs:
    //   - Heartbeat: More accurate (only disconnects on actual failure), but slower (up to 60s delay)
    //   - Delayed WCP6Goodbye: Faster response (configurable), but requires grace period for false positives
    //   - Hybrid: Could ignore WCP6Goodbye and rely solely on heartbeat timeout for cleanup

    // Cancel any existing pending disconnect
    const existingTimeout = this.pendingDisconnects.get(instanceId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const connection = this.connections.get(instanceId)
    const timeoutId = setTimeout(() => {
      this.pendingDisconnects.delete(instanceId)

      // Store in recently disconnected for potential restoration
      if (connection) {
        this.recentlyDisconnected.set(instanceId, {
          metadata: connection,
          disconnectedAt: Date.now(),
        })
      }

      // App is gracefully disconnecting - clean up
      this.disconnectApp(instanceId)
    }, this.options.disconnectGracePeriod)

    this.pendingDisconnects.set(instanceId, timeoutId)
  }

  /**
   * Clean up stale entries from recentlyDisconnected Map
   * Called periodically to prevent memory leaks
   */
  private cleanupStaleDisconnects(): void {
    const fiveSecondsAgo = Date.now() - 5000
    for (const [id, entry] of this.recentlyDisconnected.entries()) {
      if (entry.disconnectedAt < fiveSecondsAgo) {
        this.recentlyDisconnected.delete(id)
      }
    }
  }

  /**
   * Bridge messages between app MessagePort and Desktop Agent transport
   *
   * This sets up bidirectional message routing:
   * - App → Desktop Agent: Add source metadata (instanceId) to identify message origin
   * - Desktop Agent → App: Route by destination metadata (instanceId) to target app
   *
   * Message format: DACP messages with meta.source/destination.instanceId for routing
   *
   * Note: Uses dynamic instanceId lookup via transportToInstanceId map because
   * the instanceId changes from temp-{uuid} to actual instanceId after WCP5 validation.
   */
  private bridgeTransports(_initialInstanceId: string, appTransport: MessagePortTransport): void {
    // App → Desktop Agent: Enrich messages with source instanceId
    // Note: message is unknown from Transport.onMessage by design - validates untrusted input
    appTransport.onMessage((message: unknown) => {
      // Type guard: validate message structure using type guard
      if (!isAppMessage(message)) {
        console.warn("Received invalid message from app, ignoring", message)
        return
      }

      // Look up current instanceId dynamically (may have changed after WCP5 migration)
      const currentInstanceId = this.transportToInstanceId.get(appTransport)
      if (!currentInstanceId) {
        console.warn("Cannot route message: transport not found in reverse lookup")
        return
      }

      // Handle WCP6Goodbye from app (FDC3 standard: app sends goodbye when closing)
      if (message.type === "WCP6Goodbye") {
        this.handleWCP6Goodbye(currentInstanceId)
        return
      }

      // Add source metadata to message for Desktop Agent routing
      const enrichedMessage = this.enrichMessageWithSource(message, currentInstanceId)

      // Forward enriched message to Desktop Agent
      this.desktopAgentTransport.send(enrichedMessage)
    })

    // Handle app disconnection
    appTransport.onDisconnect(() => {
      // Look up current instanceId dynamically for cleanup
      const currentInstanceId = this.transportToInstanceId.get(appTransport)
      if (currentInstanceId) {
        this.disconnectApp(currentInstanceId)
      }
      // Clean up reverse lookup
      this.transportToInstanceId.delete(appTransport)
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
   * - Intercepts WCP5ValidateAppIdentityResponse to migrate temp→actual instanceId
   */
  /**
   * Handle messages from Desktop Agent transport
   * Route to appropriate app based on destination metadata
   *
   * Note: message is unknown from Transport.onMessage by design - validates untrusted input
   */
  private handleDesktopAgentMessage(message: unknown): void {
    // Type guard: validate message structure using type guard
    if (!isAgentMessage(message)) {
      console.warn("Received invalid message from Desktop Agent, ignoring", message)
      return
    }

    // Extract destination instanceId from message metadata
    let destinationId: string | undefined
    if (
      "destination" in message.meta &&
      message.meta.destination &&
      typeof message.meta.destination === "object" &&
      "instanceId" in message.meta.destination
    ) {
      destinationId = message.meta.destination.instanceId as string | undefined
    }

    this.log("Received message from Desktop Agent", {
      messageType: message.type,
      destinationId: destinationId ?? "",
      hasDestination: !!destinationId,
    })

    if (!destinationId) {
      // Broadcast message or Desktop Agent internal message - not routed to apps
      this.log("No destinationId, skipping routing", { messageType: message.type })
      return
    }

    // Intercept WCP5ValidateAppIdentityResponse to migrate temp→actual instanceId
    // This happens after Desktop Agent validates app identity via WCP4
    if (message.type === "WCP5ValidateAppIdentityResponse") {
      let actualInstanceId: string | undefined
      let appId: string | undefined

      if ("payload" in message && message.payload && typeof message.payload === "object") {
        if ("instanceId" in message.payload && typeof message.payload.instanceId === "string") {
          actualInstanceId = message.payload.instanceId
        }
        if ("appId" in message.payload && typeof message.payload.appId === "string") {
          appId = message.payload.appId
        }
      }

      if (actualInstanceId && appId && destinationId !== actualInstanceId) {
        // Migrate from temp instanceId to actual instanceId
        // destinationId is the temp instanceId (temp-{uuid})
        // actualInstanceId is the real instanceId from Desktop Agent
        this.updateConnectionMetadata(destinationId, actualInstanceId, appId)

        // Now route to the actual instanceId (maps have been updated)
        const appTransport = this.messagePortTransports.get(actualInstanceId)
        if (appTransport && appTransport.isConnected()) {
          appTransport.send(message)
        } else {
          console.warn(`Cannot route WCP5 response to app ${actualInstanceId}: transport not found`)
        }
        return
      }
    }

    // Intercept channelChangedEvent to emit UI event
    // This allows the UI to update channel indicators
    if (message.type === "channelChangedEvent") {
      let channelId: string | null | undefined
      let changedInstanceId: string | undefined

      if ("payload" in message && message.payload && typeof message.payload === "object") {
        if ("channelId" in message.payload) {
          const ch = message.payload.channelId
          channelId = ch === null || typeof ch === "string" ? ch : undefined
        }
        if (
          "identity" in message.payload &&
          message.payload.identity &&
          typeof message.payload.identity === "object"
        ) {
          if (
            "instanceId" in message.payload.identity &&
            typeof message.payload.identity.instanceId === "string"
          ) {
            changedInstanceId = message.payload.identity.instanceId
          }
        }
      }

      if (changedInstanceId) {
        // Only emit if we have a valid instanceId
        this.emit("channelChanged", changedInstanceId, channelId ?? null)
      }
    }

    // Route to specific app if transport exists and is connected
    const appTransport = this.messagePortTransports.get(destinationId)
    if (appTransport && appTransport.isConnected()) {
      // Extract metadata fields for logging
      const logMetadata: Record<string, string | number | boolean | null | undefined> = {
        destinationId,
        messageType: message.type,
      }

      if ("meta" in message && message.meta && typeof message.meta === "object") {
        if ("eventUuid" in message.meta && typeof message.meta.eventUuid === "string") {
          logMetadata.eventUuid = message.meta.eventUuid
        }
        if ("requestUuid" in message.meta && typeof message.meta.requestUuid === "string") {
          logMetadata.requestUuid = message.meta.requestUuid
        }
        if ("responseUuid" in message.meta && typeof message.meta.responseUuid === "string") {
          logMetadata.responseUuid = message.meta.responseUuid
        }
      }

      // Add intent-specific logging
      if (
        message.type === "intentEvent" &&
        "payload" in message &&
        message.payload &&
        typeof message.payload === "object"
      ) {
        if ("intent" in message.payload && typeof message.payload.intent === "string") {
          logMetadata.intent = message.payload.intent
        }
        if (
          "context" in message.payload &&
          message.payload.context &&
          typeof message.payload.context === "object"
        ) {
          if (
            "type" in message.payload.context &&
            typeof message.payload.context.type === "string"
          ) {
            logMetadata.contextType = message.payload.context.type
          }
          if ("name" in message.payload.context) {
            logMetadata.contextHasName = typeof message.payload.context.name === "string"
          }
        }
      }

      // Add broadcast-specific logging
      if (
        message.type === "broadcastEvent" &&
        "payload" in message &&
        message.payload &&
        typeof message.payload === "object"
      ) {
        if ("channelId" in message.payload && typeof message.payload.channelId === "string") {
          logMetadata.channelId = message.payload.channelId
        }
        if (
          "context" in message.payload &&
          message.payload.context &&
          typeof message.payload.context === "object"
        ) {
          if (
            "type" in message.payload.context &&
            typeof message.payload.context.type === "string"
          ) {
            logMetadata.contextType = message.payload.context.type
          }
        }
      }

      this.log("Routing message to app", logMetadata)

      try {
        appTransport.send(message)
        this.log("Message sent successfully to app transport", {
          destinationId,
          messageType: message.type,
        })
      } catch (error) {
        console.error("[WCPConnector] Error sending message to app transport", {
          destinationId,
          messageType: message.type,
          error,
        })
      }
    } else {
      console.warn(
        `[WCPConnector] Cannot route message to app ${destinationId}: transport not found or disconnected`,
        {
          messageType: message.type,
          hasTransport: !!appTransport,
          isConnected: appTransport?.isConnected(),
        }
      )
    }
  }

  /**
   * Disconnect an app by instanceId, sending WCP6Goodbye first
   * This is the public method to use when explicitly disconnecting an app
   *
   * @param instanceId - The instance ID of the app to disconnect
   */
  disconnectAppByInstanceId(instanceId: string): void {
    const appTransport = this.messagePortTransports.get(instanceId)
    if (appTransport && appTransport.isConnected()) {
      // Send WCP6Goodbye message to the app before disconnecting
      try {
        const goodbyeMessage: WebConnectionProtocolMessage = {
          type: "WCP6Goodbye",
          payload: undefined,
          meta: {
            timestamp: new Date(),
          },
        }
        appTransport.send(goodbyeMessage)
        this.log(`Sent WCP6Goodbye to instance ${instanceId}`)
      } catch (error) {
        console.warn(`[WCPConnector] Failed to send WCP6Goodbye to instance ${instanceId}:`, error)
        // Continue with disconnection even if goodbye fails
      }
    }

    // Disconnect the app (this will clean up resources and emit appDisconnected event)
    this.disconnectApp(instanceId)
  }

  /**
   * Disconnect an app and clean up resources
   * This is the internal method that performs the actual cleanup
   */
  private disconnectApp(instanceId: string): void {
    const appTransport = this.messagePortTransports.get(instanceId)
    if (appTransport) {
      appTransport.disconnect()
      this.messagePortTransports.delete(instanceId)
      // Clean up reverse lookup
      this.transportToInstanceId.delete(appTransport)
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

    // Cancel any pending disconnect for the actual instanceId (reconnection scenario)
    const pendingDisconnect = this.pendingDisconnects.get(actualInstanceId)
    if (pendingDisconnect) {
      clearTimeout(pendingDisconnect)
      this.pendingDisconnects.delete(actualInstanceId)
      this.log(
        `Cancelled pending disconnect for instance ${actualInstanceId} - reconnection detected`
      )
    }

    // Check if this is a reconnection to a recently disconnected instance
    const recentlyDisconnectedEntry = this.recentlyDisconnected.get(actualInstanceId)
    if (recentlyDisconnectedEntry) {
      this.log(
        `Restoring recently disconnected instance ${actualInstanceId} - reconnection within grace period`
      )
      // Restore the original metadata
      Object.assign(metadata, recentlyDisconnectedEntry.metadata)
      this.recentlyDisconnected.delete(actualInstanceId)
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
      // Update reverse lookup so bridgeTransports uses the actual instanceId
      this.transportToInstanceId.set(appTransport, actualInstanceId)
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

  /**
   * Request intent resolution from UI when multiple handlers are available.
   *
   * This method emits an 'intentResolverNeeded' event for the UI to display
   * a selection dialog, then waits for the UI to call resolveIntentSelection()
   * with the user's choice.
   *
   * @param payload - Intent resolution request with available handlers
   * @param timeoutMs - Timeout in milliseconds (defaults to configured intentResolutionTimeout)
   * @returns Promise that resolves with the user's selection or rejects on timeout/cancel
   *
   * @example
   * ```typescript
   * const response = await connector.requestIntentResolution({
   *   requestId: 'abc-123',
   *   intent: 'ViewContact',
   *   context: { type: 'fdc3.contact', name: 'John' },
   *   handlers: [
   *     { appId: 'crm-app', appName: 'CRM', isRunning: true, instanceId: 'inst-1' },
   *     { appId: 'outlook', appName: 'Outlook', isRunning: false }
   *   ]
   * })
   *
   * if (response.selectedHandler) {
   *   // Route intent to selected handler
   * } else {
   *   // User cancelled
   * }
   * ```
   */
  requestIntentResolution(
    payload: IntentResolverPayload,
    timeoutMs?: number
  ): Promise<IntentResolverResponse> {
    const timeout = timeoutMs ?? this.options.intentResolutionTimeout

    return new Promise((resolve, reject) => {
      // Set up timeout to reject if UI doesn't respond
      const timeoutId = setTimeout(() => {
        this.pendingIntentResolutions.delete(payload.requestId)
        reject(new Error(`Intent resolution timed out after ${timeout}ms`))
      }, timeout)

      // Store pending resolution
      this.pendingIntentResolutions.set(payload.requestId, {
        resolve,
        reject,
        timeoutId,
      })

      // Emit event to UI
      this.emit("intentResolverNeeded", payload)
    })
  }

  /**
   * Called by UI to respond to an intent resolution request.
   *
   * @param response - User's selection (or null if cancelled)
   *
   * @example
   * ```typescript
   * // User selected an app
   * connector.resolveIntentSelection({
   *   requestId: 'abc-123',
   *   selectedHandler: { appId: 'crm-app', instanceId: 'inst-1' }
   * })
   *
   * // User cancelled
   * connector.resolveIntentSelection({
   *   requestId: 'abc-123',
   *   selectedHandler: null
   * })
   * ```
   */
  resolveIntentSelection(response: IntentResolverResponse): void {
    const pending = this.pendingIntentResolutions.get(response.requestId)
    if (!pending) {
      console.warn(`No pending intent resolution found for requestId: ${response.requestId}`)
      return
    }

    // Clear timeout and remove from pending
    clearTimeout(pending.timeoutId)
    this.pendingIntentResolutions.delete(response.requestId)

    // Resolve the promise with the user's selection
    pending.resolve(response)
  }
}
