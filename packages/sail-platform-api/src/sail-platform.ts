/**
 * SailPlatform - Main entry point for Sail Platform SDK
 *
 * Provides a unified, namespaced API for:
 * - FDC3 Desktop Agent operations
 * - Sail platform features (workspaces, layouts, config)
 * - UI integration via injectable interfaces
 */

import {
  createBrowserDesktopAgent,
  DesktopAgent,
  type AppLauncher,
  type DirectoryApp,
  type Transport,
  type SailImplementationMetadata,
  type IntentResolver,
} from "@finos/sail-desktop-agent"
import {
  getBrowserDesktopAgentSession,
  type WCPConnector,
  type AppConnectionMetadata,
} from "@finos/sail-desktop-agent/browser"
import type { BrowserTypes } from "@finos/fdc3"
import { generateUuid } from "./utils/uuid"

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

  /**
   * Override FDC3 implementation metadata (defaults to FDC3-Sail product values).
   */
  implementationMetadata?: Partial<SailImplementationMetadata>

  /**
   * Timeout (ms) to wait for a context listener after open-with-context.
   */
  openContextListenerTimeoutMs?: number

  /**
   * Heartbeat interval (ms).
   */
  heartbeatIntervalMs?: number

  /**
   * Heartbeat timeout (ms).
   */
  heartbeatTimeoutMs?: number

  /**
   * When `false`, the agent does not send DACP heartbeat events (host policy).
   *
   * @defaultValue `true`
   */
  heartbeatEnabled?: boolean

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

  // Browser Desktop Agent session (created on start via preset)
  private _desktopAgent: DesktopAgent | null = null
  private _wcpConnector: WCPConnector | null = null
  private _connectorTransport: Transport | null = null
  private _stopBrowserSession: (() => void) | null = null

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

    const desktopAgent = createBrowserDesktopAgent({
      appLauncher: this.config.appLauncher,
      apps: this.config.apps,
      userChannels: this.config.userChannels,
      implementationMetadata: this.config.implementationMetadata,
      openContextListenerTimeoutMs: this.config.openContextListenerTimeoutMs,
      heartbeatEnabled: this.config.heartbeatEnabled,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
      heartbeatTimeoutMs: this.config.heartbeatTimeoutMs,
      intentResolver: this.config.intentResolver,
      wcpOptions: {
        // Sail controls UI externally (no injected iframes)
        getIntentResolverUrl: () => false,
        getChannelSelectorUrl: () => false,
        fdc3Version: "2.2",
      },
    })

    const { wcpConnector, connectorTransport } = getBrowserDesktopAgentSession(desktopAgent)

    this._desktopAgent = desktopAgent
    this._wcpConnector = wcpConnector
    this._connectorTransport = connectorTransport
    this._stopBrowserSession = () => desktopAgent.stop()

    this.wireEvents()

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

    this._stopBrowserSession?.()

    this._wcpConnector = null
    this._desktopAgent = null
    this._connectorTransport = null
    this._stopBrowserSession = null
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
      const requestUuid = generateUuid()
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

      // Send DACP message on behalf of the app via connector transport
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

  /**
   * Read an app's current user channel from Desktop Agent state.
   *
   * Does not send DACP on behalf of the app — use for host chrome that needs
   * an authoritative read without waiting for `onChannelChanged`.
   *
   * @param instanceId - Connected app instance id
   * @returns Channel id when joined; `null` when not on a channel or instance unknown
   */
  getAppUserChannel(instanceId: string): string | null {
    this.ensureStarted()
    return this._desktopAgent!.getAppUserChannelId(instanceId)
  }

  // ===== Private Methods =====

  private ensureStarted(): void {
    if (!this.started || !this._desktopAgent || !this._wcpConnector || !this._connectorTransport) {
      throw new Error("SailPlatform not started. Call start() first.")
    }
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
