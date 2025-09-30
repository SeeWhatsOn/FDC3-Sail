/**
 * KISS Sail Server API
 *
 * Uses the DesktopAgentSingleton for all FDC3 operations.
 * Provides clean business logic for Sail UI operations.
 */

import { DesktopAgentSingleton } from "./DesktopAgentSingleton"
import type { AppInstance } from "@finos/fdc3-sail-desktop-agent"
import type { DirectoryApp } from "../types/sail-types"

// ============================================================================
// SIMPLE INTERFACES - Only what we actually need
// ============================================================================

export interface SailServerConfig {
  desktopAgent: DesktopAgentSingleton
}

export interface DirectoryResponse {
  apps: DirectoryApp[]
}

export interface ConnectedAppsResponse {
  apps: AppInstance[]
}

// ============================================================================
// KISS SAIL SERVER - Uses Desktop Agent Singleton
// ============================================================================

/**
 * Simple Sail Server that uses the DesktopAgentSingleton
 * All FDC3 operations are delegated to the singleton
 */
export class SailServer {
  private desktopAgent: DesktopAgentSingleton

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
      apps: this.desktopAgent.getDirectoryApps()
    }
  }

  /**
   * Reload directories from URLs
   */
  async reloadDirectories(urls: string[], customApps: DirectoryApp[] = []): Promise<void> {
    await this.desktopAgent.reloadDirectories(urls, customApps)
  }

  // ============================================================================
  // CONNECTED APPS - Simple and direct
  // ============================================================================

  /**
   * Get all connected apps
   */
  getConnectedApps(): ConnectedAppsResponse {
    return {
      apps: this.desktopAgent.getConnectedApps()
    }
  }

  /**
   * Get apps on specific channel
   */
  getAppsOnChannel(channelId: string): AppInstance[] {
    return this.desktopAgent.getAppsOnChannel(channelId)
  }

  /**
   * Get channel to apps mapping
   */
  getChannelMap(): Record<string, string[]> {
    return this.desktopAgent.getChannelMap()
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
      await this.desktopAgent.reloadDirectories(params.directories, params.customApps)
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
    const success = this.desktopAgent.registerAppInstance({
      instanceId,
      appId: params.appId,
      hosting: params.hosting
    })

    if (!success) {
      throw new Error("Failed to register app instance")
    }

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
    const instance = this.desktopAgent.getAppInstance(params.instanceId)

    if (instance && instance.state === "pending") {
      // Update to connected
      this.desktopAgent.updateAppInstanceState(params.instanceId, "connected" as any)
      return instance.instanceMetadata?.hosting || "frame"
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
      return this.desktopAgent.setAppInstanceChannel(params.instanceId, params.channel)
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
  setupEventForwarding(io: any): void {
    // Simple event forwarding - no complex abstractions
    // This could be enhanced to listen to actual FDC3 events when available

    // For now, just provide the interface for manual event triggering
    this.onAppConnected = (callback) => {
      // TODO: Hook into actual FDC3 events
      console.log("App connected callback registered")
    }

    this.onChannelChanged = (callback) => {
      // TODO: Hook into actual FDC3 events
      console.log("Channel changed callback registered")
    }
  }

  // Placeholder event methods - keep it simple
  onAppConnected(callback: (instance: AppInstance) => void): void {
    // Simple implementation
  }

  onChannelChanged(callback: (instanceId: string, channelId: string | null) => void): void {
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
          userId
        })

      case "daDirectoryListing":
        const directoryResponse = this.getDirectoryApps()
        return directoryResponse.apps

      case "daRegisterAppLaunch":
        const registerResponse = await this.registerAppLaunch({
          ...message.payload,
          userId
        })
        return registerResponse.instanceId

      case "sailClientState":
        return this.handleClientStateUpdate({
          ...message.payload,
          userId
        })

      case "appHello":
        return this.handleAppHello({
          ...message.payload,
          userId
        })

      case "sailChannelChange":
        return this.handleChannelChange({
          ...message.payload,
          userId
        })

      default:
        throw new Error(`Unknown Sail message type: ${message.type}`)
    }
  }

  /**
   * Route FDC3 messages to the desktop agent
   * This forwards FDC3 protocol messages to the actual FDC3 engine
   */
  async handleFDC3Message(
    message: any,
    sourceId: string,
    replyCallback: (response: any) => void
  ): Promise<void> {
    // Forward to desktop agent singleton for processing
    await this.desktopAgent.processFDC3Message(message, sourceId, replyCallback)
  }

  /**
   * Initialize DACP MessagePort for a client
   */
  initializeDACPMessagePort(instanceId: string, messagePort: MessagePort): void {
    this.desktopAgent.initializeDACPMessagePort(instanceId, messagePort)
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
      activeChannels: Object.keys(channelMap).length
    }
  }
}