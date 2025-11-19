/**
 * App Instance Registry - Core FDC3 App Instance State Management
 *
 * Tracks all connected FDC3 app instances with their metadata, connection state,
 * and FDC3 capabilities. Provides centralized state management for the desktop agent.
 */
import type { AppMetadata } from "@finos/fdc3"
import type { Transport } from "../interfaces/transport"

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * FDC3 App Instance connection states
 */
export enum AppInstanceState {
  PENDING = "pending", // App launched but not completed FDC3 handshake
  CONNECTED = "connected", // App completed FDC3 handshake and ready
  NOT_RESPONDING = "not_responding", // App not responding to heartbeat
  DISCONNECTING = "disconnecting", // App in process of disconnecting
  TERMINATED = "terminated", // App has disconnected or been terminated
}

/**
 * Core FDC3 app instance information
 */
export interface AppInstance {
  /** Unique instance identifier */
  instanceId: string

  /** FDC3 app identifier */
  appId: string

  /** Message transport for this specific app instance connection */
  transport?: Transport

  /** App metadata from directory */
  metadata: AppMetadata

  /** Current connection state */
  state: AppInstanceState

  /** Instance creation timestamp */
  createdAt: Date

  /** Last activity timestamp for heartbeat tracking */
  lastActivity: Date

  /** Current user channel (null if not joined to any channel) */
  currentChannel: string | null

  /** Set of context types this instance listens for */
  contextListeners: Set<string>

  /** Set of intents this instance listens for */
  intentListeners: Set<string>

  /** Set of private channel IDs this instance has access to */
  privateChannels: Set<string>

  /** Instance-specific metadata */
  instanceMetadata?: {
    title?: string
    hosting?: "frame" | "tab" | "window"
    parentInstanceId?: string
    [key: string]: unknown
  }
}

/**
 * App instance creation parameters
 */
export interface CreateAppInstanceParams {
  instanceId: string
  appId: string
  metadata: AppMetadata
  instanceMetadata?: AppInstance["instanceMetadata"]
}

/**
 * App instance query filters
 */
export interface AppInstanceQuery {
  appId?: string
  state?: AppInstanceState | AppInstanceState[]
  currentChannel?: string | null
  hasContextListener?: string
  hasIntentListener?: string
  hasPrivateChannel?: string
}

// ============================================================================
// APP INSTANCE REGISTRY
// ============================================================================

/**
 * Registry for managing FDC3 app instances
 *
 * Provides centralized storage and management of all app instances connected
 * to the desktop agent. Handles instance lifecycle, state transitions, and
 * efficient querying.
 */
export class AppInstanceRegistry {
  private instances = new Map<string, AppInstance>()
  private appIdIndex = new Map<string, Set<string>>() // appId -> instanceIds
  private channelIndex = new Map<string, Set<string>>() // channelId -> instanceIds
  private contextListenerIndex = new Map<string, Set<string>>() // contextType -> instanceIds

  // ============================================================================
  // CORE INSTANCE MANAGEMENT
  // ============================================================================

  /**
   * Creates a new app instance
   */
  createInstance(params: CreateAppInstanceParams): AppInstance {
    const { instanceId, appId, metadata, instanceMetadata } = params

    if (this.instances.has(instanceId)) {
      throw new Error(`Instance ${instanceId} already exists`)
    }

    const now = new Date()
    const instance: AppInstance = {
      instanceId,
      appId,
      metadata,
      state: AppInstanceState.PENDING,
      createdAt: now,
      lastActivity: now,
      currentChannel: null,
      contextListeners: new Set(),
      intentListeners: new Set(),
      privateChannels: new Set(),
      instanceMetadata,
    }

    // Store instance
    this.instances.set(instanceId, instance)

    // Update indexes
    this.updateAppIdIndex(appId, instanceId, "add")

    return instance
  }

  /**
   * Gets an app instance by ID
   */
  getInstance(instanceId: string): AppInstance | undefined {
    return this.instances.get(instanceId)
  }

  /**
   * Gets all app instances
   */
  getAllInstances(): AppInstance[] {
    return Array.from(this.instances.values())
  }

  /**
   * Queries app instances with filters
   */
  queryInstances(query: AppInstanceQuery = {}): AppInstance[] {
    let instances = this.getAllInstances()

    // Filter by appId
    if (query.appId !== undefined) {
      instances = instances.filter(i => i.appId === query.appId)
    }

    // Filter by state
    if (query.state !== undefined) {
      const states = Array.isArray(query.state) ? query.state : [query.state]
      instances = instances.filter(i => states.includes(i.state))
    }

    // Filter by current channel
    if (query.currentChannel !== undefined) {
      instances = instances.filter(i => i.currentChannel === query.currentChannel)
    }

    // Filter by context listener
    if (query.hasContextListener !== undefined) {
      instances = instances.filter(i => i.contextListeners.has(query.hasContextListener!))
    }

    // Filter by intent listener
    if (query.hasIntentListener !== undefined) {
      instances = instances.filter(i => i.intentListeners.has(query.hasIntentListener!))
    }

    // Filter by private channel access
    if (query.hasPrivateChannel !== undefined) {
      instances = instances.filter(i => i.privateChannels.has(query.hasPrivateChannel!))
    }

    return instances
  }

  /**
   * Updates an app instance state
   */
  updateInstanceState(instanceId: string, state: AppInstanceState): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    const oldState = instance.state
    instance.state = state
    instance.lastActivity = new Date()

    // Handle state transition side effects
    this.handleStateTransition(instance, oldState, state)

    return true
  }

  /**
   * Updates instance last activity timestamp (for heartbeat tracking)
   */
  updateInstanceActivity(instanceId: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    instance.lastActivity = new Date()
    return true
  }

  /**
   * Removes an app instance and cleans up all references
   */
  removeInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    // Clean up indexes
    this.updateAppIdIndex(instance.appId, instanceId, "remove")

    if (instance.currentChannel) {
      this.updateChannelIndex(instance.currentChannel, instanceId, "remove")
    }

    instance.contextListeners.forEach(contextType => {
      this.updateContextListenerIndex(contextType, instanceId, "remove")
    })

    // Remove instance
    this.instances.delete(instanceId)

    return true
  }

  // ============================================================================
  // CHANNEL MANAGEMENT
  // ============================================================================

  /**
   * Sets the current channel for an app instance
   */
  setInstanceChannel(instanceId: string, channelId: string | null): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    // Remove from old channel index
    if (instance.currentChannel) {
      this.updateChannelIndex(instance.currentChannel, instanceId, "remove")
    }

    // Update instance
    instance.currentChannel = channelId
    instance.lastActivity = new Date()

    // Add to new channel index
    if (channelId) {
      this.updateChannelIndex(channelId, instanceId, "add")
    }

    return true
  }

  /**
   * Gets all instances on a specific channel
   */
  getInstancesOnChannel(channelId: string): AppInstance[] {
    const instanceIds = this.channelIndex.get(channelId) || new Set()
    return Array.from(instanceIds)
      .map(id => this.instances.get(id))
      .filter((instance): instance is AppInstance => instance !== undefined)
  }

  // ============================================================================
  // CONTEXT LISTENER MANAGEMENT
  // ============================================================================

  /**
   * Adds a context listener for an app instance
   */
  addContextListener(instanceId: string, contextType: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    instance.contextListeners.add(contextType)
    instance.lastActivity = new Date()
    this.updateContextListenerIndex(contextType, instanceId, "add")

    return true
  }

  /**
   * Removes a context listener for an app instance
   */
  removeContextListener(instanceId: string, contextType: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    const removed = instance.contextListeners.delete(contextType)
    if (removed) {
      instance.lastActivity = new Date()
      this.updateContextListenerIndex(contextType, instanceId, "remove")
    }

    return removed
  }

  /**
   * Gets all instances listening for a specific context type
   */
  getContextListeners(contextType: string): AppInstance[] {
    const instanceIds = this.contextListenerIndex.get(contextType) || new Set()
    return Array.from(instanceIds)
      .map(id => this.instances.get(id))
      .filter((instance): instance is AppInstance => instance !== undefined)
  }

  // ============================================================================
  // INTENT LISTENER MANAGEMENT
  // ============================================================================

  /**
   * Adds an intent listener for an app instance
   */
  addIntentListener(instanceId: string, intentName: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    instance.intentListeners.add(intentName)
    instance.lastActivity = new Date()

    return true
  }

  /**
   * Removes an intent listener for an app instance
   */
  removeIntentListener(instanceId: string, intentName: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    const removed = instance.intentListeners.delete(intentName)
    if (removed) {
      instance.lastActivity = new Date()
    }

    return removed
  }

  /**
   * Gets all instances listening for a specific intent
   */
  getIntentListeners(intentName: string): AppInstance[] {
    return this.getAllInstances().filter(instance => instance.intentListeners.has(intentName))
  }

  // ============================================================================
  // PRIVATE CHANNEL MANAGEMENT
  // ============================================================================

  /**
   * Grants an app instance access to a private channel
   */
  addPrivateChannelAccess(instanceId: string, channelId: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    instance.privateChannels.add(channelId)
    instance.lastActivity = new Date()
    return true
  }

  /**
   * Revokes an app instance's access to a private channel
   */
  removePrivateChannelAccess(instanceId: string, channelId: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return false
    }

    const removed = instance.privateChannels.delete(channelId)
    if (removed) {
      instance.lastActivity = new Date()
    }

    return removed
  }

  /**
   * Gets all instances with access to a specific private channel
   */
  getPrivateChannelInstances(channelId: string): AppInstance[] {
    return this.getAllInstances().filter(instance => instance.privateChannels.has(channelId))
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Gets statistics about the registry
   */
  getStats() {
    const instances = this.getAllInstances()
    const stateCount = instances.reduce(
      (acc, instance) => {
        acc[instance.state] = (acc[instance.state] || 0) + 1
        return acc
      },
      {} as Record<AppInstanceState, number>
    )

    return {
      totalInstances: instances.length,
      stateBreakdown: stateCount,
      uniqueApps: this.appIdIndex.size,
      activeChannels: this.channelIndex.size,
      contextListenerTypes: this.contextListenerIndex.size,
    }
  }

  /**
   * Clears all instances (for testing)
   */
  clear(): void {
    this.instances.clear()
    this.appIdIndex.clear()
    this.channelIndex.clear()
    this.contextListenerIndex.clear()
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Handles state transition side effects
   */
  private handleStateTransition(
    instance: AppInstance,
    _oldState: AppInstanceState,
    newState: AppInstanceState
  ): void {
    // Clean up resources when instance becomes terminated
    if (newState === AppInstanceState.TERMINATED) {
      // Remove from channel if connected to one
      if (instance.currentChannel) {
        this.updateChannelIndex(instance.currentChannel, instance.instanceId, "remove")
        instance.currentChannel = null
      }

      // Clear all listeners
      instance.contextListeners.forEach(contextType => {
        this.updateContextListenerIndex(contextType, instance.instanceId, "remove")
      })
      instance.contextListeners.clear()
      instance.intentListeners.clear()

      // Clear private channel access
      instance.privateChannels.clear()
    }
  }

  /**
   * Updates the appId index
   */
  private updateAppIdIndex(appId: string, instanceId: string, operation: "add" | "remove"): void {
    if (operation === "add") {
      if (!this.appIdIndex.has(appId)) {
        this.appIdIndex.set(appId, new Set())
      }
      this.appIdIndex.get(appId)!.add(instanceId)
    } else {
      const instanceSet = this.appIdIndex.get(appId)
      if (instanceSet) {
        instanceSet.delete(instanceId)
        if (instanceSet.size === 0) {
          this.appIdIndex.delete(appId)
        }
      }
    }
  }

  /**
   * Updates the channel index
   */
  private updateChannelIndex(
    channelId: string,
    instanceId: string,
    operation: "add" | "remove"
  ): void {
    if (operation === "add") {
      if (!this.channelIndex.has(channelId)) {
        this.channelIndex.set(channelId, new Set())
      }
      this.channelIndex.get(channelId)!.add(instanceId)
    } else {
      const instanceSet = this.channelIndex.get(channelId)
      if (instanceSet) {
        instanceSet.delete(instanceId)
        if (instanceSet.size === 0) {
          this.channelIndex.delete(channelId)
        }
      }
    }
  }

  /**
   * Updates the context listener index
   */
  private updateContextListenerIndex(
    contextType: string,
    instanceId: string,
    operation: "add" | "remove"
  ): void {
    if (operation === "add") {
      if (!this.contextListenerIndex.has(contextType)) {
        this.contextListenerIndex.set(contextType, new Set())
      }
      this.contextListenerIndex.get(contextType)!.add(instanceId)
    } else {
      const instanceSet = this.contextListenerIndex.get(contextType)
      if (instanceSet) {
        instanceSet.delete(instanceId)
        if (instanceSet.size === 0) {
          this.contextListenerIndex.delete(contextType)
        }
      }
    }
  }
}

// Note: No singleton export - instances should be created via dependency injection
