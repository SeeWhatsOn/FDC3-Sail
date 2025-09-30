/**
 * Desktop Agent Singleton
 *
 * Wraps the existing FDC3 desktop agent components into a proper singleton
 * that can be shared across all user connections and provides transport-agnostic
 * message processing.
 */

import {
  appInstanceRegistry,
  intentRegistry,
  AppDirectoryManager,
  processDACPMessage,
  registerDACPHandlers,
  type AppInstance,
  type AppInstanceState,
  AppInstanceState as States
} from "@finos/fdc3-sail-desktop-agent"
import type { DirectoryApp } from "../types/sail-types"

// ============================================================================
// DESKTOP AGENT SINGLETON
// ============================================================================

/**
 * Singleton Desktop Agent that wraps existing FDC3 components
 * Provides a single point of access for all FDC3 operations
 */
export class DesktopAgentSingleton {
  private static instance: DesktopAgentSingleton
  private directoryManager: AppDirectoryManager
  private initialized = false

  private constructor() {
    // Initialize directory manager (not a singleton)
    this.directoryManager = new AppDirectoryManager()
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): DesktopAgentSingleton {
    if (!this.instance) {
      this.instance = new DesktopAgentSingleton()
    }
    return this.instance
  }

  /**
   * Initialize the desktop agent with directories and configuration
   */
  async initialize(config: {
    directories?: string[]
    customApps?: DirectoryApp[]
    channels?: Array<{
      id: string
      displayMetadata: { name: string; color: string }
    }>
  }): Promise<void> {
    if (this.initialized) {
      console.log("Desktop agent already initialized")
      return
    }

    try {
      // Load app directories
      if (config.directories && config.directories.length > 0) {
        await this.directoryManager.replace(config.directories)
        console.log(`Loaded apps from ${config.directories.length} directories`)
      }

      // Add custom apps
      if (config.customApps && config.customApps.length > 0) {
        config.customApps.forEach(app => this.directoryManager.add(app))
        console.log(`Added ${config.customApps.length} custom apps`)
      }

      // TODO: Initialize channels when needed
      // For now, channels are handled separately

      this.initialized = true
      console.log("✅ Desktop Agent initialized successfully")
      console.log(`📱 Total apps available: ${this.directoryManager.allApps.length}`)
    } catch (error) {
      console.error("❌ Failed to initialize Desktop Agent:", error)
      throw error
    }
  }

  // ============================================================================
  // APP DIRECTORY ACCESS
  // ============================================================================

  /**
   * Get all apps from the directory
   */
  getDirectoryApps(): DirectoryApp[] {
    return this.directoryManager.allApps as DirectoryApp[]
  }

  /**
   * Reload directories from new sources
   */
  async reloadDirectories(urls: string[], customApps: DirectoryApp[] = []): Promise<void> {
    await this.directoryManager.replace(urls)
    customApps.forEach(app => this.directoryManager.add(app))
    console.log(`Reloaded directories: ${urls.length} sources, ${customApps.length} custom apps`)
  }

  /**
   * Add custom apps to directory
   */
  addCustomApps(apps: DirectoryApp[]): void {
    apps.forEach(app => this.directoryManager.add(app))
  }

  // ============================================================================
  // CONNECTED APP ACCESS
  // ============================================================================

  /**
   * Get all connected app instances
   */
  getConnectedApps(): AppInstance[] {
    return appInstanceRegistry.queryInstances({
      state: [States.CONNECTED, States.PENDING]
    })
  }

  /**
   * Get specific app instance by ID
   */
  getAppInstance(instanceId: string): AppInstance | undefined {
    return appInstanceRegistry.getInstance(instanceId)
  }

  /**
   * Get all apps on a specific channel
   */
  getAppsOnChannel(channelId: string): AppInstance[] {
    return appInstanceRegistry.getInstancesOnChannel(channelId)
  }

  /**
   * Get channel to apps mapping
   */
  getChannelMap(): Record<string, string[]> {
    const channelMap: Record<string, string[]> = {}
    const allApps = appInstanceRegistry.getAllInstances()

    allApps.forEach(app => {
      if (app.currentChannel) {
        if (!channelMap[app.currentChannel]) {
          channelMap[app.currentChannel] = []
        }
        channelMap[app.currentChannel].push(app.instanceId)
      }
    })

    return channelMap
  }

  // ============================================================================
  // APP LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Register a new app instance
   */
  registerAppInstance(params: {
    instanceId: string
    appId: string
    metadata?: any
    hosting?: string
  }): boolean {
    try {
      // Get app metadata from directory
      const directoryApps = this.directoryManager.retrieveAppsById(params.appId)
      const appMetadata = directoryApps.length > 0 ? directoryApps[0] : { appId: params.appId }

      appInstanceRegistry.createInstance({
        instanceId: params.instanceId,
        appId: params.appId,
        metadata: params.metadata || appMetadata,
        instanceMetadata: {
          hosting: params.hosting || "frame"
        }
      })

      console.log(`Registered app instance: ${params.instanceId} (${params.appId})`)
      return true
    } catch (error) {
      console.error(`Failed to register app instance ${params.instanceId}:`, error)
      return false
    }
  }

  /**
   * Update app instance state
   */
  updateAppInstanceState(instanceId: string, state: AppInstanceState): boolean {
    return appInstanceRegistry.updateInstanceState(instanceId, state)
  }

  /**
   * Set app instance channel
   */
  setAppInstanceChannel(instanceId: string, channelId: string | null): boolean {
    return appInstanceRegistry.setInstanceChannel(instanceId, channelId)
  }

  /**
   * Remove app instance
   */
  removeAppInstance(instanceId: string): boolean {
    return appInstanceRegistry.removeInstance(instanceId)
  }

  // ============================================================================
  // FDC3 MESSAGE PROCESSING (Transport Agnostic)
  // ============================================================================

  /**
   * Process FDC3 DACP message (transport agnostic)
   */
  async processFDC3Message(
    message: any,
    clientId: string,
    replyCallback: (response: any) => void
  ): Promise<void> {
    try {
      // Create server context for DACP processing
      const serverContext = {
        appInstanceRegistry,
        intentRegistry,
        directoryManager: this.directoryManager,
        getTabs: () => this.getChannelDefinitions(),
        // Add other methods as needed
        getInstanceDetails: (instanceId: string) => appInstanceRegistry.getInstance(instanceId),
        setInstanceDetails: (instanceId: string, details: any) => {
          // Update instance with details - this might need custom logic
          console.log(`Updating instance ${instanceId} with details:`, details)
        }
      }

      // Use existing transport-agnostic DACP processor
      await processDACPMessage(message, {
        instanceId: clientId,
        serverContext,
        fdc3Server: this, // Pass self as fdc3Server
        appInstanceRegistry,
        intentRegistry
      }, replyCallback)

    } catch (error) {
      console.error(`Failed to process FDC3 message from ${clientId}:`, error)
      replyCallback({
        type: "error",
        payload: { message: "Failed to process FDC3 message" }
      })
    }
  }

  /**
   * Initialize DACP MessagePort for a client
   */
  initializeDACPMessagePort(instanceId: string, messagePort: MessagePort): void {
    try {
      const serverContext = {
        appInstanceRegistry,
        intentRegistry,
        directoryManager: this.directoryManager,
        getTabs: () => this.getChannelDefinitions(),
        getInstanceDetails: (instanceId: string) => appInstanceRegistry.getInstance(instanceId),
        setInstanceDetails: (instanceId: string, details: any) => {
          console.log(`Updating instance ${instanceId} with details:`, details)
        }
      }

      registerDACPHandlers(messagePort, serverContext, this, instanceId)
      console.log(`DACP MessagePort initialized for instance: ${instanceId}`)
    } catch (error) {
      console.error(`Failed to initialize DACP MessagePort for ${instanceId}:`, error)
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get channel definitions (placeholder - should be configurable)
   */
  private getChannelDefinitions(): Array<{
    id: string
    displayMetadata: { name: string; color: string }
  }> {
    // Default channels - this should be configurable
    return [
      { id: "red", displayMetadata: { name: "Red", color: "#FF0000" } },
      { id: "blue", displayMetadata: { name: "Blue", color: "#0000FF" } },
      { id: "green", displayMetadata: { name: "Green", color: "#00FF00" } },
      { id: "yellow", displayMetadata: { name: "Yellow", color: "#FFFF00" } },
      { id: "orange", displayMetadata: { name: "Orange", color: "#FFA500" } },
      { id: "purple", displayMetadata: { name: "Purple", color: "#800080" } }
    ]
  }

  /**
   * Get desktop agent statistics
   */
  getStats() {
    const connectedApps = this.getConnectedApps()
    const directoryApps = this.getDirectoryApps()
    const channelMap = this.getChannelMap()
    const registryStats = appInstanceRegistry.getStats()

    return {
      initialized: this.initialized,
      directoryApps: directoryApps.length,
      connectedApps: connectedApps.length,
      activeChannels: Object.keys(channelMap).length,
      registryStats,
      channels: this.getChannelDefinitions().map(c => c.id)
    }
  }

  /**
   * Check if desktop agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }
}