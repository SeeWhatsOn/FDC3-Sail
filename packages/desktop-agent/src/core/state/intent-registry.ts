/**
 * Intent Registry - Core FDC3 Intent Management
 *
 * Manages intent listeners, intent resolution, app-to-intent mapping,
 * and context type compatibility. Provides centralized intent routing
 * for the FDC3 desktop agent.
 */

import type { AppIdentifier, AppIntent, AppMetadata, Context, IntentMetadata } from "@finos/fdc3"

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Intent listener registration information
 */
export interface IntentListener {
  /** Unique listener identifier */
  listenerId: string

  /** Intent name being listened for */
  intentName: string

  /** Instance that registered this listener */
  instanceId: string

  /** App that owns this listener */
  appId: string

  /** Context types this listener can handle (empty = all types) */
  contextTypes: string[]

  /** Optional result type this listener produces */
  resultType?: string

  /** Registration timestamp */
  registeredAt: Date

  /** Last activity timestamp */
  lastActivity: Date

  /** Whether this listener is currently active */
  active: boolean

  /** Custom listener metadata */
  metadata?: Record<string, unknown>
}

/**
 * Intent capability definition from app directory
 */
export interface IntentCapability {
  /** Intent name */
  intentName: string

  /** App that can handle this intent */
  appId: string

  /** Context types this app can handle for this intent */
  contextTypes: string[]

  /** Result type this app produces (if any) */
  resultType?: string

  /** Display information */
  displayName?: string

  /** Custom configuration */
  customConfig?: Record<string, unknown>
}

/**
 * Intent resolution request
 */
export interface IntentResolutionRequest {
  /** Intent name to resolve */
  intent: string

  /** Context to pass to the intent handler */
  context: Context

  /** Optional target app identifier */
  target?: AppIdentifier

  /** Source app making the request */
  source: AppIdentifier

  /** Unique request identifier */
  requestId: string
}

/**
 * Intent resolution result
 */
export interface IntentResolutionResult {
  /** Request that was resolved */
  requestId: string

  /** Selected app for handling the intent */
  selectedApp: AppMetadata

  /** Selected instance (if app was already running) */
  selectedInstanceId?: string

  /** Whether a new instance was launched */
  wasLaunched: boolean

  /** Resolution timestamp */
  resolvedAt: Date
}

/**
 * Intent query filters
 */
export interface IntentQuery {
  intentName?: string
  appId?: string
  instanceId?: string
  contextType?: string
  resultType?: string
  active?: boolean
}

/**
 * Pending intent - tracks intents waiting for results
 */
export interface PendingIntent {
  /** Original request ID */
  requestId: string

  /** Intent name */
  intentName: string

  /** Context passed to the intent */
  context: Context

  /** Source app that raised the intent */
  sourceInstanceId: string

  /** Target app handling the intent */
  targetInstanceId: string

  /** Target app ID */
  targetAppId: string

  /** When the intent was raised */
  raisedAt: Date

  /** Promise resolve function for returning the result */
  resolve: (result: unknown) => void

  /** Promise reject function for errors */
  reject: (error: Error) => void

  /** Timeout handle */
  timeoutHandle?: NodeJS.Timeout
}

/**
 * App intent query filters
 */
export interface AppIntentQuery {
  appId?: string
  intentName?: string
  contextType?: string
  resultType?: string
}

// ============================================================================
// INTENT REGISTRY
// ============================================================================

/**
 * Registry for managing FDC3 intents and intent resolution
 *
 * Provides centralized management of intent listeners, intent capabilities
 * from the app directory, and intent resolution logic. Handles the complete
 * FDC3 intent workflow from registration to resolution.
 */
export class IntentRegistry {
  private listeners = new Map<string, IntentListener>()
  private capabilities = new Map<string, IntentCapability>() // key: appId:intentName

  // Indexes for efficient lookups
  private intentIndex = new Map<string, Set<string>>() // intentName -> listenerIds
  private instanceIndex = new Map<string, Set<string>>() // instanceId -> listenerIds
  private appIndex = new Map<string, Set<string>>() // appId -> listenerIds
  private contextTypeIndex = new Map<string, Set<string>>() // contextType -> listenerIds

  // App capability indexes
  private appIntentIndex = new Map<string, Set<string>>() // appId -> intentNames
  private intentCapabilityIndex = new Map<string, Set<string>>() // intentName -> appIds

  // Resolution history
  private resolutionHistory = new Map<string, IntentResolutionResult>()

  // Pending intents - tracks intents waiting for results
  private pendingIntents = new Map<string, PendingIntent>()

  // ============================================================================
  // INTENT LISTENER MANAGEMENT
  // ============================================================================

  /**
   * Registers a new intent listener
   */
  registerListener(params: {
    listenerId: string
    intentName: string
    instanceId: string
    appId: string
    contextTypes?: string[]
    resultType?: string
    active?: boolean
    metadata?: Record<string, unknown>
  }): IntentListener {
    const {
      listenerId,
      intentName,
      instanceId,
      appId,
      contextTypes = [],
      resultType,
      active = true,
      metadata,
    } = params

    if (this.listeners.has(listenerId)) {
      throw new Error(`Intent listener ${listenerId} already exists`)
    }

    const now = new Date()
    const listener: IntentListener = {
      listenerId,
      intentName,
      instanceId,
      appId,
      contextTypes,
      resultType,
      registeredAt: now,
      lastActivity: now,
      active,
      metadata,
    }

    // Store listener
    this.listeners.set(listenerId, listener)

    // Update indexes
    this.updateIntentIndex(intentName, listenerId, "add")
    this.updateInstanceIndex(instanceId, listenerId, "add")
    this.updateAppIndex(appId, listenerId, "add")

    // Index by context types (if specified)
    contextTypes.forEach(contextType => {
      this.updateContextTypeIndex(contextType, listenerId, "add")
    })

    return listener
  }

  /**
   * Unregisters an intent listener
   */
  unregisterListener(listenerId: string): boolean {
    const listener = this.listeners.get(listenerId)
    if (!listener) {
      return false
    }

    // Clean up indexes
    this.updateIntentIndex(listener.intentName, listenerId, "remove")
    this.updateInstanceIndex(listener.instanceId, listenerId, "remove")
    this.updateAppIndex(listener.appId, listenerId, "remove")

    listener.contextTypes.forEach(contextType => {
      this.updateContextTypeIndex(contextType, listenerId, "remove")
    })

    // Remove listener
    this.listeners.delete(listenerId)

    return true
  }

  /**
   * Gets an intent listener by ID
   */
  getListener(listenerId: string): IntentListener | undefined {
    return this.listeners.get(listenerId)
  }

  /**
   * Gets all intent listeners
   */
  getAllListeners(): IntentListener[] {
    return Array.from(this.listeners.values())
  }

  /**
   * Queries intent listeners with filters
   */
  queryListeners(query: IntentQuery = {}): IntentListener[] {
    let listeners = this.getAllListeners()

    // Filter by intent name
    if (query.intentName !== undefined) {
      listeners = listeners.filter(l => l.intentName === query.intentName)
    }

    // Filter by app ID
    if (query.appId !== undefined) {
      listeners = listeners.filter(l => l.appId === query.appId)
    }

    // Filter by instance ID
    if (query.instanceId !== undefined) {
      listeners = listeners.filter(l => l.instanceId === query.instanceId)
    }

    // Filter by context type support
    if (query.contextType !== undefined) {
      listeners = listeners.filter(
        l =>
          l.contextTypes.length === 0 || // Accepts all context types
          l.contextTypes.includes(query.contextType!) ||
          l.contextTypes.includes("*") // Wildcard support
      )
    }

    // Filter by result type
    if (query.resultType !== undefined) {
      listeners = listeners.filter(l => l.resultType === query.resultType)
    }

    // Filter by active status
    if (query.active !== undefined) {
      listeners = listeners.filter(l => l.active === query.active)
    }

    // Safety check: Remove any listeners whose instanceId is no longer in the instance index
    // This prevents zombie listeners from appearing if cleanup didn't complete properly
    listeners = listeners.filter(listener => {
      const instanceListeners = this.instanceIndex.get(listener.instanceId)
      const exists = instanceListeners?.has(listener.listenerId) ?? false
      if (!exists && listener.active) {
        // Log warning if we find an orphaned active listener
        console.warn(
          `[IntentRegistry] Found orphaned active listener ${listener.listenerId} for instance ${listener.instanceId}, removing from query results`
        )
      }
      return exists
    })

    return listeners
  }

  /**
   * Updates listener activity timestamp
   */
  updateListenerActivity(listenerId: string): boolean {
    const listener = this.listeners.get(listenerId)
    if (!listener) {
      return false
    }

    listener.lastActivity = new Date()
    return true
  }

  /**
   * Sets listener active status
   */
  setListenerActive(listenerId: string, active: boolean): boolean {
    const listener = this.listeners.get(listenerId)
    if (!listener) {
      return false
    }

    listener.active = active
    listener.lastActivity = new Date()
    return true
  }

  /**
   * Removes all listeners for a specific instance
   */
  removeInstanceListeners(instanceId: string): number {
    const listenerIds = this.instanceIndex.get(instanceId) || new Set()
    const removedCount = listenerIds.size

    if (removedCount > 0) {
      console.log(
        `[IntentRegistry] Removing ${removedCount} intent listener(s) for instance ${instanceId}`
      )
    }

    Array.from(listenerIds).forEach(listenerId => {
      this.unregisterListener(listenerId)
    })

    // Clear the instance index entry after removing all listeners
    this.instanceIndex.delete(instanceId)

    return removedCount
  }

  // ============================================================================
  // APP CAPABILITY MANAGEMENT
  // ============================================================================

  /**
   * Registers intent capabilities from app directory
   */
  registerAppCapabilities(appId: string, intents: Record<string, IntentCapability>): void {
    // Remove existing capabilities for this app
    this.removeAppCapabilities(appId)

    // Add new capabilities
    Object.values(intents).forEach(capability => {
      const key = `${appId}:${capability.intentName}`
      this.capabilities.set(key, { ...capability, appId })

      // Update indexes
      this.updateAppIntentIndex(appId, capability.intentName, "add")
      this.updateIntentCapabilityIndex(capability.intentName, appId, "add")
    })
  }

  /**
   * Removes all capabilities for an app
   */
  removeAppCapabilities(appId: string): void {
    const intentNames = this.appIntentIndex.get(appId) || new Set()

    intentNames.forEach(intentName => {
      const key = `${appId}:${intentName}`
      this.capabilities.delete(key)
      this.updateIntentCapabilityIndex(intentName, appId, "remove")
    })

    this.appIntentIndex.delete(appId)
  }

  /**
   * Gets app capabilities for a specific intent
   */
  getAppCapability(appId: string, intentName: string): IntentCapability | undefined {
    const key = `${appId}:${intentName}`
    return this.capabilities.get(key)
  }

  /**
   * Gets all capabilities for an app
   */
  getAppCapabilities(appId: string): IntentCapability[] {
    const intentNames = this.appIntentIndex.get(appId) || new Set()
    return Array.from(intentNames)
      .map(intentName => this.getAppCapability(appId, intentName))
      .filter((capability): capability is IntentCapability => capability !== undefined)
  }

  /**
   * Gets all apps that can handle a specific intent
   */
  getAppsForIntent(intentName: string): IntentCapability[] {
    const appIds = this.intentCapabilityIndex.get(intentName) || new Set()
    return Array.from(appIds)
      .map(appId => this.getAppCapability(appId, intentName))
      .filter((capability): capability is IntentCapability => capability !== undefined)
  }

  // ============================================================================
  // INTENT RESOLUTION
  // ============================================================================

  /**
   * Resolves an intent request, finding and launching apps if necessary.
   * This is a placeholder for the logic being moved from sailAppInstanceManager.
   */
  async resolveIntent(request: IntentResolutionRequest): Promise<unknown> {
    // TODO: Implement the logic from sailAppInstanceManager.narrowIntents here.
    // This will involve:
    // 1. Finding compatible handlers (findIntentHandlers).
    // 2. If one handler, returning it.
    // 3. If multiple handlers, calling a UI resolver function passed in during initialization.
    // 4. If no handlers, deciding whether to launch a new app.
    console.log("IntentRegistry.resolveIntent called with:", request)
    return Promise.resolve({} as unknown)
  }

  /**
   * Finds available handlers for an intent resolution request
   */
  findIntentHandlers(request: IntentResolutionRequest): {
    runningListeners: IntentListener[]
    availableApps: IntentCapability[]
    compatibleApps: (IntentListener | IntentCapability)[]
  } {
    const { intent, context, target, source } = request

    // Get running listeners for this intent
    let runningListeners = this.queryListeners({
      intentName: intent,
      contextType: context.type,
      active: true,
    })

    // Get app capabilities for this intent
    let availableApps = this.getAppsForIntent(intent)

    // Filter out the source instance from running listeners - prevent sending intent to the same instance
    // But allow launching a new instance of the same app (availableApps should not be filtered by appId)
    if (source?.instanceId) {
      runningListeners = runningListeners.filter(
        listener => listener?.instanceId !== source.instanceId
      )
    }

    // Filter by target if specified
    if (target?.appId) {
      runningListeners = runningListeners.filter(listener => listener?.appId === target.appId)
      availableApps = availableApps.filter(capability => capability?.appId === target.appId)
    }

    // Filter by context type compatibility
    runningListeners = runningListeners.filter(l =>
      this.isContextTypeCompatible(l.contextTypes, context.type)
    )

    availableApps = availableApps.filter(c =>
      this.isContextTypeCompatible(c.contextTypes, context.type)
    )

    // Combine and deduplicate (prefer running listeners)
    const runningAppIds = new Set(runningListeners.map(l => l.appId))
    const compatibleApps: (IntentListener | IntentCapability)[] = [
      ...runningListeners,
      ...availableApps.filter(app => !runningAppIds.has(app.appId)),
    ]

    return {
      runningListeners,
      availableApps,
      compatibleApps,
    }
  }

  /**
   * Creates AppIntent objects for FDC3 API responses
   */
  createAppIntents(intentName: string, contextType?: string): AppIntent[] {
    const capabilities = contextType
      ? this.getAppsForIntent(intentName).filter(c =>
          this.isContextTypeCompatible(c.contextTypes, contextType)
        )
      : this.getAppsForIntent(intentName)

    // Group by app and create AppIntent objects
    const appIntentsMap = new Map<string, AppIntent>()

    capabilities.forEach(capability => {
      if (!appIntentsMap.has(capability.appId)) {
        appIntentsMap.set(capability.appId, {
          intent: {
            name: intentName,
            displayName: capability.displayName || intentName,
          },
          apps: [],
        })
      }

      // Note: In a real implementation, you'd need to provide full AppMetadata
      // This would typically come from the AppDirectoryManager
      const appMetadata: AppMetadata = {
        appId: capability.appId,
        name: capability.appId, // Placeholder - should come from directory
        version: "1.0.0", // Placeholder
      }

      appIntentsMap.get(capability.appId)!.apps.push(appMetadata)
    })

    return Array.from(appIntentsMap.values())
  }

  /**
   * Records an intent resolution result
   */
  recordResolution(result: IntentResolutionResult): void {
    this.resolutionHistory.set(result.requestId, result)
  }

  /**
   * Gets resolution history
   */
  getResolution(requestId: string): IntentResolutionResult | undefined {
    return this.resolutionHistory.get(requestId)
  }

  /**
   * Gets all resolution history
   */
  getResolutionHistory(): IntentResolutionResult[] {
    return Array.from(this.resolutionHistory.values())
  }

  // ============================================================================
  // PENDING INTENT MANAGEMENT
  // ============================================================================

  /**
   * Registers a pending intent waiting for result
   */
  registerPendingIntent(params: {
    requestId: string
    intentName: string
    context: Context
    sourceInstanceId: string
    targetInstanceId: string
    targetAppId: string
    timeoutMs?: number
  }): Promise<unknown> {
    const {
      requestId,
      intentName,
      context,
      sourceInstanceId,
      targetInstanceId,
      targetAppId,
      timeoutMs = 30000,
    } = params

    if (this.pendingIntents.has(requestId)) {
      throw new Error(`Pending intent ${requestId} already exists`)
    }

    return new Promise((resolve, reject) => {
      const pendingIntent: PendingIntent = {
        requestId,
        intentName,
        context,
        sourceInstanceId,
        targetInstanceId,
        targetAppId,
        raisedAt: new Date(),
        resolve,
        reject,
      }

      // Set timeout
      if (timeoutMs > 0) {
        pendingIntent.timeoutHandle = setTimeout(() => {
          this.pendingIntents.delete(requestId)
          reject(new Error(`Intent ${intentName} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }

      this.pendingIntents.set(requestId, pendingIntent)
    })
  }

  /**
   * Resolves a pending intent with a result
   */
  resolvePendingIntent(requestId: string, result: unknown): boolean {
    const pendingIntent = this.pendingIntents.get(requestId)
    if (!pendingIntent) {
      return false
    }

    // Clear timeout
    if (pendingIntent.timeoutHandle) {
      clearTimeout(pendingIntent.timeoutHandle)
    }

    // Resolve the promise
    pendingIntent.resolve(result)

    // Remove from pending
    this.pendingIntents.delete(requestId)

    return true
  }

  /**
   * Rejects a pending intent with an error
   */
  rejectPendingIntent(requestId: string, error: Error): boolean {
    const pendingIntent = this.pendingIntents.get(requestId)
    if (!pendingIntent) {
      return false
    }

    // Clear timeout
    if (pendingIntent.timeoutHandle) {
      clearTimeout(pendingIntent.timeoutHandle)
    }

    // Reject the promise
    pendingIntent.reject(error)

    // Remove from pending
    this.pendingIntents.delete(requestId)

    return true
  }

  /**
   * Gets a pending intent by request ID
   */
  getPendingIntent(requestId: string): PendingIntent | undefined {
    return this.pendingIntents.get(requestId)
  }

  /**
   * Gets all pending intents for an instance
   */
  getPendingIntentsForInstance(instanceId: string): PendingIntent[] {
    return Array.from(this.pendingIntents.values()).filter(
      intent => intent.sourceInstanceId === instanceId || intent.targetInstanceId === instanceId
    )
  }

  /**
   * Cancels all pending intents for an instance (when app disconnects)
   */
  cancelPendingIntentsForInstance(instanceId: string): number {
    const pendingIntents = this.getPendingIntentsForInstance(instanceId)

    pendingIntents.forEach(intent => {
      this.rejectPendingIntent(intent.requestId, new Error("App disconnected"))
    })

    return pendingIntents.length
  }

  // ============================================================================
  // QUERY AND DISCOVERY
  // ============================================================================

  /**
   * Gets all available intent names
   */
  getAvailableIntents(): string[] {
    const intentNames = new Set<string>()

    // Add from running listeners
    this.listeners.forEach(listener => {
      if (listener.active) {
        intentNames.add(listener.intentName)
      }
    })

    // Add from app capabilities
    this.capabilities.forEach(capability => {
      intentNames.add(capability.intentName)
    })

    return Array.from(intentNames).sort()
  }

  /**
   * Gets intent metadata for discovery
   */
  getIntentMetadata(intentName: string): IntentMetadata | undefined {
    const capabilities = this.getAppsForIntent(intentName)
    const listeners = this.queryListeners({ intentName, active: true })

    if (capabilities.length === 0 && listeners.length === 0) {
      return undefined
    }

    // Collect all context types supported by this intent
    const contextTypes = new Set<string>()

    capabilities.forEach(cap => {
      cap.contextTypes.forEach(type => contextTypes.add(type))
    })

    listeners.forEach(listener => {
      if (listener.contextTypes.length === 0) {
        contextTypes.add("*") // Accepts any context
      } else {
        listener.contextTypes.forEach(type => contextTypes.add(type))
      }
    })

    return {
      name: intentName,
      displayName: capabilities[0]?.displayName || intentName,
    }
  }

  /**
   * Finds intents that can handle a specific context type
   */
  findIntentsByContext(contextType: string): IntentMetadata[] {
    const intentNames = new Set<string>()

    // Check running listeners
    this.listeners.forEach(listener => {
      if (listener.active && this.isContextTypeCompatible(listener.contextTypes, contextType)) {
        intentNames.add(listener.intentName)
      }
    })

    // Check app capabilities
    this.capabilities.forEach(capability => {
      if (this.isContextTypeCompatible(capability.contextTypes, contextType)) {
        intentNames.add(capability.intentName)
      }
    })

    return Array.from(intentNames)
      .map(intentName => this.getIntentMetadata(intentName))
      .filter((metadata): metadata is IntentMetadata => metadata !== undefined)
  }

  // ============================================================================
  // STATISTICS AND UTILITIES
  // ============================================================================

  /**
   * Gets registry statistics
   */
  getStats() {
    const listeners = this.getAllListeners()
    const activeListeners = listeners.filter(l => l.active)

    return {
      totalListeners: listeners.length,
      activeListeners: activeListeners.length,
      uniqueIntents: this.intentIndex.size,
      uniqueApps: this.appIndex.size,
      appCapabilities: this.capabilities.size,
      resolutionHistory: this.resolutionHistory.size,
      intentBreakdown: this.getIntentBreakdown(),
      appBreakdown: this.getAppBreakdown(),
    }
  }

  /**
   * Clears all data (for testing)
   */
  clear(): void {
    // Cancel all pending intents first
    this.pendingIntents.forEach(intent => {
      if (intent.timeoutHandle) {
        clearTimeout(intent.timeoutHandle)
      }
      intent.reject(new Error("Registry cleared"))
    })

    this.listeners.clear()
    this.capabilities.clear()
    this.intentIndex.clear()
    this.instanceIndex.clear()
    this.appIndex.clear()
    this.contextTypeIndex.clear()
    this.appIntentIndex.clear()
    this.intentCapabilityIndex.clear()
    this.resolutionHistory.clear()
    this.pendingIntents.clear()
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Checks if context type is compatible with listener/capability
   */
  private isContextTypeCompatible(supportedTypes: string[], contextType: string): boolean {
    if (supportedTypes.length === 0) {
      return true // Accepts all context types
    }

    return supportedTypes.includes(contextType) || supportedTypes.includes("*")
  }

  /**
   * Gets breakdown of listeners by intent
   */
  private getIntentBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {}

    this.intentIndex.forEach((listenerIds, intentName) => {
      breakdown[intentName] = listenerIds.size
    })

    return breakdown
  }

  /**
   * Gets breakdown of listeners by app
   */
  private getAppBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {}

    this.appIndex.forEach((listenerIds, appId) => {
      breakdown[appId] = listenerIds.size
    })

    return breakdown
  }

  /**
   * Updates intent index
   */
  private updateIntentIndex(
    intentName: string,
    listenerId: string,
    operation: "add" | "remove"
  ): void {
    if (operation === "add") {
      if (!this.intentIndex.has(intentName)) {
        this.intentIndex.set(intentName, new Set())
      }
      this.intentIndex.get(intentName)!.add(listenerId)
    } else {
      const listenerSet = this.intentIndex.get(intentName)
      if (listenerSet) {
        listenerSet.delete(listenerId)
        if (listenerSet.size === 0) {
          this.intentIndex.delete(intentName)
        }
      }
    }
  }

  /**
   * Updates instance index
   */
  private updateInstanceIndex(
    instanceId: string,
    listenerId: string,
    operation: "add" | "remove"
  ): void {
    if (operation === "add") {
      if (!this.instanceIndex.has(instanceId)) {
        this.instanceIndex.set(instanceId, new Set())
      }
      this.instanceIndex.get(instanceId)!.add(listenerId)
    } else {
      const listenerSet = this.instanceIndex.get(instanceId)
      if (listenerSet) {
        listenerSet.delete(listenerId)
        if (listenerSet.size === 0) {
          this.instanceIndex.delete(instanceId)
        }
      }
    }
  }

  /**
   * Updates app index
   */
  private updateAppIndex(appId: string, listenerId: string, operation: "add" | "remove"): void {
    if (operation === "add") {
      if (!this.appIndex.has(appId)) {
        this.appIndex.set(appId, new Set())
      }
      this.appIndex.get(appId)!.add(listenerId)
    } else {
      const listenerSet = this.appIndex.get(appId)
      if (listenerSet) {
        listenerSet.delete(listenerId)
        if (listenerSet.size === 0) {
          this.appIndex.delete(appId)
        }
      }
    }
  }

  /**
   * Updates context type index
   */
  private updateContextTypeIndex(
    contextType: string,
    listenerId: string,
    operation: "add" | "remove"
  ): void {
    if (operation === "add") {
      if (!this.contextTypeIndex.has(contextType)) {
        this.contextTypeIndex.set(contextType, new Set())
      }
      this.contextTypeIndex.get(contextType)!.add(listenerId)
    } else {
      const listenerSet = this.contextTypeIndex.get(contextType)
      if (listenerSet) {
        listenerSet.delete(listenerId)
        if (listenerSet.size === 0) {
          this.contextTypeIndex.delete(contextType)
        }
      }
    }
  }

  /**
   * Updates app intent index
   */
  private updateAppIntentIndex(
    appId: string,
    intentName: string,
    operation: "add" | "remove"
  ): void {
    if (operation === "add") {
      if (!this.appIntentIndex.has(appId)) {
        this.appIntentIndex.set(appId, new Set())
      }
      this.appIntentIndex.get(appId)!.add(intentName)
    } else {
      const intentSet = this.appIntentIndex.get(appId)
      if (intentSet) {
        intentSet.delete(intentName)
        if (intentSet.size === 0) {
          this.appIntentIndex.delete(appId)
        }
      }
    }
  }

  /**
   * Updates intent capability index
   */
  private updateIntentCapabilityIndex(
    intentName: string,
    appId: string,
    operation: "add" | "remove"
  ): void {
    if (operation === "add") {
      if (!this.intentCapabilityIndex.has(intentName)) {
        this.intentCapabilityIndex.set(intentName, new Set())
      }
      this.intentCapabilityIndex.get(intentName)!.add(appId)
    } else {
      const appSet = this.intentCapabilityIndex.get(intentName)
      if (appSet) {
        appSet.delete(appId)
        if (appSet.size === 0) {
          this.intentCapabilityIndex.delete(intentName)
        }
      }
    }
  }
}
