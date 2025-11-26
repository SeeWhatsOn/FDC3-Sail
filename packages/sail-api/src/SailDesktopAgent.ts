import {
  DesktopAgent,
  type DesktopAgentConfig,
  AppInstanceRegistry,
  IntentRegistry,
  AppDirectoryManager,
  type Transport,
} from "@finos/fdc3-sail-desktop-agent"
import { SailAppLauncher, type SailAppLauncherConfig } from "./adapters/SailAppLauncher"
import { MiddlewarePipeline, type Middleware } from "./middleware"
export type { Middleware }

/**
 * Configuration for Sail Server Desktop Agent
 */
export interface SailServerDesktopAgentConfig {
  /**
   * Transport implementation for message communication.
   */
  transport: Transport

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
 * Sail Server Desktop Agent - server-side wrapper.
 *
 * This class wraps the pure DesktopAgent with Sail-specific features for server-side use:
 * - Transport-agnostic (works with Socket.IO, InMemory, etc.)
 * - Browser-based app launching
 * - Middleware for logging, auth, metrics
 * - Connection lifecycle management
 *
 * @example
 * ```typescript
 * // With Socket.IO (Server)
 * const agent = new SailServerDesktopAgent({
 *   transport: new SocketIOTransport(socket)
 * })
 *
 * // With InMemory (Test)
 * const agent = new SailServerDesktopAgent({
 *   transport: new InMemoryTransport()
 * })
 * ```
 */
export class SailServerDesktopAgent {
  private agent: DesktopAgent
  private transport: Transport
  private pipeline: MiddlewarePipeline<unknown>
  private debug: boolean
  private appDirectory?: AppDirectoryManager

  constructor(config: SailServerDesktopAgentConfig) {
    this.debug = config.debug ?? false
    this.pipeline = new MiddlewarePipeline()

    // Set transport
    this.transport = config.transport

    // Store app directory reference
    this.appDirectory = config.appDirectory

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
          console.error("[SailServerDesktopAgent] Error processing message:", error)
          // We don't re-throw here to prevent crashing the socket connection,
          // but middleware should handle errors if needed.
        }
      })
    }

    // Start the agent (will call our wrapped onMessage)
    this.agent.start()

    if (this.debug) {
      console.log("[SailServerDesktopAgent] Started", {
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
      console.log("[SailServerDesktopAgent] Stopped")
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

  /**
   * Get the app directory manager
   */
  getAppDirectory(): AppDirectoryManager | undefined {
    return this.appDirectory
  }
}
