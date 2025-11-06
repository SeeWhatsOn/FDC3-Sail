/**
 * Sail Desktop Agent
 *
 * Sail-specific wrapper around the pure FDC3 Desktop Agent.
 * Adds Sail-specific features like middleware, logging, authentication, etc.
 * Uses composition (not inheritance) to wrap the core DesktopAgent.
 */

import type { Socket } from "socket.io"
import {
  DesktopAgent,
  type DesktopAgentConfig,
  AppInstanceRegistry,
  IntentRegistry,
  AppDirectoryManager,
} from "@finos/fdc3-sail-desktop-agent"
import { SocketIOTransport } from "./adapters/SocketIOTransport"
import { SailAppLauncher, type SailAppLauncherConfig } from "./adapters/SailAppLauncher"

/**
 * Middleware function for processing messages
 */
export type MiddlewareFunction = (
  message: unknown,
  phase: "before" | "after" | "error"
) => void | Promise<void>

/**
 * Middleware configuration
 */
export interface Middleware {
  name: string
  phase: "before" | "after" | "error"
  handler: MiddlewareFunction
}

/**
 * Configuration for Sail Desktop Agent
 */
export interface SailDesktopAgentConfig {
  /**
   * Socket.IO socket for this connection
   */
  socket: Socket

  /**
   * App launcher configuration
   */
  appLauncher?: SailAppLauncherConfig

  /**
   * Optional custom registries (for testing or advanced usage)
   */
  appInstanceRegistry?: AppInstanceRegistry
  intentRegistry?: IntentRegistry
  appDirectory?: AppDirectoryManager

  /**
   * Middleware functions to apply
   */
  middleware?: Middleware[]

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Sail Desktop Agent - environment-specific wrapper.
 *
 * This class wraps the pure DesktopAgent with Sail-specific features:
 * - Socket.IO transport
 * - Browser-based app launching
 * - Middleware for logging, auth, metrics
 * - Connection lifecycle management
 *
 * @example
 * ```typescript
 * const agent = new SailDesktopAgent({
 *   socket: socket,
 *   appLauncher: {
 *     onLaunchApp: async (metadata, instanceId, context) => {
 *       // Notify UI to open app
 *     }
 *   },
 *   middleware: [loggingMiddleware, authMiddleware],
 * })
 *
 * agent.start()
 * ```
 */
export class SailDesktopAgent {
  private agent: DesktopAgent
  private transport: SocketIOTransport
  private middleware: Middleware[]
  private debug: boolean

  constructor(config: SailDesktopAgentConfig) {
    this.middleware = config.middleware ?? []
    this.debug = config.debug ?? false

    // Create Socket.IO transport
    this.transport = new SocketIOTransport(config.socket)

    // Create app launcher if config provided
    const appLauncher = config.appLauncher
      ? new SailAppLauncher(config.appLauncher)
      : undefined

    // Create pure desktop agent with injected dependencies
    const agentConfig: DesktopAgentConfig = {
      transport: this.transport,
      appLauncher,
      appInstanceRegistry: config.appInstanceRegistry,
      intentRegistry: config.intentRegistry,
      appDirectory: config.appDirectory,
    }

    this.agent = new DesktopAgent(agentConfig)
  }

  /**
   * Start the Desktop Agent.
   * Sets up message handlers with middleware wrapping.
   */
  start(): void {
    // Wrap the transport's onMessage to inject middleware
    const originalOnMessage = this.transport.onMessage.bind(this.transport)

    // Override onMessage to apply middleware
    this.transport.onMessage = (handler) => {
      originalOnMessage(async (message) => {
        try {
          // Run "before" middleware
          await this.runMiddleware(message, "before")

          // Call original handler (routes to DesktopAgent)
          await handler(message)

          // Run "after" middleware
          await this.runMiddleware(message, "after")
        } catch (error) {
          // Run "error" middleware
          await this.runMiddleware({ error, message }, "error")

          // Re-throw to let handler deal with it
          throw error
        }
      })
    }

    // Start the agent (will call our wrapped onMessage)
    this.agent.start()

    if (this.debug) {
      console.log("[SailDesktopAgent] Started", {
        instanceId: this.transport.getInstanceId(),
        middleware: this.middleware.map((m) => m.name),
      })
    }
  }

  /**
   * Stop the Desktop Agent and clean up resources.
   */
  stop(): void {
    this.agent.stop()

    if (this.debug) {
      console.log("[SailDesktopAgent] Stopped")
    }
  }

  /**
   * Get the underlying pure DesktopAgent (for testing/inspection)
   */
  getAgent(): DesktopAgent {
    return this.agent
  }

  /**
   * Get the transport (for testing/inspection)
   */
  getTransport(): SocketIOTransport {
    return this.transport
  }

  /**
   * Run middleware for a specific phase
   */
  private async runMiddleware(data: unknown, phase: "before" | "after" | "error"): Promise<void> {
    const middlewareForPhase = this.middleware.filter((m) => m.phase === phase)

    for (const mw of middlewareForPhase) {
      try {
        await mw.handler(data, phase)
      } catch (error) {
        console.error(`[SailDesktopAgent] Middleware "${mw.name}" failed:`, error)
        // Continue running other middleware
      }
    }
  }
}
