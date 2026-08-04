/**
 * SailPlatform - Main entry point for Sail Platform SDK
 *
 * Provides a unified API for:
 * - FDC3 Desktop Agent operations
 * - Lifecycle (start/stop) and connection-event callbacks
 * - UI integration via injectable interfaces
 */

import {
  SailDesktopAgent,
  type DesktopAgent,
  type AppLauncher,
  type IntentResolverUIMethods,
  type SailDesktopAgentApps,
  type SailDesktopAgentChannels,
} from "@finos/sail-desktop-agent"
import type { AppConnectionMetadata, BrowserAppConnection } from "@finos/sail-desktop-agent"

import {
  createSailBrowserDesktopAgent,
  type SailBrowserDesktopAgentConfig,
} from "./sail-browser-desktop-agent"

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for SailPlatform
 *
 * Extends {@link SailBrowserDesktopAgentConfig} so every agent-level option
 * (`allowedOrigins`, `appDirectories`, `logger`, `logPayloadDetail`, `validation`,
 * `autoStart`, `channelChangeTimeoutMs`, `appConnectionOptions`, etc.) flows through
 * to `createSailBrowserDesktopAgent`. The three connection-lifecycle callbacks are
 * re-declared with platform-specific signatures — see {@link SailPlatform.wireEvents}.
 */
export interface SailPlatformConfig extends Omit<
  SailBrowserDesktopAgentConfig,
  "onAppConnected" | "onAppDisconnected" | "onHandshakeFailed"
> {
  /**
   * App launcher implementation for opening FDC3 applications.
   * REQUIRED - must be provided to launch apps.
   */
  appLauncher: AppLauncher

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
 * platform.start()
 *
 * // Access desktop agent
 * platform.agent
 * platform.connector
 *
 * platform.stop()
 * ```
 */
export class SailPlatform {
  private readonly config: SailPlatformConfig
  private started = false

  // Browser Desktop Agent session (created on start)
  private _desktopAgent: SailDesktopAgent | null = null
  private _browserAppConnection: BrowserAppConnection | null = null
  private _stopBrowserSession: (() => void) | null = null

  constructor(config: SailPlatformConfig) {
    this.config = config
  }

  // ===== Lifecycle =====

  /**
   * Start the platform and desktop agent.
   */
  start(): void {
    if (this.started) {
      throw new Error("SailPlatform already started")
    }

    // Platform-only fields: not part of the agent's config surface.
    // - onAppConnected/onAppDisconnected/onHandshakeFailed are wired below via
    //   wireEvents() through the agent's grouped host controllers, not passed to
    //   the constructor (passing both would fire handlers twice).
    // - onChannelChanged has no agent-config equivalent.
    const {
      onAppConnected: _onAppConnected,
      onAppDisconnected: _onAppDisconnected,
      onHandshakeFailed: _onHandshakeFailed,
      onChannelChanged: _onChannelChanged,
      ...agentConfig
    } = this.config

    const desktopAgent = createSailBrowserDesktopAgent(agentConfig)

    this._desktopAgent = desktopAgent
    this._browserAppConnection = desktopAgent.connector
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

    this._browserAppConnection = null
    this._desktopAgent = null
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
   * Grouped host channel chrome over the browser Desktop Agent preset.
   * Prefer this over raw {@link connector} `channelChanged` for host UI.
   */
  get channels(): SailDesktopAgentChannels {
    this.ensureStarted()
    return this._desktopAgent!.channels
  }

  /**
   * Grouped host intent resolver chrome over the browser Desktop Agent preset.
   */
  get intentResolver(): IntentResolverUIMethods {
    this.ensureStarted()
    return this._desktopAgent!.intentResolver
  }

  /**
   * Grouped app catalog and instance lifecycle chrome over the browser preset.
   */
  get apps(): SailDesktopAgentApps {
    this.ensureStarted()
    return this._desktopAgent!.apps
  }

  /**
   * Get the browser app connection for managing app connections.
   * Advanced integrators only — host UI should use {@link channels}, {@link intentResolver}, and {@link apps}.
   * @throws Error if platform not started
   */
  get connector(): BrowserAppConnection {
    this.ensureStarted()
    return this._browserAppConnection!
  }

  /**
   * Check if the platform is currently running.
   */
  get isRunning(): boolean {
    return this.started
  }

  // ===== Private Methods =====

  private ensureStarted(): void {
    if (!this.started || !this._desktopAgent) {
      throw new Error("SailPlatform not started. Call start() first.")
    }
  }

  /**
   * Wire grouped host controllers to config callbacks.
   *
   * SailPlatform is stateless - it forwards events to consumers who manage their own state.
   */
  private wireEvents(): void {
    if (!this._desktopAgent) return

    const { apps, channels } = this._desktopAgent

    if (this.config.onAppConnected) {
      apps.onConnect(this.config.onAppConnected)
    }

    if (this.config.onAppDisconnected) {
      apps.onDisconnect(this.config.onAppDisconnected)
    }

    if (this.config.onChannelChanged) {
      channels.onAppChannelChange(event => {
        this.config.onChannelChanged!(event.instanceId, event.channelId)
      })
    }

    if (this.config.onHandshakeFailed) {
      apps.onHandshakeFailure(event => {
        this.config.onHandshakeFailed!(event.error, event.connectionAttemptUuid)
      })
    }
  }
}
