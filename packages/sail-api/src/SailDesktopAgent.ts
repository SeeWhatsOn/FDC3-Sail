import type { Socket } from "socket.io"
import {
  DesktopAgent,
  type DesktopAgentConfig,
  AppInstanceRegistry,
  IntentRegistry,
  AppDirectoryManager,
  type Transport,
} from "@finos/fdc3-sail-desktop-agent"
import { SocketIOTransport } from "./adapters/socket-io-transport"
import { SailAppLauncher, type SailAppLauncherConfig } from "./adapters/SailAppLauncher"
import { MiddlewarePipeline, type Middleware } from "./middleware"
export type { Middleware }

/**
 * Configuration for Sail Desktop Agent
 */
export interface SailDesktopAgentConfig {
  /**
   * Transport implementation for message communication.
   * Can be provided directly (recommended) or via legacy 'socket' property.
   */
  transport?: Transport

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
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Sail Desktop Agent - environment-specific wrapper.
 *
 * This class wraps the pure DesktopAgent with Sail-specific features:
 * - Transport-agnostic (works with Socket.IO, InMemory, etc.)
 * - Browser-based app launching
 * - Middleware for logging, auth, metrics
 * - Connection lifecycle management
 *
 * @example
 * ```typescript
 * // With Socket.IO (Client/Server)
 * const agent = new SailDesktopAgent({
 *   transport: new SocketIOTransport(socket)
 * })
 *
 * // With InMemory (Browser/Test)
 * const agent = new SailDesktopAgent({
 *   transport: new InMemoryTransport()
 * })
 * ```
 */
export class SailDesktopAgent {
  private agent: DesktopAgent
  private transport: Transport
  private pipeline: MiddlewarePipeline<unknown>
  private debug: boolean

  constructor(config: SailDesktopAgentConfig) {
    this.debug = config.debug ?? false
    this.pipeline = new MiddlewarePipeline()

    // Resolve transport
    if (config.transport) {
      this.transport = config.transport
    } else if (config.socket) {
      this.transport = new SocketIOTransport(config.socket)
    } else {
      throw new Error("SailDesktopAgent requires either 'transport' or 'socket' in config")
    }

    // Create app launcher if config provided
    const appLauncher = config.appLauncher ? new SailAppLauncher(config.appLauncher) : undefined

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
   * Add middleware to the message processing pipeline.
   * @param middleware The middleware function to add
   */
  use(middleware: Middleware<unknown>): this {
    this.pipeline.use(middleware)
    return this
  }

  /**
   * Start the Desktop Agent.
   * Sets up message handlers with middleware wrapping.
   */
  start(): void {
    // Wrap the transport's onMessage to inject middleware
    const originalOnMessage = this.transport.onMessage.bind(this.transport)

    // Override onMessage to apply middleware
    this.transport.onMessage = (handler: (msg: unknown) => Promise<void> | void) => {
      originalOnMessage(async (message: unknown) => {
        try {
          // Execute middleware pipeline
          await this.pipeline.execute({ message }, async ctx => {
            // Final step: Call original handler (routes to DesktopAgent)
            await handler(ctx.message)
          })
        } catch (error) {
          console.error("[SailDesktopAgent] Error processing message:", error)
          // We don't re-throw here to prevent crashing the socket connection,
          // but middleware should handle errors if needed.
        }
      })
    }

    // Start the agent (will call our wrapped onMessage)
    this.agent.start()

    if (this.debug) {
      console.log("[SailDesktopAgent] Started", {
        instanceId: this.transport.getInstanceId(),
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
  getTransport(): Transport {
    return this.transport
  }
}
