/**
 * FDC3 Desktop Agent
 *
 * Pure, environment-agnostic implementation of the FDC3 Desktop Agent.
 * All external dependencies (transport, app launcher, registries) are injected
 * via constructor, making this portable across different environments
 * (browser, Node.js, Electron, etc.)
 */

import type { Transport } from "./interfaces/Transport"
import type { AppLauncher } from "./interfaces/AppLauncher"
import { AppInstanceRegistry } from "./state/AppInstanceRegistry"
import { IntentRegistry } from "./state/IntentRegistry"
import { AppDirectoryManager } from "./app-directory/appDirectoryManager"
import { routeDACPMessage, cleanupDACPHandlers } from "./handlers/dacp"
import type { DACPHandlerContext } from "./handlers/types"

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
   * App directory manager for querying app metadata.
   * OPTIONAL - defaults to new instance if not provided.
   */
  appDirectory?: AppDirectoryManager
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
  private appDirectory: AppDirectoryManager
  private isStarted: boolean = false

  constructor(config: DesktopAgentConfig) {
    this.transport = config.transport
    this.appLauncher = config.appLauncher

    // Use provided registries or create defaults
    this.appInstanceRegistry = config.appInstanceRegistry ?? new AppInstanceRegistry()
    this.intentRegistry = config.intentRegistry ?? new IntentRegistry()
    this.appDirectory = config.appDirectory ?? new AppDirectoryManager()
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
    this.transport.onMessage(async (message) => {
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
    const context = this.createHandlerContext()
    await routeDACPMessage(message, context)

    // After WCP handshake, instanceId will be set in the transport
    // We need to update the instance with the transport reference
    const instanceId = this.transport.getInstanceId()
    if (instanceId) {
      const instance = this.appInstanceRegistry.getInstance(instanceId)
      if (instance && !instance.transport) {
        instance.transport = this.transport
      }
    }
  }

  /**
   * Handle transport disconnection.
   * Cleans up state for the disconnected instance.
   */
  private handleDisconnect(): void {
    const instanceId = this.transport.getInstanceId()
    if (instanceId) {
      const context = this.createHandlerContext()
      cleanupDACPHandlers(context)
    }
  }

  /**
   * Create the handler context for DACP message handlers.
   */
  private createHandlerContext(): DACPHandlerContext {
    return {
      transport: this.transport,
      instanceId: this.transport.getInstanceId(),
      appInstanceRegistry: this.appInstanceRegistry,
      intentRegistry: this.intentRegistry,
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
