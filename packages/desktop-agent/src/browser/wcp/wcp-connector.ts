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
import { isWebConnectionProtocol1Hello } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import type {
  AppRequestMessage,
  WebConnectionProtocolMessage,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import type { MessagePortTransport } from "./message-port-transport"
import { handleWCP1Hello as handleWCP1HelloHandshake, type WCPHandshakeContext } from "./wcp1-3-handshake"
import {
  handleDesktopAgentMessage as handleDesktopAgentMessageRouting,
  type WCPRoutingContext,
} from "./wcp-message-routing"
import {
  requestIntentResolution,
  resolveIntentSelection,
  type PendingIntentResolution,
} from "./wcp-intent-resolver"
import {
  cleanupStaleDisconnects,
  disconnectApp,
  disconnectAppByInstanceId,
  getConnection,
  getConnections,
  handleWCP6Goodbye,
  updateConnectionMetadata,
  type WCPConnectionContext,
} from "./wcp-connection-management"
import { WCPEventEmitter } from "./wcp-event-emitter"
import type {
  AppConnectionMetadata,
  IntentResolverPayload,
  IntentResolverResponse,
  WCP1HelloMessage,
  WCPConnectorOptions,
} from "./wcp-types"

export type {
  AppConnectionMetadata,
  IntentHandler,
  IntentResolverPayload,
  IntentResolverResponse,
  WCPConnectorEvents,
  WCPConnectorOptions,
} from "./wcp-types"

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
export class WCPConnector extends WCPEventEmitter {
  private desktopAgentTransport: Transport
  private options: Required<WCPConnectorOptions>
  private isStarted: boolean = false
  private connections = new Map<string, AppConnectionMetadata>()
  private messagePortTransports = new Map<string, MessagePortTransport>()
  // Reverse lookup: transport → instanceId (updated after WCP5 migration)
  private transportToInstanceId = new Map<MessagePortTransport, string>()
  // Store bound handler reference for proper event listener cleanup
  private boundHandleWindowMessage = this.handleWindowMessage.bind(this)
  // Pending intent resolution requests awaiting UI response
  private pendingIntentResolutions = new Map<string, PendingIntentResolution>()
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
    super()
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
   *
   * Note: WCP4 identity validation (origin + app directory URL match)
   * happens in core handlers after the app sends WCP4ValidateAppIdentity.
   */
  private handleWCP1Hello(event: MessageEvent<WCP1HelloMessage>): void {
    handleWCP1HelloHandshake(event, this.getHandshakeContext())
  }

  /**
   * Enrich message with source instanceId for Desktop Agent routing
   * Adds the instanceId to meta.source.instanceId per FDC3 spec
   */
  private enrichMessageWithSource(
    message: AppRequestMessage | WebConnectionProtocolMessage,
    instanceId: string
  ): AppRequestMessage | WebConnectionProtocolMessage {
    const currentMeta =
      "meta" in message && message.meta && typeof message.meta === "object" ? message.meta : undefined
    const hasSourceField = !!currentMeta && "source" in currentMeta
    const isIdentityValidation = message.type === "WCP4ValidateAppIdentity"
    const storedMessageOrigin = isIdentityValidation
      ? this.connections.get(instanceId)?.messageOrigin
      : undefined

    // If we have nothing to add or normalize, return early.
    if (!hasSourceField && !storedMessageOrigin) {
      return message
    }

    const nextMeta = {
      ...(currentMeta ?? {}),
    } as typeof message.meta

    // Normalize meta.source.instanceId for DA routing while preserving appId.
    if (hasSourceField) {
      ;(nextMeta as { source?: { appId?: string; instanceId?: string } }).source = {
        appId: (currentMeta as { source?: { appId?: string } }).source?.appId,
        instanceId,
      }
    }

    // For WCP4, ensure messageOrigin is propagated from the connection record.
    const nextMetaRecord = nextMeta as unknown as Record<string, unknown>
    if (storedMessageOrigin && !nextMetaRecord.messageOrigin) {
      nextMetaRecord.messageOrigin = storedMessageOrigin
    }

    return {
      ...message,
      meta: nextMeta,
    } as unknown as AppRequestMessage | WebConnectionProtocolMessage
  }

  /**
   * Handle WCP6Goodbye message from app
   * Implements delayed disconnect with grace period for reconnection
   */
  private handleWCP6Goodbye(instanceId: string): void {
    handleWCP6Goodbye(this.getConnectionContext(), instanceId)
  }

  /**
   * Clean up stale entries from recentlyDisconnected Map
   * Called periodically to prevent memory leaks
   */
  private cleanupStaleDisconnects(): void {
    cleanupStaleDisconnects(this.getConnectionContext())
  }

  /**
   * Handle messages from Desktop Agent transport
   * Route to appropriate app based on destination metadata
   *
   * Note: message is unknown from Transport.onMessage by design - validates untrusted input
   *
   * Message routing logic:
   * - Messages with meta.destination.instanceId → route to specific app
   * - Messages without destination → broadcast or Desktop Agent internal (ignored here)
   * - Only routes to connected transports
   * - Intercepts WCP5ValidateAppIdentityResponse to migrate temp→actual instanceId
   *
   * Uses dynamic instanceId lookup via transportToInstanceId map because the instanceId
   * changes from temp-{uuid} to actual instanceId after WCP5 validation.
   */
  private handleDesktopAgentMessage(message: unknown): void {
    handleDesktopAgentMessageRouting(message, this.getRoutingContext())
  }

  /**
   * Disconnect an app by instanceId, sending WCP6Goodbye first
   * This is the public method to use when explicitly disconnecting an app
   *
   * @param instanceId - The instance ID of the app to disconnect
   */
  disconnectAppByInstanceId(instanceId: string): void {
    disconnectAppByInstanceId(this.getConnectionContext(), instanceId)
  }

  /**
   * Disconnect an app and clean up resources
   * This is the internal method that performs the actual cleanup
   */
  private disconnectApp(instanceId: string): void {
    disconnectApp(this.getConnectionContext(), instanceId)
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
    updateConnectionMetadata(this.getConnectionContext(), tempInstanceId, actualInstanceId, appId)
  }

  /**
   * Get all active connections
   */
  getConnections(): AppConnectionMetadata[] {
    return getConnections(this.getConnectionContext())
  }

  /**
   * Get connection metadata for a specific instance
   */
  getConnection(instanceId: string): AppConnectionMetadata | undefined {
    return getConnection(this.getConnectionContext(), instanceId)
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
   */
  requestIntentResolution(
    payload: IntentResolverPayload,
    timeoutMs?: number
  ): Promise<IntentResolverResponse> {
    const timeout = timeoutMs ?? this.options.intentResolutionTimeout
    return requestIntentResolution(
      this.pendingIntentResolutions,
      intentPayload => this.emit("intentResolverNeeded", intentPayload),
      payload,
      timeout
    )
  }

  /**
   * Called by UI to respond to an intent resolution request.
   *
   * @param response - User's selection (or null if cancelled)
   */
  resolveIntentSelection(response: IntentResolverResponse): void {
    resolveIntentSelection(this.pendingIntentResolutions, response)
  }

  private getRoutingContext(): WCPRoutingContext {
    return {
      desktopAgentTransport: this.desktopAgentTransport,
      messagePortTransports: this.messagePortTransports,
      transportToInstanceId: this.transportToInstanceId,
      emit: this.emit.bind(this),
      log: this.log.bind(this),
      updateConnectionMetadata: this.updateConnectionMetadata.bind(this),
      handleWCP6Goodbye: this.handleWCP6Goodbye.bind(this),
      enrichMessageWithSource: this.enrichMessageWithSource.bind(this),
      disconnectApp: this.disconnectApp.bind(this),
    }
  }

  private getConnectionContext(): WCPConnectionContext {
    return {
      options: this.options,
      connections: this.connections,
      messagePortTransports: this.messagePortTransports,
      transportToInstanceId: this.transportToInstanceId,
      pendingDisconnects: this.pendingDisconnects,
      recentlyDisconnected: this.recentlyDisconnected,
      emit: this.emit.bind(this),
      log: this.log.bind(this),
    }
  }

  private getHandshakeContext(): WCPHandshakeContext {
    return {
      ...this.getRoutingContext(),
      options: this.options,
      connections: this.connections,
      messagePortTransports: this.messagePortTransports,
      transportToInstanceId: this.transportToInstanceId,
    }
  }
}
