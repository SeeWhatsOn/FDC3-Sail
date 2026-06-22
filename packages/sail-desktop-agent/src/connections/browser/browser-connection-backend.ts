/**
 * Browser connection backend — WCP handshake, MessagePort map, direct DA ingest/deliver.
 * Owned by {@link DesktopAgent}; not a public host API.
 */

import { type Logger, consoleLogger } from "../../core/interfaces/logger"
import { isWebConnectionProtocol1Hello } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import type {
  AppRequestMessage,
  WebConnectionProtocolMessage,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import {
  handleWCP1Hello as handleWCP1HelloHandshake,
  type WCPHandshakeContext,
} from "../../app-connection/wcp/wcp1-3-handshake"
import type { WCPRoutingContext } from "../../app-connection/wcp/wcp-message-routing"
import {
  requestIntentResolution,
  resolveIntentSelection,
  type PendingIntentResolution,
} from "../../app-connection/wcp/wcp-intent-resolver"
import {
  cleanupStaleDisconnects,
  disconnectApp,
  disconnectAppByInstanceId,
  getConnection,
  getConnections,
  handleWCP6Goodbye,
  updateConnectionMetadata,
  type WCPConnectionContext,
} from "../../app-connection/wcp/wcp-connection-management"
import { WCPEventEmitter } from "../../app-connection/wcp/wcp-event-emitter"
import {
  clearPendingWcpSourceWindow,
  setPendingWcpSourceWindow,
} from "../../core/handlers/dacp/wcp-pending-source-window"
import { resolveInstanceId } from "../../core/state/selectors/wcp-handshake-routing"
import type { AgentState, StateSetter } from "../../core/state/types"
import type { HostIntentResolverPayload, HostIntentResolverResponse } from "../../host-contracts"
import type {
  AppConnectionMetadata,
  WCP1HelloMessage,
  WCPConnectorOptions,
} from "../../app-connection/wcp/wcp-types"
import type { InboundAppMessageHandler } from "../types"
import { AppConnectionManager } from "../app-connection-manager"

export type {
  AppConnectionMetadata,
  WCPConnectorOptions,
  WCPConnectorOptions as BrowserConnectionOptions,
} from "../../app-connection/wcp/wcp-types"
export type { WCPConnectorEvents } from "../../app-connection/wcp-connector-events"

export class BrowserConnectionBackend extends WCPEventEmitter {
  readonly connectionManager: AppConnectionManager

  private options: Required<WCPConnectorOptions>
  private isStarted = false
  private inboundHandler?: InboundAppMessageHandler
  private boundHandleWindowMessage = this.handleWindowMessage.bind(this)
  private pendingIntentResolutions = new Map<string, PendingIntentResolution>()
  private pendingDisconnects = new Map<string, ReturnType<typeof setTimeout>>()
  private recentlyDisconnected = new Map<
    string,
    { metadata: AppConnectionMetadata; disconnectedAt: number }
  >()
  private cleanupInterval?: ReturnType<typeof setInterval>
  private getAgentState?: () => AgentState
  private setAgentState?: StateSetter

  constructor(options?: WCPConnectorOptions) {
    super()
    const logger: Logger = options?.logger ?? consoleLogger
    const intentResolverUrl = options?.intentResolverUrl ?? false
    const channelSelectorUrl = options?.channelSelectorUrl ?? false
    this.options = {
      intentResolverUrl,
      channelSelectorUrl,
      getIntentResolverUrl:
        options?.getIntentResolverUrl ??
        (options?.intentResolverUrl !== undefined ? () => intentResolverUrl : () => false),
      getChannelSelectorUrl:
        options?.getChannelSelectorUrl ??
        (options?.channelSelectorUrl !== undefined ? () => channelSelectorUrl : () => false),
      fdc3Version: options?.fdc3Version ?? "2.2",
      handshakeTimeout: options?.handshakeTimeout ?? 5000,
      disconnectGracePeriod: options?.disconnectGracePeriod ?? 2000,
      intentResolutionTimeout: options?.intentResolutionTimeout ?? 60000,
      debug: options?.debug ?? false,
      logger,
    }

    this.connectionManager = new AppConnectionManager({
      emit: this.emit.bind(this),
      logger: this.options.logger,
      updateConnectionMetadata: (temp, actual, appId) =>
        this.updateConnectionMetadata(temp, actual, appId),
      disconnectApp: instanceId => this.disconnectApp(instanceId),
    })
  }

  bindAgentState(access: { getAgentState: () => AgentState; setAgentState: StateSetter }): void {
    this.getAgentState = access.getAgentState
    this.setAgentState = access.setAgentState
  }

  setInboundHandler(handler: InboundAppMessageHandler): void {
    this.inboundHandler = handler
  }

  deliverToApp(_instanceId: string, message: unknown): void {
    this.connectionManager.deliverToApp(message)
  }

  start(): void {
    if (this.isStarted) {
      throw new Error("BrowserConnectionBackend is already started")
    }
    if (typeof window === "undefined") {
      throw new Error("BrowserConnectionBackend requires a browser environment")
    }

    window.addEventListener("message", this.boundHandleWindowMessage)
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleDisconnects()
    }, 30000)
    this.isStarted = true
  }

  stop(): void {
    if (!this.isStarted) {
      return
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("message", this.boundHandleWindowMessage)
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    for (const [instanceId] of this.connectionManager.connections) {
      this.disconnectApp(instanceId)
    }

    this.isStarted = false
  }

  private handleWindowMessage(event: MessageEvent): void {
    if (!isWebConnectionProtocol1Hello(event.data)) {
      return
    }

    try {
      handleWCP1HelloHandshake(event as MessageEvent<WCP1HelloMessage>, this.getHandshakeContext())
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.options.logger.error("Error handling WCP1Hello:", error)
      this.emit("handshakeFailed", error, event.data.meta.connectionAttemptUuid)
    }
  }

  private enrichMessageWithSource(
    message: AppRequestMessage | WebConnectionProtocolMessage,
    instanceId: string
  ): AppRequestMessage | WebConnectionProtocolMessage {
    const currentMeta =
      "meta" in message && message.meta && typeof message.meta === "object"
        ? message.meta
        : undefined
    const hasSourceField = !!currentMeta && "source" in currentMeta
    const isIdentityValidation = message.type === "WCP4ValidateAppIdentity"
    const storedConnection = isIdentityValidation
      ? this.connectionManager.connections.get(instanceId)
      : undefined
    const storedMessageOrigin = storedConnection?.messageOrigin
    const storedSourceWindow = storedConnection?.source

    const nextMeta = { ...currentMeta } as typeof message.meta

    ;(nextMeta as { source?: { appId?: string; instanceId?: string } }).source = {
      appId: hasSourceField
        ? (currentMeta as { source?: { appId?: string } }).source?.appId
        : undefined,
      instanceId,
    }

    const nextMetaRecord = nextMeta as unknown as Record<string, unknown>
    if (storedMessageOrigin) {
      nextMetaRecord.messageOrigin = storedMessageOrigin
    }
    if (isIdentityValidation && storedSourceWindow) {
      setPendingWcpSourceWindow(this, instanceId, storedSourceWindow)
    }

    return {
      ...message,
      meta: nextMeta,
    } as unknown as AppRequestMessage | WebConnectionProtocolMessage
  }

  private handleWCP6Goodbye(instanceId: string): void {
    handleWCP6Goodbye(this.getConnectionContext(), instanceId)
  }

  private cleanupStaleDisconnects(): void {
    cleanupStaleDisconnects(this.getConnectionContext())
  }

  disconnectAppByInstanceId(instanceId: string): void {
    disconnectAppByInstanceId(this.getConnectionContext(), instanceId)
  }

  private disconnectApp(instanceId: string): void {
    const state = this.getAgentState?.()
    const resolvedInstanceId = state ? resolveInstanceId(state, instanceId) : instanceId
    clearPendingWcpSourceWindow(this, instanceId)
    if (resolvedInstanceId !== instanceId) {
      clearPendingWcpSourceWindow(this, resolvedInstanceId)
    }
    disconnectApp(this.getConnectionContext(), resolvedInstanceId)
  }

  updateConnectionMetadata(tempInstanceId: string, actualInstanceId: string, appId: string): void {
    updateConnectionMetadata(this.getConnectionContext(), tempInstanceId, actualInstanceId, appId)
  }

  getConnections(): AppConnectionMetadata[] {
    return getConnections(this.getConnectionContext())
  }

  getConnection(instanceId: string): AppConnectionMetadata | undefined {
    return getConnection(this.getConnectionContext(), instanceId)
  }

  pruneAppConnection(instanceId: string): void {
    const state = this.getAgentState?.()
    const resolvedInstanceId = state ? resolveInstanceId(state, instanceId) : instanceId
    clearPendingWcpSourceWindow(this, instanceId)
    if (resolvedInstanceId !== instanceId) {
      clearPendingWcpSourceWindow(this, resolvedInstanceId)
    }
    disconnectApp(this.getConnectionContext(), resolvedInstanceId)
  }

  getIsStarted(): boolean {
    return this.isStarted
  }

  requestIntentResolution(
    payload: HostIntentResolverPayload,
    timeoutMs?: number
  ): Promise<HostIntentResolverResponse> {
    const timeout = timeoutMs ?? this.options.intentResolutionTimeout
    return requestIntentResolution(
      this.pendingIntentResolutions,
      intentPayload => this.emit("intentResolverNeeded", intentPayload),
      payload,
      timeout
    )
  }

  resolveIntentSelection(response: HostIntentResolverResponse): void {
    resolveIntentSelection(this.pendingIntentResolutions, response)
  }

  private ingestFromApp(message: unknown): void {
    if (!this.inboundHandler) {
      this.options.logger.warn(
        "BrowserConnectionBackend received app message before inbound handler was set"
      )
      return
    }
    return void this.inboundHandler(message)
  }

  private getRoutingContext(): WCPRoutingContext {
    return {
      connectionManager: this.connectionManager,
      ingestFromApp: message => this.ingestFromApp(message),
      emit: this.emit.bind(this) as WCPRoutingContext["emit"],
      logger: this.options.logger,
      enrichMessageWithSource: this.enrichMessageWithSource.bind(this),
      handleWCP6Goodbye: this.handleWCP6Goodbye.bind(this),
      disconnectApp: this.disconnectApp.bind(this),
    }
  }

  private getConnectionContext(): WCPConnectionContext {
    return {
      connectionManager: this.connectionManager,
      options: this.options,
      pendingDisconnects: this.pendingDisconnects,
      recentlyDisconnected: this.recentlyDisconnected,
      emit: this.emit.bind(this),
      logger: this.options.logger,
      getAgentState: this.getAgentState,
      setAgentState: this.setAgentState,
    }
  }

  private getHandshakeContext(): WCPHandshakeContext {
    return {
      ...this.getRoutingContext(),
      options: this.options,
    }
  }
}
