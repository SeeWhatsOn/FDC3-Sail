/**
 * SailPlatform - Main entry point for Sail Platform SDK
 *
 * Provides a unified, namespaced API for:
 * - FDC3 Desktop Agent operations
 * - Sail platform features (workspaces, layouts, config)
 * - UI integration via injectable interfaces
 */

import {
  DesktopAgent,
  type DesktopAgentConfig,
  type AppLauncher,
  type DirectoryApp,
  type Transport,
} from "@finos/sail-desktop-agent"
import {
  WCPConnector,
  type AppConnectionMetadata,
} from "@finos/sail-desktop-agent/browser"
import { createInMemoryTransportPair } from "@finos/sail-desktop-agent/transports"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { v4 as uuidv4 } from "uuid"

import type { IntentResolver, IntentResolutionRequest } from "./interfaces/intent-resolver"
import type { ChannelSelector } from "./interfaces/channel-selector"
import { SailPlatformClient, type SailPlatformClientConfig } from "./client/sail-platform-client"

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for SailPlatform
 */
export interface SailPlatformConfig {
  // ===== UI Interfaces (injectable) =====

  /**
   * App launcher implementation for opening FDC3 applications.
   * REQUIRED - must be provided to launch apps.
   */
  appLauncher: AppLauncher

  /**
   * Intent resolver implementation for handling intent resolution UI.
   * OPTIONAL - if not provided, first handler is auto-selected.
   */
  intentResolver?: IntentResolver

  /**
   * Channel selector implementation for handling channel selection UI.
   * OPTIONAL - if not provided, channel selection is handled by apps.
   */
  channelSelector?: ChannelSelector

  // ===== Event Callbacks =====

  /**
   * Called when an app successfully connects via WCP.
   */
  onAppConnected?: (metadata: AppConnectionMetadata) => void

  /**
   * Called when an app disconnects.
   */
  onAppDisconnected?: (instanceId: string) => void

  /**
   * Called when an app changes channel.
   */
  onChannelChanged?: (instanceId: string, channelId: string | null) => void

  /**
   * Called when WCP handshake fails.
   */
  onHandshakeFailed?: (error: Error, instanceId?: string) => void

  // ===== Data =====

  /**
   * Initial apps to load into the directory.
   */
  apps?: DirectoryApp[]

  /**
   * Custom user channels (defaults to standard FDC3 channels).
   */
  userChannels?: BrowserTypes.Channel[]

  // ===== Storage =====

  /**
   * Configuration for platform storage (workspaces, layouts, config).
   * Defaults to localStorage.
   */
  storage?: SailPlatformClientConfig

  // ===== Options =====

  /**
   * Enable debug logging.
   */
  debug?: boolean
}

// ============================================================================
// NAMESPACED API TYPES
// ============================================================================

/**
 * Workspaces namespace API
 */
export interface WorkspacesApi {
  list(): Promise<unknown[]>
  get(workspaceId: string): Promise<unknown>
  create(name: string, initialLayout?: unknown): Promise<unknown>
  delete(workspaceId: string): Promise<boolean>
}

/**
 * Layouts namespace API
 */
export interface LayoutsApi {
  get(workspaceId: string): Promise<unknown>
  save(workspaceId: string, layout: unknown): Promise<boolean>
}

/**
 * Config namespace API
 */
export interface ConfigApi {
  get(): Promise<unknown>
  update(config: unknown): Promise<boolean>
}

// ============================================================================
// SAIL PLATFORM CLASS
// ============================================================================

/**
 * SailPlatform - Unified platform SDK for Sail
 *
 * @example
 * ```typescript
 * const platform = new SailPlatform({
 *   appLauncher: myAppLauncher,
 *   intentResolver: myIntentResolver,
 *   onAppConnected: (metadata) => console.log('Connected:', metadata.appId),
 *   apps: directoryApps,
 * })
 *
 * await platform.start()
 *
 * // Access desktop agent
 * platform.agent
 * platform.connector
 *
 * // Access platform features
 * await platform.workspaces.list()
 * await platform.layouts.save(workspaceId, layout)
 * await platform.config.get()
 *
 * await platform.stop()
 * ```
 */
export class SailPlatform {
  private readonly config: SailPlatformConfig
  private platformClient: SailPlatformClient
  private started = false

  // Desktop Agent components (created on start)
  private _desktopAgent: DesktopAgent | null = null
  private _wcpConnector: WCPConnector | null = null
  private _connectorTransport: Transport | null = null

  // Namespaced APIs (initialized in constructor)
  public readonly workspaces: WorkspacesApi
  public readonly layouts: LayoutsApi
  public readonly sailConfig: ConfigApi // Renamed to avoid conflict with config property

  constructor(config: SailPlatformConfig) {
    this.config = config
    this.platformClient = new SailPlatformClient(config.storage)

    // Initialize namespaced APIs
    this.workspaces = this.createWorkspacesApi()
    this.layouts = this.createLayoutsApi()
    this.sailConfig = this.createConfigApi()
  }

  // ===== Lifecycle =====

  /**
   * Start the platform and desktop agent.
   */
  start(): void {
    if (this.started) {
      throw new Error("SailPlatform already started")
    }

    // Create in-memory transport pair for Desktop Agent ↔ WCP Connector communication
    const [daTransport, connectorTransport] = createInMemoryTransportPair()
    this._connectorTransport = connectorTransport

    // Create WCP Connector first (so we can reference its methods for intent resolution)
    this._wcpConnector = new WCPConnector(connectorTransport, {
      // Sail controls UI externally (no injected iframes)
      getIntentResolverUrl: () => false,
      getChannelSelectorUrl: () => false,
      fdc3Version: "2.2",
    })

    // Build Desktop Agent configuration
    const daConfig: DesktopAgentConfig = {
      transport: daTransport,
      appLauncher: this.config.appLauncher,
      userChannels: this.config.userChannels,
      // Wire intent resolution to WCPConnector for UI-based resolution
      requestIntentResolution: request => this._wcpConnector!.requestIntentResolution(request),
    }

    // Create Desktop Agent
    this._desktopAgent = new DesktopAgent(daConfig)

    // Add initial apps to directory if provided
    if (this.config.apps && this.config.apps.length > 0) {
      const appDirectory = this._desktopAgent.getAppDirectory()
      for (const app of this.config.apps) {
        appDirectory.add(app)
      }
    }

    // Wire up event callbacks
    this.wireEvents()

    // Wire up intent resolver if provided
    this.wireIntentResolver()

    // Start both Desktop Agent and WCP Connector
    this._desktopAgent.start()
    this._wcpConnector.start()
    this.started = true

    if (this.config.debug) {
      console.log("[SailPlatform] Started")
    }
  }

  /**
   * Stop the platform and desktop agent.
   */
  stop(): void {
    if (!this.started) {
      return
    }

    // Stop in reverse order
    this._wcpConnector?.stop()
    this._desktopAgent?.stop()

    this._wcpConnector = null
    this._desktopAgent = null
    this._connectorTransport = null
    this.started = false

    if (this.config.debug) {
      console.log("[SailPlatform] Stopped")
    }
  }

  // ===== Accessors =====

  /**
   * Get the underlying DesktopAgent instance.
   * @throws Error if platform not started
   */
  get agent(): DesktopAgent {
    this.ensureStarted()
    return this._desktopAgent!
  }

  /**
   * Get the WCP Connector for managing app connections.
   * @throws Error if platform not started
   */
  get connector(): WCPConnector {
    this.ensureStarted()
    return this._wcpConnector!
  }

  /**
   * Check if the platform is currently running.
   */
  get isRunning(): boolean {
    return this.started
  }

  // ===== Channel Management =====

  /**
   * Change an app's channel membership.
   *
   * This sends a DACP message on behalf of the app to join or leave a channel.
   * The change is confirmed via the `onChannelChanged` callback.
   *
   * @param instanceId - The app instance to change channel for
   * @param channelId - The channel ID to join, or null to leave current channel
   * @returns Promise that resolves when the channel change is confirmed
   */
  async changeAppChannel(instanceId: string, channelId: string | null): Promise<void> {
    this.ensureStarted()

    // Validate channel exists before sending DACP message
    if (channelId !== null) {
      const channels = this.getUserChannels()
      if (!channels.find(c => c.id === channelId)) {
        throw new Error(`Channel "${channelId}" does not exist`)
      }
    }

    return new Promise<void>((resolve, reject) => {
      const requestUuid = uuidv4()
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Channel change timeout for instance ${instanceId}`))
      }, 10000) // 10 second timeout

      // Listen for channel change confirmation
      const handleChannelChanged = (changedInstanceId: string, newChannelId: string | null) => {
        if (changedInstanceId === instanceId) {
          // Verify it's the channel we requested (or null for leave)
          if (newChannelId === channelId) {
            cleanup()
            resolve()
          }
        }
      }

      const cleanup = () => {
        clearTimeout(timeout)
        this._wcpConnector?.off("channelChanged", handleChannelChanged)
      }

      this._wcpConnector!.on("channelChanged", handleChannelChanged)

      // Send DACP message on behalf of the app
      if (channelId) {
        // Join channel
        const message = {
          type: "joinUserChannelRequest",
          payload: { channelId },
          meta: {
            requestUuid,
            timestamp: new Date().toISOString(),
            source: { instanceId },
          },
        }
        this._connectorTransport!.send(message)
      } else {
        // Leave channel
        const message = {
          type: "leaveCurrentChannelRequest",
          payload: {},
          meta: {
            requestUuid,
            timestamp: new Date().toISOString(),
            source: { instanceId },
          },
        }
        this._connectorTransport!.send(message)
      }
    })
  }

  /**
   * Get the available user channels.
   */
  getUserChannels(): BrowserTypes.Channel[] {
    this.ensureStarted()
    return this._desktopAgent!.getUserChannels()
  }

  // ===== Private Methods =====

  private ensureStarted(): void {
    if (!this.started || !this._desktopAgent || !this._wcpConnector || !this._connectorTransport) {
      throw new Error("SailPlatform not started. Call start() first.")
    }
  }

  /**
   * Wire up intent resolver if provided.
   * Listens to 'intentResolverNeeded' event and calls the resolver.
   */
  private wireIntentResolver(): void {
    if (!this._wcpConnector || !this.config.intentResolver) return

    const connector = this._wcpConnector
    const resolver = this.config.intentResolver

    connector.on("intentResolverNeeded", payload => {
      // Handle async intent resolution without returning the promise
      // (event handlers expect void return)
      void (async () => {
        try {
          // Adapt payload to our interface format
          // WCP's IntentHandler is AppMetadata & { isRunning }
          // Our IntentHandler has { app, intent, instanceId, isRunning }
          const request: IntentResolutionRequest = {
            requestId: payload.requestId,
            intent: payload.intent,
            context: payload.context as Context,
            handlers: payload.handlers.map(handler => ({
              app: handler,
              intent: { name: payload.intent, displayName: payload.intent },
              instanceId: handler.instanceId,
              isRunning: handler.isRunning,
            })),
          }

          // Call the resolver
          const response = await resolver.resolve(request)

          // Send selection back to connector
          // WCP expects { requestId, selectedHandler: { instanceId?, appId } | null }
          if (response) {
            connector.resolveIntentSelection({
              requestId: payload.requestId,
              selectedHandler: {
                appId: response.target.appId,
                instanceId: response.target.instanceId,
              },
            })
          } else {
            // User cancelled - resolve with null to reject the intent
            connector.resolveIntentSelection({
              requestId: payload.requestId,
              selectedHandler: null,
            })
          }
        } catch (error) {
          if (this.config.debug) {
            console.error("[SailPlatform] Intent resolution failed:", error)
          }
          // Resolve with null on error
          connector.resolveIntentSelection({
            requestId: payload.requestId,
            selectedHandler: null,
          })
        }
      })()
    })
  }

  /**
   * Wire up WCP Connector events to config callbacks.
   *
   * SailPlatform is stateless - it forwards events to consumers who manage their own state.
   * This follows the "stateless coordinator" pattern where:
   * - Desktop Agent is the source of truth
   * - SailPlatform forwards events (no internal state caching)
   * - Consumers (e.g., sail-web Zustand stores) own UI state
   */
  private wireEvents(): void {
    if (!this._wcpConnector) return

    const connector = this._wcpConnector

    if (this.config.onAppConnected) {
      connector.on("appConnected", this.config.onAppConnected)
    }

    if (this.config.onAppDisconnected) {
      connector.on("appDisconnected", this.config.onAppDisconnected)
    }

    if (this.config.onChannelChanged) {
      connector.on("channelChanged", this.config.onChannelChanged)
    }

    if (this.config.onHandshakeFailed) {
      connector.on("handshakeFailed", this.config.onHandshakeFailed)
    }
  }

  // ===== Namespaced API Factories =====

  private createWorkspacesApi(): WorkspacesApi {
    return {
      list: () => this.platformClient.getWorkspaces(),
      get: (workspaceId: string) => this.platformClient.getWorkspace(workspaceId),
      create: (name: string, initialLayout?: unknown) =>
        this.platformClient.createWorkspace(name, initialLayout),
      delete: (workspaceId: string) => this.platformClient.deleteWorkspace(workspaceId),
    }
  }

  private createLayoutsApi(): LayoutsApi {
    return {
      get: (workspaceId: string) => this.platformClient.getWorkspaceLayout(workspaceId),
      save: (workspaceId: string, layout: unknown) =>
        this.platformClient.saveWorkspaceLayout(workspaceId, layout),
    }
  }

  private createConfigApi(): ConfigApi {
    return {
      get: () => this.platformClient.getConfig(),
      update: (config: unknown) => this.platformClient.updateConfig(config),
    }
  }
}
