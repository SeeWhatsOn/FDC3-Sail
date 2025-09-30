/**
 * DesktopAgent - Central FDC3 Desktop Agent Implementation
 *
 * This is the main entry point for the FDC3 Desktop Agent, providing a unified
 * interface to all desktop agent functionality. Implements the singleton pattern
 * to ensure only one instance exists.
 */

import type { AppMetadata } from "@finos/fdc3"
import { appInstanceRegistry, type AppInstance, type CreateAppInstanceParams } from "./state/AppInstanceRegistry"
import { intentRegistry } from "./state/IntentRegistry"
import { AppDirectoryManager } from "./app-directory/appDirectoryManager"
import {
  registerDACPHandlers,
  processDACPMessage,
  cleanupDACPHandlers,
  getDACPHandlerStats,
  checkDACPHandlerHealth
} from "./handlers/dacp"
import type { DACPHandlerContext, TransportAgnosticDACPHandlerContext } from "./handlers/types"
import type { TransportAdapter, DACPMessage } from "./transport"

/**
 * Configuration options for the Desktop Agent
 */
export interface DesktopAgentConfig {
  /** App directory URLs to load at startup */
  appDirectoryUrls?: string[]
  /** Enable debug logging */
  debug?: boolean
  /** Custom app directory manager instance */
  appDirectoryManager?: AppDirectoryManager
}

/**
 * Health status of the Desktop Agent
 */
export interface DesktopAgentHealth {
  status: "healthy" | "degraded" | "unhealthy"
  components: {
    handlers: ReturnType<typeof checkDACPHandlerHealth>
    appRegistry: { status: "healthy"; instanceCount: number }
    intentRegistry: { status: "healthy"; registrationCount: number }
    appDirectory: { status: "healthy"; appCount: number }
  }
}

/**
 * Main Desktop Agent class - Singleton implementation
 *
 * Coordinates all desktop agent components including:
 * - DACP message handlers
 * - App instance registry
 * - Intent registry
 * - App directory management
 */
export class DesktopAgent {
  private static instance: DesktopAgent | null = null
  private initialized = false
  private appDirectory: AppDirectoryManager
  private config: DesktopAgentConfig

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(config: DesktopAgentConfig = {}) {
    this.config = config
    this.appDirectory = config.appDirectoryManager || new AppDirectoryManager()
  }

  /**
   * Gets the singleton Desktop Agent instance
   */
  static getInstance(config?: DesktopAgentConfig): DesktopAgent {
    if (!DesktopAgent.instance) {
      DesktopAgent.instance = new DesktopAgent(config)
    }
    return DesktopAgent.instance
  }

  /**
   * Initializes the Desktop Agent with optional configuration
   */
  async initialize(config: DesktopAgentConfig = {}): Promise<void> {
    if (this.initialized) {
      return
    }

    // Merge config
    this.config = { ...this.config, ...config }

    // Load app directories if provided
    if (this.config.appDirectoryUrls && this.config.appDirectoryUrls.length > 0) {
      try {
        await this.appDirectory.replace(this.config.appDirectoryUrls)
        if (this.config.debug) {
          console.log(`Loaded ${this.appDirectory.retrieveAllApps().length} apps from directories`)
        }
      } catch (error) {
        console.error("Failed to load app directories:", error)
        // Don't fail initialization if app directory loading fails
      }
    }

    this.initialized = true

    if (this.config.debug) {
      console.log("Desktop Agent initialized successfully")
    }
  }

  /**
   * Checks if the Desktop Agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Gets the FDC3 implementation metadata for this agent.
   */
  getImplementationMetadata() {
    // As per the implementation plan and tests
    return {
      fdc3Version: "2.2",
      provider: "FDC3-Sail",
      providerVersion: "0.1.0", // Placeholder version
      optionalFeatures: {
        OriginatingAppMetadata: true,
        UserChannelMembershipAPIs: true,
        PrivateChannels: false, // To be updated once implemented
      },
    };
  }

  // ============================================================================
  // APP INSTANCE MANAGEMENT
  // ============================================================================

  /**
   * Creates a new app instance
   */
  createAppInstance(params: CreateAppInstanceParams): AppInstance {
    return appInstanceRegistry.createInstance(params)
  }

  /**
   * Gets an app instance by ID
   */
  getAppInstance(instanceId: string): AppInstance | undefined {
    return appInstanceRegistry.getInstance(instanceId)
  }

  /**
   * Gets all app instances
   */
  getAllAppInstances(): AppInstance[] {
    return appInstanceRegistry.getAllInstances()
  }

  /**
   * Removes an app instance and cleans up all associated resources
   */
  removeAppInstance(instanceId: string): boolean {
    // Clean up DACP handlers first
    cleanupDACPHandlers(instanceId)

    // Remove from registry
    return appInstanceRegistry.removeInstance(instanceId)
  }

  // ============================================================================
  // DACP MESSAGE HANDLING
  // ============================================================================

  /**
   * Registers DACP handlers for a message port
   */
  registerDACPHandlers(
    messagePort: MessagePort,
    serverContext: any,
    fdc3Server: any,
    instanceId: string
  ): void {
    registerDACPHandlers(messagePort, serverContext, fdc3Server, instanceId)
  }

  /**
   * Processes a DACP message in a transport-agnostic way
   */
  async processDACPMessage(
    message: unknown,
    context: Omit<DACPHandlerContext, "messagePort">,
    reply: (response: any) => void
  ): Promise<void> {
    await processDACPMessage(message, context, reply)
  }

  /**
   * Registers a transport adapter for an instance
   * This enables transport-agnostic communication
   */
  registerTransport(
    transport: TransportAdapter,
    serverContext: any,
    fdc3Server: any,
    instanceId: string
  ): void {
    const context: Omit<TransportAgnosticDACPHandlerContext, "reply"> = {
      serverContext,
      fdc3Server,
      instanceId,
      appInstanceRegistry,
      intentRegistry
    }

    // Set up transport to handle incoming messages
    transport.listen('*', async (message: DACPMessage) => {
      const reply = (response: any) => {
        // Ensure response has proper structure
        if (message.meta.requestUuid) {
          response.meta = {
            ...response.meta,
            responseUuid: message.meta.requestUuid,
            timestamp: new Date().toISOString()
          }
        }
        // Note: For transport adapters, responses are typically sent through
        // the transport's own mechanism, not through a reply function
        // This is handled by the individual handlers
      }

      await this.processDACPMessage(message, context, reply)
    })
  }

  /**
   * Cleans up DACP handlers for an instance
   */
  cleanupDACPHandlers(instanceId: string): void {
    cleanupDACPHandlers(instanceId)
  }

  // ============================================================================
  // APP DIRECTORY MANAGEMENT
  // ============================================================================

  /**
   * Gets the app directory manager
   */
  getAppDirectory(): AppDirectoryManager {
    return this.appDirectory
  }

  /**
   * Loads additional app directories
   */
  async loadAppDirectories(urls: string[]): Promise<void> {
    await this.appDirectory.replace(urls)
  }

  /**
   * Finds apps by app ID
   */
  findAppById(appId: string): AppMetadata | undefined {
    const allApps = this.appDirectory.retrieveAllApps()
    return allApps.find(app => app.appId === appId) as AppMetadata | undefined
  }

  /**
   * Finds apps by URL
   */
  findAppsByUrl(url: string): AppMetadata[] {
    return this.appDirectory.retrieveAppsByUrl(url) as AppMetadata[]
  }

  // ============================================================================
  // INTENT REGISTRY ACCESS
  // ============================================================================

  /**
   * Gets the intent registry
   */
  getIntentRegistry() {
    return intentRegistry
  }

  // ============================================================================
  // APP INSTANCE REGISTRY ACCESS
  // ============================================================================

  /**
   * Gets the app instance registry
   */
  getAppInstanceRegistry() {
    return appInstanceRegistry
  }

  // ============================================================================
  // HEALTH AND DIAGNOSTICS
  // ============================================================================

  /**
   * Gets health status of all desktop agent components
   */
  getHealth(): DesktopAgentHealth {
    const handlerHealth = checkDACPHandlerHealth()
    const appRegistryStats = appInstanceRegistry.getStats()
    const intentRegistryStats = intentRegistry.getStats()
    const appDirectoryApps = this.appDirectory.retrieveAllApps()

    return {
      status: handlerHealth.status,
      components: {
        handlers: handlerHealth,
        appRegistry: {
          status: "healthy",
          instanceCount: appRegistryStats.totalInstances
        },
        intentRegistry: {
          status: "healthy",
          registrationCount: intentRegistryStats.totalRegistrations
        },
        appDirectory: {
          status: "healthy",
          appCount: appDirectoryApps.length
        }
      }
    }
  }

  /**
   * Gets statistics about the desktop agent
   */
  getStats() {
    const handlerStats = getDACPHandlerStats()
    const appRegistryStats = appInstanceRegistry.getStats()
    const intentRegistryStats = intentRegistry.getStats()
    const appDirectoryApps = this.appDirectory.retrieveAllApps()

    return {
      handlers: handlerStats,
      appRegistry: appRegistryStats,
      intentRegistry: intentRegistryStats,
      appDirectory: {
        totalApps: appDirectoryApps.length,
        appTypes: appDirectoryApps.reduce((acc, app) => {
          const type = (app as any).type || 'unknown'
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
    }
  }

  /**
   * Resets the singleton instance (for testing)
   */
  static reset(): void {
    DesktopAgent.instance = null
  }

  /**
   * Shuts down the desktop agent and cleans up resources
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    // Clean up all app instances
    const instances = appInstanceRegistry.getAllInstances()
    for (const instance of instances) {
      this.removeAppInstance(instance.instanceId)
    }

    // Clear registries
    appInstanceRegistry.clear()
    intentRegistry.clear()

    this.initialized = false

    if (this.config.debug) {
      console.log("Desktop Agent shut down successfully")
    }
  }
}

/**
 * Gets the singleton Desktop Agent instance
 * @param config Optional configuration for first-time initialization
 */
export function getDesktopAgent(config?: DesktopAgentConfig): DesktopAgent {
  return DesktopAgent.getInstance(config)
}

/**
 * Default export for convenience
 */
export default DesktopAgent