/**
 * FDC3 Desktop Agent
 *
 * Pure FDC3 runtime: agent state, host APIs, and DACP routing when an app connection
 * edge is attached. Browser hosts use {@link SailDesktopAgent}; DACP oracle
 * tests attach {@link DacpTestAppConnection} from test support.
 */

import type { AppLauncher } from "../host-contracts/app-launcher"
import { routeDACPMessage } from "../handlers"
import { cleanupDACPHandlers } from "../handlers/cleanup"
import { handleWcp4ValidateAppIdentity } from "../app-connection/wcp/wcp-identity-validation"
import { createDacpResponseDispatcherFromDelivery } from "../handlers/utils/dacp-response-utils"
import type {
  DACPHandlerContext,
  MessageValidator,
  PendingIntentPromiseEntry,
} from "../handlers/types"
import type { IntentResolutionCallback } from "../handlers/intent-resolution-callback"
import type { DirectoryApp } from "../app-directory/types"
import {
  addApp as addDirectoryApp,
  addApplications,
  loadDirectoryIntoState,
  removeApplicationsByAppId,
} from "../state/mutators/app-directory"
import { retrieveAllApps, retrieveAppsById } from "../app-directory/app-directory-queries"
import type { BrowserTypes, Context } from "@finos/fdc3"
import type { AgentState, AppInstance, StateSetter } from "../state/types"
import { AppInstanceState } from "../state/types"
import { createInitialState, createStateWithOverrides } from "../state/initial-state"
import { consoleLogger, type Logger, type LogPayloadDetail } from "../interfaces/logger"
import { resolveDesktopAgentConfig, type SailImplementationMetadata } from "./default-config"
import {
  handleJoinUserChannelRequest,
  handleLeaveCurrentChannelRequest,
} from "../handlers/channels/handlers"
import { NoChannelFoundError } from "../errors/fdc3-errors"
import {
  getAllInstances,
  getAllUserChannels,
  getInstance,
  getUserChannel,
} from "../state/selectors"
import { connectInstance } from "../state/mutators"
import type { AgentAppConnection } from "../app-connection/types"
import type { AppConnectionMetadata } from "../app-connection/browser-app-connection"

/**
 * Structure of DACP message metadata for routing
 */
interface DACPMessageMeta {
  source?: {
    instanceId?: string
  }
  destination?: {
    instanceId?: string
  }
}

/**
 * Options for creating a Desktop Agent. Omitted fields use FDC3-Sail product
 * defaults from `default-config.ts` (merged in the constructor).
 */
export interface DesktopAgentOptions {
  appLauncher?: AppLauncher
  /** Pre-seeded catalog apps (merged into `state.appDirectory.apps` at construction). */
  apps?: DirectoryApp[]
  userChannels?: BrowserTypes.Channel[]
  requestIntentResolution?: IntentResolutionCallback
  validator?: MessageValidator
  /**
   * Injectable logger sink for agent-internal structured logs.
   *
   * @remarks Pair with {@link DesktopAgentOptions.logPayloadDetail}: the logger
   * selects where output goes; `logPayloadDetail` selects how much payload is
   * included (metadata at info/warn/error; full JSON at debug when `'full'`).
   */
  logger?: Logger
  /**
   * How much message/context detail agent-internal structured logs include.
   *
   * @defaultValue 'metadata'
   *
   * - `'metadata'` — log type, ids, contextType, key names only; never full
   *   context JSON at info/warn/error.
   * - `'full'` — may include serialized payloads on {@link Logger.debug} only;
   *   requires a logger that implements `debug`.
   *
   * @remarks Use with {@link DesktopAgentOptions.logger}: config selects *what*
   * to log; the logger selects *where* it goes.
   */
  logPayloadDetail?: LogPayloadDetail
  initialState?: Partial<AgentState>

  /** Partial overrides merged with {@link DEFAULT_SAIL_IMPLEMENTATION_METADATA}. */
  implementationMetadata?: Partial<SailImplementationMetadata>

  openContextListenerTimeoutMs?: number
  /**
   * When `true`, the agent sends DACP `heartbeatEvent` messages for liveness after WCP5.
   * FDC3 2.2 leaves this as a Desktop Agent policy (apps cannot opt out via `getAgent()`).
   *
   * @defaultValue `true`
   */
  heartbeatEnabled?: boolean
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
}

/**
 * Fully resolved Desktop Agent configuration after Sail defaults are applied.
 */
export interface DesktopAgentConfig {
  appLauncher?: AppLauncher
  apps?: DirectoryApp[]
  userChannels: BrowserTypes.Channel[]
  requestIntentResolution?: IntentResolutionCallback
  validator?: MessageValidator
  logger?: Logger
  logPayloadDetail: LogPayloadDetail
  initialState?: Partial<AgentState>
  implementationMetadata: SailImplementationMetadata
  openContextListenerTimeoutMs: number
  heartbeatEnabled: boolean
  heartbeatIntervalMs: number
  heartbeatTimeoutMs: number
}

export interface DesktopAgentOpenOptions {
  context?: Context
  instanceId?: string
}

export interface DesktopAgentAppInstance {
  appId: string
  instanceId: string
  status: "pending" | "connected"
  currentUserChannel?: string | null
}

function resolveOpenAppIdentifier(
  app: string | BrowserTypes.AppIdentifier,
  options?: DesktopAgentOpenOptions,
): BrowserTypes.AppIdentifier {
  if (typeof app === "string") {
    return options?.instanceId ? { appId: app, instanceId: options.instanceId } : { appId: app }
  }
  return options?.instanceId ? { ...app, instanceId: options.instanceId } : app
}

function mapToDesktopAgentAppInstance(instance: AppInstance): DesktopAgentAppInstance {
  return {
    appId: instance.appId,
    instanceId: instance.instanceId,
    status: instance.state === AppInstanceState.CONNECTED ? "connected" : "pending",
    currentUserChannel: instance.currentUserChannel,
  }
}

/**
 * Pure FDC3 Desktop Agent implementation.
 *
 * DACP/WCP messages are routed only when an app connection edge is attached
 * ({@link attachAppConnection}). Browser hosts use {@link SailDesktopAgent}.
 */
export class DesktopAgent {
  private state: AgentState
  private appLauncher?: AppLauncher
  private requestIntentResolution?: IntentResolutionCallback
  private validator?: MessageValidator
  private logger: Logger
  private logPayloadDetail: LogPayloadDetail
  private isStarted: boolean = false
  private implementationMetadata: SailImplementationMetadata
  private openContextListenerTimeoutMs: number
  private heartbeatEnabled: boolean
  private heartbeatIntervalMs: number
  private heartbeatTimeoutMs: number
  private pendingIntentPromises = new Map<string, PendingIntentPromiseEntry>()
  private appConnection?: AgentAppConnection

  constructor(options: DesktopAgentOptions = {}) {
    const config = resolveDesktopAgentConfig(options)

    this.implementationMetadata = config.implementationMetadata
    this.openContextListenerTimeoutMs = config.openContextListenerTimeoutMs
    this.heartbeatEnabled = config.heartbeatEnabled
    this.heartbeatIntervalMs = config.heartbeatIntervalMs
    this.heartbeatTimeoutMs = config.heartbeatTimeoutMs
    // userChannels config seeds state once; runtime reads use state.channels.user only.
    this.state = config.initialState
      ? createStateWithOverrides(config.initialState, config.userChannels)
      : createInitialState(config.userChannels)

    if (config.apps) {
      for (const app of config.apps) {
        this.state = addDirectoryApp(this.state, app)
      }
    }

    this.appLauncher = config.appLauncher
    this.requestIntentResolution = config.requestIntentResolution
    this.validator = config.validator
    this.logger = config.logger ?? consoleLogger
    this.logPayloadDetail = config.logPayloadDetail
  }

  /**
   * Start the Desktop Agent after an app connection edge is attached.
   */
  start(): void {
    if (this.isStarted) {
      throw new Error("DesktopAgent is already started")
    }

    this.appConnection?.start()

    if (this.appConnection) {
      this.appConnection.onAppMessage(message => {
        void this.handleMessage(message)
      })
    }

    this.isStarted = true
  }

  /**
   * Stop the Desktop Agent and clean up resources.
   */
  stop(): void {
    if (!this.isStarted) {
      return
    }

    this.appConnection?.stop()
    this.isStarted = false
  }

  private async handleMessage(message: unknown): Promise<void> {
    const messageType = (message as { type?: string })?.type
    if (messageType?.startsWith("WCP")) {
      await this.handleWcpMessage(message)
      return
    }

    // Only process messages FROM apps (have source.instanceId)
    // Messages TO apps (have destination.instanceId but no source) should pass through
    const instanceId = this.extractInstanceId(message)

    if (!instanceId) {
      // Message has no source.instanceId - this is likely a message going TO an app
      // (e.g., contextEvent, responses). Let it pass through without processing.
      return
    }

    const context = this.createHandlerContext(instanceId)
    await routeDACPMessage(message, context)
  }

  private extractInstanceId(message: unknown): string | null {
    if (!message || typeof message !== "object") {
      return null
    }

    const messageObj = message as { meta?: DACPMessageMeta }
    return messageObj.meta?.source?.instanceId || null
  }

  private async handleWcpMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== "object") {
      return
    }

    const messageObj = message as {
      type?: string
      meta?: { connectionAttemptUuid?: string }
    }

    if (messageObj.type === "WCP4ValidateAppIdentity") {
      const connectionAttemptUuid = messageObj.meta?.connectionAttemptUuid
      if (!connectionAttemptUuid) {
        this.logger.warn("[WCP4] Missing connectionAttemptUuid, cannot route message")
        return
      }

      const tempInstanceId = `temp-${connectionAttemptUuid}`
      const wcpContext = this.createHandlerContext(tempInstanceId)
      handleWcp4ValidateAppIdentity(message, wcpContext)
      return
    }

    const instanceId = this.extractInstanceId(message)
    if (!instanceId) {
      this.logger.warn("[WCP] Missing instanceId, cannot route message", {
        messageType: messageObj.type,
      })
      return
    }

    if (messageObj.type === "WCP6Goodbye") {
      cleanupDACPHandlers(this.createHandlerContext(instanceId))
      return
    }

    const wcpContext = this.createHandlerContext(instanceId)
    await routeDACPMessage(message, wcpContext)
  }

  private handleDisconnect(): void {
    const allInstances = Object.values(this.state.instances)
    for (const instance of allInstances) {
      const context = this.createHandlerContext(instance.instanceId)
      cleanupDACPHandlers(context)
    }
  }

  private createHandlerContext(instanceId: string): DACPHandlerContext {
    if (!this.appConnection) {
      throw new Error(
        "DesktopAgent has no app connection attached — attach an app edge before routing DACP/WCP messages",
      )
    }

    const setState: StateSetter = callback => {
      this.state = callback(this.state)
    }
    const responses = createDacpResponseDispatcherFromDelivery(this.appConnection, message =>
      this.appConnection!.connectionRegistry.sendToAppInstance(message),
    )

    return {
      responses,
      instanceId,
      getState: () => this.getState(),
      setState,
      appLauncher: this.appLauncher,
      requestIntentResolution: this.requestIntentResolution,
      validator: this.validator,
      logger: this.logger,
      logPayloadDetail: this.logPayloadDetail,
      implementationMetadata: this.implementationMetadata,
      openContextListenerTimeoutMs: this.openContextListenerTimeoutMs,
      heartbeatEnabled: this.heartbeatEnabled,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      heartbeatTimeoutMs: this.heartbeatTimeoutMs,
      pendingIntentPromises: this.pendingIntentPromises,
      disconnectInstance: instanceId => this.disconnectInstance(instanceId),
      notifyChannelMembershipChanged: this.appConnection.notifyChannelMembershipChanged?.bind(
        this.appConnection,
      ),
    }
  }

  getState(): AgentState {
    return this.state
  }

  protected updateState(callback: Parameters<StateSetter>[0]): void {
    this.state = callback(this.state)
  }

  addApp(app: DirectoryApp): void {
    this.state = addDirectoryApp(this.state, app)
  }

  addApps(apps: DirectoryApp[]): void {
    this.state = addApplications(this.state, apps)
  }

  async addAppDirectory(url: string): Promise<void> {
    this.state = await loadDirectoryIntoState(this.state, url)
  }

  removeApp(appId: string): void {
    this.state = removeApplicationsByAppId(this.state, appId)
  }

  getApps(): DirectoryApp[] {
    return retrieveAllApps(this.state.appDirectory)
  }

  getApp(appId: string): DirectoryApp | undefined {
    return retrieveAppsById(this.state.appDirectory, appId)[0]
  }

  async openApp(
    app: string | BrowserTypes.AppIdentifier,
    options?: DesktopAgentOpenOptions,
  ): Promise<BrowserTypes.AppIdentifier> {
    if (!this.appLauncher) {
      throw new Error("App launching not available - no AppLauncher configured")
    }

    const appIdentifier = resolveOpenAppIdentifier(app, options)
    const catalogApps = retrieveAppsById(this.state.appDirectory, appIdentifier.appId)
    if (catalogApps.length === 0) {
      throw new Error(`App not found in directory: ${appIdentifier.appId}`)
    }

    const payload: BrowserTypes.OpenRequestPayload = {
      app: appIdentifier,
      ...(options?.context !== undefined ? { context: options.context } : {}),
    }

    const launched = await this.appLauncher.launch(payload, catalogApps[0])
    if (launched.instanceId) {
      this.registerPendingHostInstance({
        appId: launched.appId,
        instanceId: launched.instanceId,
      })
    }

    return launched
  }

  getAppInstances(): DesktopAgentAppInstance[] {
    return getAllInstances(this.state).map(mapToDesktopAgentAppInstance)
  }

  getAppInstance(instanceId: string): DesktopAgentAppInstance | undefined {
    const instance = getInstance(this.state, instanceId)
    return instance ? mapToDesktopAgentAppInstance(instance) : undefined
  }

  registerPendingHostInstance(params: { appId: string; instanceId: string }): void {
    if (getInstance(this.state, params.instanceId)) {
      return
    }

    this.state = connectInstance(this.state, {
      instanceId: params.instanceId,
      appId: params.appId,
      metadata: {
        appId: params.appId,
        name: params.appId,
      },
    })
  }

  /**
   * Wire the app connection edge (WCP/MessagePort in browser, test recorder in Vitest/Cucumber).
   */
  attachAppConnection(appConnection: AgentAppConnection): void {
    this.appConnection = appConnection
    appConnection.setOnInstanceTeardown(instanceId => {
      this.disconnectInstance(instanceId)
    })

    const testConnection = appConnection as {
      setOnAgentDisconnect?: (handler: () => void) => void
    }
    testConnection.setOnAgentDisconnect?.(() => {
      this.handleDisconnect()
    })
  }

  getAppConnection(instanceId: string): AppConnectionMetadata | undefined {
    return this.appConnection?.getConnection(instanceId)
  }

  getAppConnections(): AppConnectionMetadata[] {
    return this.appConnection?.getConnections() ?? []
  }

  disconnectInstance(instanceId: string): void {
    cleanupDACPHandlers(this.createHandlerContext(instanceId))
    this.appConnection?.pruneAppConnection(instanceId)
  }

  exportState(): string {
    return JSON.stringify(this.state, null, 2)
  }

  getIsStarted(): boolean {
    return this.isStarted
  }

  getImplementationMetadata(): SailImplementationMetadata {
    return this.implementationMetadata
  }

  getUserChannels(): BrowserTypes.Channel[] {
    return getAllUserChannels(this.state)
  }

  getAppUserChannelId(instanceId: string): string | null {
    const instance = getInstance(this.state, instanceId)
    return instance?.currentUserChannel ?? null
  }

  /**
   * Host-initiated user channel join or leave for an app instance.
   *
   * Runs the same DACP join/leave handlers as app-originated requests but does not
   * require an app MessagePort to receive the response. When no apps registered
   * `channelChanged` event listeners, emits a `channelChangedEvent` on the app edge
   * so host UI can observe membership changes.
   */
  changeAppUserChannel(instanceId: string, channelId: string | null): void {
    if (channelId !== null && !getUserChannel(this.state, channelId)) {
      throw new NoChannelFoundError(`Channel ${channelId} does not exist`)
    }

    const context = this.createHandlerContext(instanceId)
    const requestUuid = crypto.randomUUID()
    const instance = getInstance(this.state, instanceId)
    const source: BrowserTypes.AppIdentifier = {
      appId: instance?.appId ?? "unknown",
      instanceId,
    }
    const meta: BrowserTypes.AppRequestMessageMeta = {
      requestUuid,
      timestamp: new Date(),
      source,
    }

    const hostInitiated = { hostInitiated: true as const }

    if (channelId !== null) {
      handleJoinUserChannelRequest(
        {
          type: "joinUserChannelRequest",
          payload: { channelId },
          meta,
        },
        context,
        hostInitiated,
      )
    } else {
      handleLeaveCurrentChannelRequest(
        {
          type: "leaveCurrentChannelRequest",
          payload: {},
          meta,
        },
        context,
        hostInitiated,
      )
    }
  }
}
