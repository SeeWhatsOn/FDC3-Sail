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
import { IntentRegistry, type IntentCapability } from "./state/intent-registry"
import { ChannelContextRegistry } from "./state/channel-context-registry"
import { AppChannelRegistry } from "./state/app-channel-registry"
import { UserChannelRegistry } from "./state/user-channel-registry"
import { AppDirectoryManager } from "./app-directory/app-directory-manager"
import { routeDACPMessage, cleanupDACPHandlers } from "./handlers/dacp"
import type {
  DACPHandlerContext,
  IntentResolutionCallback,
  MessageValidator,
} from "./handlers/types"
import type { DirectoryApp } from "./app-directory/types"
import type { BrowserTypes } from "@finos/fdc3"
import { InMemoryTransport } from "../transports/in-memory-transport"

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

  /**
   * Array of DirectoryApp entries to initialize the app directory with.
   * OPTIONAL - if provided, apps will be added to the directory and synced to intent registry.
   * Convenience option that simplifies initialization - equivalent to creating AppDirectoryManager
   * and calling add() for each app, then syncAppDirectoryToIntentRegistry().
   */
  apps?: DirectoryApp[]

  /**
   * Array of user channels to initialize the user channel registry with.
   * OPTIONAL - if provided, these channels will be used instead of default FDC3 channels.
   * If `userChannelRegistry` is also provided, this will be ignored.
   */
  channels?: BrowserTypes.Channel[]

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
  private transport?: Transport
  private appLauncher?: AppLauncher
  private appInstanceRegistry: AppInstanceRegistry
  private intentRegistry?: IntentRegistry
  private channelContextRegistry?: ChannelContextRegistry
  private appChannelRegistry?: AppChannelRegistry
  private userChannelRegistry?: UserChannelRegistry
  private appDirectory?: AppDirectoryManager
  private requestIntentResolution?: IntentResolutionCallback
  private validator?: MessageValidator
  private isStarted: boolean = false

  constructor(config?: DesktopAgentConfig) {

    // TODO: there should be a way to pass in the intent resolver and the app launcher should there be defaults for these options?
    this.requestIntentResolution = config?.requestIntentResolution
    this.appLauncher = config?.appLauncher

    // Use provided config or create defaults
    this.appInstanceRegistry = config?.appInstanceRegistry ?? new AppInstanceRegistry()
    this.intentRegistry = config?.intentRegistry ?? new IntentRegistry()
    this.channelContextRegistry = config?.channelContextRegistry ?? new ChannelContextRegistry()
    this.appChannelRegistry = config?.appChannelRegistry ?? new AppChannelRegistry()
    this.transport = config?.transport ?? new InMemoryTransport()
    this.appDirectory = config?.appDirectoryManager ?? new AppDirectoryManager()
    this.userChannelRegistry = config?.userChannelRegistry ?? new UserChannelRegistry()
    //TODO fix this and add the option to pass a validator function
    this.validator = config?.validator || (() => true) as MessageValidator
 
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
   * Messages from apps have meta.source.instanceId set by WCPConnector.
   * Messages to apps have meta.destination.instanceId but no source.
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
      requestIntentResolution: this.requestIntentResolution,
      validator: this.validator,
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

  /**
   * Syncs apps from the app directory to the intent registry.
   * This registers intent capabilities for all apps in the directory.
   * Should be called after loading apps into the directory.
   */
  syncAppDirectoryToIntentRegistry(): void {
    const apps = this.appDirectory.retrieveAllApps()

    for (const app of apps) {
      const intents = app.interop?.intents?.listensFor
      if (!intents || typeof intents !== "object") {
        continue
      }

      const capabilities: Record<string, IntentCapability> = {}

      for (const [intentName, intentConfig] of Object.entries(intents)) {
        if (intentConfig && typeof intentConfig === "object" && "contexts" in intentConfig) {
          capabilities[intentName] = {
            intentName,
            appId: app.appId,
            contextTypes: Array.isArray(intentConfig.contexts) ? intentConfig.contexts : [],
            resultType:
              "resultType" in intentConfig && typeof intentConfig.resultType === "string"
                ? intentConfig.resultType
                : undefined,
            displayName:
              "displayName" in intentConfig && typeof intentConfig.displayName === "string"
                ? intentConfig.displayName
                : undefined,
            customConfig:
              "customConfig" in intentConfig && typeof intentConfig.customConfig === "object"
                ? (intentConfig.customConfig)
                : undefined,
          }
        }
      }

      if (Object.keys(capabilities).length > 0) {
        this.intentRegistry.registerAppCapabilities(app.appId, capabilities)
      }
    }
  }
}
