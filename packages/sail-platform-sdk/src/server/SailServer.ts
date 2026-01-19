/**
 * KISS Sail Server API
 *
 * Uses the DesktopAgentSingleton for all FDC3 operations.
 * Provides clean business logic for Sail UI operations.
 */

import type { AppInstance, DesktopAgent, AppInstanceState } from "@finos/fdc3-sail-desktop-agent"
import type { DirectoryApp } from "../types/sail-types"
import { replaceAppDirectories } from "../utils/app-directory-loader"

// ============================================================================
// SIMPLE INTERFACES - Only what we actually need
// ============================================================================

export interface SailServerConfig {
  desktopAgent: DesktopAgent
}

export interface DirectoryResponse {
  apps: DirectoryApp[]
}

export interface ConnectedAppsResponse {
  apps: AppInstance[]
}

// ============================================================================
// KISS SAIL SERVER - Uses Desktop Agent
// ============================================================================

/**
 * Simple Sail Server that uses the DesktopAgent
 * All FDC3 operations are delegated to the agent
 */
export class SailServer {
  private desktopAgent: DesktopAgent

  constructor(config: SailServerConfig) {
    this.desktopAgent = config.desktopAgent
  }

  // ============================================================================
  // APP DIRECTORY - Simple and direct
  // ============================================================================

  /**
   * Get all apps from directory
   */
  getDirectoryApps(): DirectoryResponse {
    return {
      apps: this.desktopAgent.getAppDirectory().retrieveAllApps(),
    }
  }

  /**
   * Reload directories from URLs and/or file paths
   * Supports both RESTful endpoints (URLs) and local file paths (Node.js only)
   *
   * @param sources - Array of URLs (http/https) and/or file paths to load applications from
   * @param customApps - Optional array of custom apps to add after loading directories
   */
  async reloadDirectories(sources: string[], customApps: DirectoryApp[] = []): Promise<void> {
    const appDirectory = this.desktopAgent.getAppDirectory()
    // Use Sail SDK utility to handle both URLs and file paths
    await replaceAppDirectories(appDirectory, sources)
    // Add custom apps
    for (const app of customApps) {
      appDirectory.add(app)
    }
  }

  // ============================================================================
  // CONNECTED APPS - Simple and direct
  // ============================================================================

  /**
   * Get all connected apps
   */
  getConnectedApps(): ConnectedAppsResponse {
    return {
      apps: this.desktopAgent.getAppInstanceRegistry().getAllInstances(),
    }
  }

  /**
   * Get apps on specific channel
   */
  getAppsOnChannel(channelId: string): AppInstance[] {
    return this.desktopAgent.getAppInstanceRegistry().getInstancesOnChannel(channelId)
  }

  /**
   * Get channel to apps mapping
   */
  getChannelMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {}
    const instances = this.desktopAgent.getAppInstanceRegistry().getAllInstances()
    for (const instance of instances) {
      if (instance.currentChannel) {
        if (!map[instance.currentChannel]) {
          map[instance.currentChannel] = []
        }
        map[instance.currentChannel].push(instance.instanceId)
      }
    }
    return map
  }

  // ============================================================================
  // APP LIFECYCLE - Simple handlers
  // ============================================================================

  /**
   * Handle desktop agent hello - reload directories
   */
  async handleDesktopAgentHello(params: {
    directories: string[]
    customApps: DirectoryApp[]
    channels: any[]
    panels: any[]
    contextHistory: any
    userId: string
  }): Promise<boolean> {
    try {
      await this.reloadDirectories(params.directories, params.customApps)
      return true
    } catch (error) {
      console.error("Failed to handle desktop agent hello:", error)
      return false
    }
  }

  /**
   * Handle client state update - same as desktop agent hello
   */
  async handleClientStateUpdate(params: {
    directories: string[]
    customApps: DirectoryApp[]
    channels: any[]
    panels: any[]
    contextHistory: any
    userId: string
  }): Promise<boolean> {
    return this.handleDesktopAgentHello(params)
  }

  /**
   * Register app launch
   */
  async registerAppLaunch(params: {
    appId: string
    hosting: string
    channel: string | null
    instanceTitle: string
    userId: string
  }): Promise<{ instanceId: string }> {
    // Generate instance ID
    const instanceId = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Register with desktop agent
    // We need to fetch metadata first or create a placeholder
    const apps = this.desktopAgent.getAppDirectory().retrieveAllApps()
    const app = apps.find(a => a.appId === params.appId)
    if (!app) {
      throw new Error(`App ${params.appId} not found in directory`)
    }

    this.desktopAgent.getAppInstanceRegistry().createInstance({
      instanceId,
      appId: params.appId,
      metadata: app as any, // Cast if needed
      instanceMetadata: {
        hosting: params.hosting as any,
        title: params.instanceTitle,
      },
    })

    return { instanceId }
  }

  /**
   * Handle app hello
   */
  async handleAppHello(params: {
    instanceId: string
    appId: string
    userSessionId?: string
    userId: string
  }): Promise<string> {
    // Get the app instance from desktop agent
    const instance = this.desktopAgent.getAppInstanceRegistry().getInstance(params.instanceId)

    if (instance && instance.state === "pending") {
      // Update to connected
      this.desktopAgent
        .getAppInstanceRegistry()
        .updateInstanceState(params.instanceId, "connected" as AppInstanceState)
      return (instance.instanceMetadata?.hosting as string) || "frame"
    }

    throw new Error("Invalid instance ID")
  }

  /**
   * Handle channel change
   */
  async handleChannelChange(params: {
    instanceId: string
    channel: string | null
    userId: string
  }): Promise<boolean> {
    try {
      return this.desktopAgent
        .getAppInstanceRegistry()
        .setInstanceChannel(params.instanceId, params.channel)
    } catch (error) {
      console.error("Failed to change channel:", error)
      return false
    }
  }

  // ============================================================================
  // SIMPLE EVENT FORWARDING - No complex event forwarder class needed
  // ============================================================================

  /**
   * Set up simple event forwarding to Socket.IO
   */
  setupEventForwarding(_io: any): void {
    // Simple event forwarding - no complex abstractions
    // This could be enhanced to listen to actual FDC3 events when available

    // For now, just provide the interface for manual event triggering
    this.onAppConnected = _callback => {
      // TODO: Hook into actual FDC3 events
      console.log("App connected callback registered")
    }

    this.onChannelChanged = _callback => {
      // TODO: Hook into actual FDC3 events
      console.log("Channel changed callback registered")
    }
  }

  // Placeholder event methods - keep it simple
  onAppConnected(_callback: (instance: AppInstance) => void): void {
    // Simple implementation
  }

  onChannelChanged(_callback: (instanceId: string, channelId: string | null) => void): void {
    // Simple implementation
  }

  // ============================================================================
  // MESSAGE ROUTING - Business logic should be here, not in transport layer
  // ============================================================================

  /**
   * Route Sail messages to appropriate handlers
   * This is where business logic belongs, not in the transport layer
   */
  async handleSailMessage(message: any, userId: string): Promise<any> {
    console.log(`Handling Sail message: ${message.type} for user: ${userId}`)

    switch (message.type) {
      case "daHello":
        return this.handleDesktopAgentHello({
          ...message.payload,
          userId,
        })

      case "daDirectoryListing":
        const directoryResponse = this.getDirectoryApps()
        return directoryResponse.apps

      case "daRegisterAppLaunch":
        const registerResponse = await this.registerAppLaunch({
          ...message.payload,
          userId,
        })
        return registerResponse.instanceId

      case "sailClientState":
        return this.handleClientStateUpdate({
          ...message.payload,
          userId,
        })

      case "appHello":
        return this.handleAppHello({
          ...message.payload,
          userId,
        })

      case "sailChannelChange":
        return this.handleChannelChange({
          ...message.payload,
          userId,
        })

      default:
        throw new Error(`Unknown Sail message type: ${message.type}`)
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Get simple server stats
   */
  getStats() {
    const connectedApps = this.getConnectedApps()
    const directoryApps = this.getDirectoryApps()
    const channelMap = this.getChannelMap()

    return {
      connectedApps: connectedApps.apps.length,
      directoryApps: directoryApps.apps.length,
      activeChannels: Object.keys(channelMap).length,
    }
  }
}
