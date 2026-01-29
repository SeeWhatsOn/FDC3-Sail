/**
 * FDC3 Desktop Agent
 *
 * Pure, environment-agnostic implementation of the FDC3 Desktop Agent.
 * All external dependencies (transport, app launcher, registries) are injected
 * via constructor, making this portable across different environments
 * (browser, Node.js, Electron, etc.)
 */

import type { Transport } from "./interfaces/transport"
import type { AppLauncher } from "./interfaces/app-launcher"
import { AppDirectoryManager } from "./app-directory/app-directory-manager"
import { routeDACPMessage, cleanupDACPHandlers } from "./handlers/dacp"
import type {
  DACPHandlerContext,
  IntentResolutionCallback,
  MessageValidator,
  PendingIntentPromiseEntry,
} from "./handlers/types"
import type { DirectoryApp } from "./app-directory/types"
import type { BrowserTypes } from "@finos/fdc3"
import { InMemoryTransport } from "../transports/in-memory-transport"
import type { AgentState, StateSetter } from "./state/types"
import { createInitialState, createStateWithOverrides } from "./state/initial-state"
import { consoleLogger, type Logger } from "./interfaces/logger"
import { DACP_TIMEOUTS } from "./dacp-protocol/dacp-constants"

type Channel = BrowserTypes.Channel

/**
 * Default FDC3 user channels (fdc3.channel.1 through fdc3.channel.8)
 */
const defaultUserChannels: Channel[] = [
  {
    id: "fdc3.channel.1",
    type: "user",
    displayMetadata: {
      name: "Channel 1",
      color: "#FF0000",
      glyph: "1",
    },
  },
  {
    id: "fdc3.channel.2",
    type: "user",
    displayMetadata: {
      name: "Channel 2",
      color: "#FF8800",
      glyph: "2",
    },
  },
  {
    id: "fdc3.channel.3",
    type: "user",
    displayMetadata: {
      name: "Channel 3",
      color: "#FFFF00",
      glyph: "3",
    },
  },
  {
    id: "fdc3.channel.4",
    type: "user",
    displayMetadata: {
      name: "Channel 4",
      color: "#00FF00",
      glyph: "4",
    },
  },
  {
    id: "fdc3.channel.5",
    type: "user",
    displayMetadata: {
      name: "Channel 5",
      color: "#00FFFF",
      glyph: "5",
    },
  },
  {
    id: "fdc3.channel.6",
    type: "user",
    displayMetadata: {
      name: "Channel 6",
      color: "#0000FF",
      glyph: "6",
    },
  },
  {
    id: "fdc3.channel.7",
    type: "user",
    displayMetadata: {
      name: "Channel 7",
      color: "#FF00FF",
      glyph: "7",
    },
  },
  {
    id: "fdc3.channel.8",
    type: "user",
    displayMetadata: {
      name: "Channel 8",
      color: "#800080",
      glyph: "8",
    },
  },
]

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
 * Configuration for creating a Desktop Agent instance
 */
export interface DesktopAgentConfig {
  /**
   * Transport implementation for bidirectional message communication.
   * REQUIRED - must be provided by environment-specific code.
   */
  transport: Transport

  /**
   * App launcher implementation for opening/launching FDC3 applications.
   * OPTIONAL - if not provided, openRequest will fail gracefully.
   */
  appLauncher?: AppLauncher

  /**
   * App directory manager for querying app metadata.
   * OPTIONAL - defaults to new instance if not provided.
   */
  appDirectoryManager?: AppDirectoryManager

  /**
   * Array of DirectoryApp entries to initialize the app directory with.
   * OPTIONAL - if provided, apps will be added to the directory.
   */
  apps?: DirectoryApp[]

  /**
   * Array of user channels to initialize the user channel registry with.
   * OPTIONAL - if provided, these channels will be used instead of default FDC3 channels.
   */
  userChannels?: BrowserTypes.Channel[]

  /**
   * Callback for requesting UI-based intent resolution when multiple handlers exist.
   * OPTIONAL - if not provided, the first handler is automatically selected.
   * Injected by browser/server implementations to enable intent resolver UI.
   */
  requestIntentResolution?: IntentResolutionCallback

  /**
   * Optional message validator for validating DACP messages.
   * OPTIONAL - if not provided, messages are processed without schema validation.
   * Implementations can inject Zod, AJV, or custom validators from sail-platform-sdk.
   */
  validator?: MessageValidator

  /**
   * Logger instance for DACP handlers.
   * OPTIONAL - defaults to consoleLogger if not provided.
   */
  logger?: Logger

  /**
   * Initial state (for testing/persistence).
   * OPTIONAL - if provided, merges with default initial state.
   */
  initialState?: Partial<AgentState>

  /**
   * Implementation metadata for the desktop agent.
   * Required - must be provided by environment-specific code.
   */
  implementationMetadata?: Pick<
    BrowserTypes.ImplementationMetadata,
    "fdc3Version" | "provider" | "providerVersion"
  > &
    Partial<Pick<BrowserTypes.ImplementationMetadata, "optionalFeatures">>

  /**
   * Timeout (ms) to wait for a context listener after open-with-context.
   * Defaults to the FDC3 minimum (15s) but can be shortened for tests.
   */
  openContextListenerTimeoutMs?: number

  /**
   * Heartbeat interval (ms). Defaults to 30s but can be shortened for tests.
   */
  heartbeatIntervalMs?: number

  /**
   * Heartbeat timeout (ms). Defaults to 60s but can be shortened for tests.
   */
  heartbeatTimeoutMs?: number
}

/**
 * Pure FDC3 Desktop Agent implementation.
 *
 * This class is environment-agnostic and has zero dependencies on specific
 * transport mechanisms, UI frameworks, or runtime environments. All external
 * concerns are injected via the constructor.
 *
 * @example
 * ```typescript
 * const agent = new DesktopAgent()
 *
 * agent.start()
 *
 * OR
 *
 * const agent = new DesktopAgent({
 *   transport: new InMemoryTransport,
 *   appLauncher: new BrowserAppLauncher(),
 * })
 *
 * agent.start()
 * ```
 */
export class DesktopAgent {
  private state: AgentState
  private transport: Transport
  private appDirectory: AppDirectoryManager
  private appLauncher?: AppLauncher
  private requestIntentResolution?: IntentResolutionCallback
  private validator?: MessageValidator
  private logger: Logger
  private isStarted: boolean = false
  private implementationMetadata?: DesktopAgentConfig["implementationMetadata"]
  private userChannels: BrowserTypes.Channel[]
  private openContextListenerTimeoutMs: number
  private heartbeatIntervalMs: number
  private heartbeatTimeoutMs: number
  private pendingIntentPromises = new Map<string, PendingIntentPromiseEntry>()

  constructor(config?: DesktopAgentConfig) {
    this.transport = config?.transport ?? new InMemoryTransport()
    this.appDirectory = config?.appDirectoryManager ?? new AppDirectoryManager()
    this.appLauncher = config?.appLauncher
    this.requestIntentResolution = config?.requestIntentResolution
    this.validator = config?.validator
    this.logger = config?.logger ?? consoleLogger
    this.userChannels = config?.userChannels ?? defaultUserChannels
    this.implementationMetadata = config?.implementationMetadata ?? {
      // TODO: Get this from the env or move to a config file.
      fdc3Version: "2.2",
      provider: "FDC3-Sail",
      providerVersion: "3.0.0",
      optionalFeatures: {
        DesktopAgentBridging: false,
        OriginatingAppMetadata: true,
        UserChannelMembershipAPIs: true,
      },
    }
    this.openContextListenerTimeoutMs =
      config?.openContextListenerTimeoutMs ?? DACP_TIMEOUTS.MINIMUM_APP_LAUNCH
    this.heartbeatIntervalMs = config?.heartbeatIntervalMs ?? 30000
    this.heartbeatTimeoutMs = config?.heartbeatTimeoutMs ?? 60000
    // Initialize state - use this.userChannels to ensure consistency
    this.state = config?.initialState
      ? createStateWithOverrides(config.initialState, this.userChannels)
      : createInitialState(this.userChannels)

    // Initialize app directory with provided apps if any
    if (config?.apps) {
      for (const app of config.apps) {
        this.appDirectory.add(app)
      }
    }
  }

  /**
   * Start the Desktop Agent by wiring up transport message handlers.
   * Call this after construction to begin processing messages.
   */
  start(): void {
    if (this.isStarted) {
      throw new Error("DesktopAgent is already started")
    }

    // Set up message handler
    this.transport.onMessage(async message => {
      await this.handleMessage(message)
    })

    // Set up disconnect handler
    this.transport.onDisconnect(() => {
      this.handleDisconnect()
    })

    this.isStarted = true
  }

  /**
   * Stop the Desktop Agent and clean up resources.
   */
  stop(): void {
    if (!this.isStarted) {
      return
    }

    this.transport.disconnect()
    this.isStarted = false
  }
  /**
   * Handle an incoming DACP message from an app and route it.
   */
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
  /**
   * Extract instanceId from DACP message metadata.
   * Messages from apps have meta.source.instanceId set by WCPConnector; messages to apps do not.
   */
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
      await routeDACPMessage(message, wcpContext)
      return
    }

    const instanceId = this.extractInstanceId(message) ?? this.transport.getInstanceId()
    if (!instanceId) {
      this.logger.warn("[WCP] Missing instanceId, cannot route message", {
        messageType: messageObj.type,
      })
      return
    }

    const wcpContext = this.createHandlerContext(instanceId)
    await routeDACPMessage(message, wcpContext)
  }
  /**
   * Handle transport-level disconnection; app disconnects use WCP6Goodbye/heartbeat.
   */
  private handleDisconnect(): void {
    // Transport is already disconnected - we cannot send messages
    // Clean up all instances from internal state
    const allInstances = Object.values(this.state.instances)
    for (const instance of allInstances) {
      // createHandlerContext is needed because cleanupDACPHandlers requires
      // a DACPHandlerContext with transport, instanceId, getState, setState, logger, etc.
      const context = this.createHandlerContext(instance.instanceId)
      cleanupDACPHandlers(context)
    }
  }
  /**
   * Create the handler context for DACP message handlers.
   * @param instanceId - The app instance ID extracted from message metadata
   */
  private createHandlerContext(instanceId: string): DACPHandlerContext {
    const setState: StateSetter = callback => {
      this.state = callback(this.state)
    }
    return {
      transport: this.transport,
      instanceId,
      getState: () => this.getState(),
      setState,
      appDirectory: this.appDirectory,
      appLauncher: this.appLauncher,
      requestIntentResolution: this.requestIntentResolution,
      validator: this.validator,
      logger: this.logger,
      implementationMetadata: this.implementationMetadata,
      openContextListenerTimeoutMs: this.openContextListenerTimeoutMs,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      heartbeatTimeoutMs: this.heartbeatTimeoutMs,
      pendingIntentPromises: this.pendingIntentPromises,
    }
  }
  /**
   * Get current state snapshot (for debugging/export)
   */
  getState(): AgentState {
    return this.state
  }
  /**
   * Update state (for testing purposes only).
   * In production, state is only updated through handler contexts.
   */
  updateStateForTesting(callback: (state: AgentState) => AgentState): void {
    const setState: StateSetter = (cb: (state: AgentState) => AgentState) => {
      this.state = cb(this.state)
    }
    setState(callback)
  }
  /** Export state as JSON string (for debugging/persistence) */
  exportState(): string {
    return JSON.stringify(this.state, null, 2)
  }
  /**
   * Get the app directory (for testing/inspection)
   */
  getAppDirectory(): AppDirectoryManager {
    return this.appDirectory
  }
  /**
   * Check if the agent is started
   */
  getIsStarted(): boolean {
    return this.isStarted
  }
  /**
   * Get the implementation metadata (for testing/inspection)
   */
  getImplementationMetadata(): DesktopAgentConfig["implementationMetadata"] {
    return this.implementationMetadata
  }
  /**
   * Get the configured user channels.
   * User channels are static configuration set at initialization and never change.
   */
  getUserChannels(): BrowserTypes.Channel[] {
    return this.userChannels
  }
}
