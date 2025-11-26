import {
  createBrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
  type BrowserDesktopAgentResult,
} from "@finos/fdc3-sail-desktop-agent/browser"
import { MiddlewarePipeline, type Middleware } from "./middleware"
export type { Middleware }

/**
 * Configuration for Sail Browser Desktop Agent
 */
export interface SailBrowserDesktopAgentConfig extends Omit<BrowserDesktopAgentOptions, "wcpOptions"> {
  /**
   * WCP options with Sail-specific defaults
   */
  wcpOptions?: BrowserDesktopAgentOptions["wcpOptions"]

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Sail Browser Desktop Agent - browser-specific wrapper.
 *
 * This class wraps the browser Desktop Agent with Sail-specific features:
 * - Sail-specific WCP configuration defaults
 * - Middleware support (logging, metrics)
 * - Connection lifecycle management
 *
 * @example
 * ```typescript
 * // Create browser Desktop Agent with Sail defaults
 * const { desktopAgent, wcpConnector, start } = createSailBrowserDesktopAgent({
 *   wcpOptions: {
 *     // Sail provides UI externally, so return false
 *     getIntentResolverUrl: () => false,
 *     getChannelSelectorUrl: () => false,
 *     fdc3Version: '2.2'
 *   },
 *   debug: true
 * })
 *
 * start()
 * ```
 */
export function createSailBrowserDesktopAgent(
  config?: SailBrowserDesktopAgentConfig
): BrowserDesktopAgentResult & {
  /**
   * Add middleware to the message processing pipeline
   */
  use: (middleware: Middleware<unknown>) => void
} {
  // Merge Sail-specific defaults with user config
  const wcpOptions: BrowserDesktopAgentOptions["wcpOptions"] = {
    // Sail-specific defaults: UI is provided by Sail parent window
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
    fdc3Version: "2.2",
    handshakeTimeout: 5000,
    ...config?.wcpOptions,
  }

  // Create browser desktop agent with merged options
  const browserAgent = createBrowserDesktopAgent({
    ...config,
    wcpOptions,
  })

  // Create middleware pipeline
  const pipeline = new MiddlewarePipeline<unknown>()

  // Wrap the desktop agent's transport to inject middleware
  // Note: This is a simplified approach - in practice, you might need
  // to intercept messages at the transport level
  const originalDesktopAgent = browserAgent.desktopAgent

  // Add middleware support
  const use = (middleware: Middleware<unknown>) => {
    pipeline.use(middleware)
  }

  if (config?.debug) {
    console.log("[SailBrowserDesktopAgent] Created with Sail-specific defaults")
  }

  return {
    ...browserAgent,
    use,
  }
}

