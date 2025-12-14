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
import { AppInstanceRegistry } from "./state/app-instance-registry"
import { IntentRegistry } from "./state/intent-registry"
import { ChannelContextRegistry } from "./state/channel-context-registry"
import { AppChannelRegistry } from "./state/app-channel-registry"
import { UserChannelRegistry } from "./state/user-channel-registry"
import { AppDirectoryManager } from "./app-directory/app-directory-manager"
import { routeDACPMessage, cleanupDACPHandlers } from "./handlers/dacp"
import type { DACPHandlerContext } from "./handlers/types"

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
   * App instance registry for tracking connected apps.
   * OPTIONAL - defaults to new instance if not provided.
   */
  appInstanceRegistry?: AppInstanceRegistry

  /**
   * Intent registry for managing intent handlers and resolution.
   * OPTIONAL - defaults to new instance if not provided.
   */
  intentRegistry?: IntentRegistry

  /**
   * Channel context registry for storing last broadcast context per channel.
   * OPTIONAL - defaults to new instance if not provided.
   */
  channelContextRegistry?: ChannelContextRegistry

  /**
   * App channel registry for managing dynamically created app channels.
   * OPTIONAL - defaults to new instance if not provided.
   */
  appChannelRegistry?: AppChannelRegistry

  /**
   * User channel registry for managing pre-defined user channels.
   * OPTIONAL - defaults to new instance with standard FDC3 channels if not provided.
   */
  userChannelRegistry?: UserChannelRegistry

  /**
   * App directory manager for querying app metadata.
   * OPTIONAL - defaults to new instance if not provided.
   */
  appDirectoryManager?: AppDirectoryManager
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
 * // Create with Socket.IO transport (Node.js server)
 * const agent = new DesktopAgent({
 *   transport: new SocketIOTransport(socket),
 *   appLauncher: new BrowserAppLauncher(),
 * })
 *
 * // Wire up message handling
 * agent.start()
 * ```
 */
export class DesktopAgent {
  private transport: Transport
  private appLauncher?: AppLauncher
  private appInstanceRegistry: AppInstanceRegistry
  private intentRegistry: IntentRegistry
  private channelContextRegistry: ChannelContextRegistry
  private appChannelRegistry: AppChannelRegistry
  private userChannelRegistry: UserChannelRegistry
  private appDirectory: AppDirectoryManager
  private isStarted: boolean = false

  constructor(config: DesktopAgentConfig) {
    this.transport = config.transport
    this.appLauncher = config.appLauncher

    // Use provided registries or create defaults
    this.appInstanceRegistry = config.appInstanceRegistry ?? new AppInstanceRegistry()
    this.intentRegistry = config.intentRegistry ?? new IntentRegistry()
    this.channelContextRegistry = config.channelContextRegistry ?? new ChannelContextRegistry()
    this.appChannelRegistry = config.appChannelRegistry ?? new AppChannelRegistry()
    this.userChannelRegistry = config.userChannelRegistry ?? new UserChannelRegistry()
    this.appDirectory = config.appDirectoryManager ?? new AppDirectoryManager()
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
   * Handle an incoming DACP message from an app.
   * Creates the handler context and routes to appropriate handler.
   */
  private async handleMessage(message: unknown): Promise<void> {
    // Extract instanceId from message metadata (set by WCPConnector)
    const instanceId = this.extractInstanceId(message)

    const context = this.createHandlerContext(instanceId)
    await routeDACPMessage(message, context)
  }

  /**
   * Extract instanceId from DACP message metadata.
   * Messages from apps have meta.source.instanceId set by WCPConnector.
   */
  private extractInstanceId(message: unknown): string {
    if (!message || typeof message !== "object") {
      return ""
    }

    const messageObj = message as { meta?: DACPMessageMeta }
    return messageObj.meta?.source?.instanceId || ""
  }

  /**
   * Handle transport disconnection.
   * Cleans up state for all instances since transport-level disconnect affects all.
   * Note: For browser Desktop Agent, individual app disconnects are handled via
   * DACP heartbeat, not transport disconnect.
   */
  private handleDisconnect(): void {
    // Transport-level disconnect - clean up all instances
    // This is primarily for server-side Socket.IO transport where each
    // socket represents one app. For browser Desktop Agent with InMemoryTransport,
    // this rarely fires (only when the whole agent shuts down).
    const allInstances = this.appInstanceRegistry.getAllInstances()
    for (const instance of allInstances) {
      const context = this.createHandlerContext(instance.instanceId)
      cleanupDACPHandlers(context)
    }
  }

  /**
   * Create the handler context for DACP message handlers.
   *
   * @param instanceId - The app instance ID extracted from message metadata
   */
  private createHandlerContext(instanceId: string): DACPHandlerContext {
    return {
      transport: this.transport,
      instanceId,
      appInstanceRegistry: this.appInstanceRegistry,
      intentRegistry: this.intentRegistry,
      channelContextRegistry: this.channelContextRegistry,
      appChannelRegistry: this.appChannelRegistry,
      userChannelRegistry: this.userChannelRegistry,
      appDirectory: this.appDirectory,
      appLauncher: this.appLauncher,
    }
  }

  /**
   * Get the app instance registry (for testing/inspection)
   */
  getAppInstanceRegistry(): AppInstanceRegistry {
    return this.appInstanceRegistry
  }

  /**
   * Get the intent registry (for testing/inspection)
   */
  getIntentRegistry(): IntentRegistry {
    return this.intentRegistry
  }

  /**
   * Get the channel context registry (for testing/inspection)
   */
  getChannelContextRegistry(): ChannelContextRegistry {
    return this.channelContextRegistry
  }

  /**
   * Get the app channel registry (for testing/inspection)
   */
  getAppChannelRegistry(): AppChannelRegistry {
    return this.appChannelRegistry
  }

  /**
   * Get the user channel registry (for testing/inspection)
   */
  getUserChannelRegistry(): UserChannelRegistry {
    return this.userChannelRegistry
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
}
