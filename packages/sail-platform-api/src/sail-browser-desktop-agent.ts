import {
  createBrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
  type BrowserDesktopAgentResult,
} from "@finos/sail-desktop-agent/browser"
import { MiddlewarePipeline, type Middleware } from "./middleware/middleware"
import { wireWcp4OriginAllowlist } from "./wcp4-origin-allowlist"
export type { Middleware }

/**
 * Configuration for Sail Browser Desktop Agent
 */
export interface SailBrowserDesktopAgentConfig
  extends Omit<BrowserDesktopAgentOptions, "wcpOptions"> {
  /**
   * WCP options with Sail-specific defaults.
   */
  wcpOptions?: BrowserDesktopAgentOptions["wcpOptions"]

  /**
   * Optional Sail deployment policy: origins permitted to complete WCP4 identity
   * validation. When set, connections from other `MessageEvent.origin` values receive
   * `WCP5ValidateAppIdentityFailedResponse` (FDC3-compliant rejection path).
   *
   * When **undefined** (default), no additional origin allowlist is applied — only
   * standard FDC3 WCP4 checks (origin consistency + App Directory match) apply.
   */
  allowedOrigins?: readonly string[]

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
 * For host channel chrome, use {@link SailPlatform} (`changeAppChannel`, `getAppUserChannel`)
 * instead of sending raw DACP messages.
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

  if (config?.allowedOrigins !== undefined) {
    wireWcp4OriginAllowlist(browserAgent.desktopAgent, config.allowedOrigins, config.debug)
  }

  // Create middleware pipeline for future use
  const pipeline = new MiddlewarePipeline<unknown>()

  // Add middleware support
  const use = (middleware: Middleware<unknown>) => {
    pipeline.use(middleware)
  }

  // TODO: Wire up middleware pipeline to intercept messages at the transport level
  // This will require wrapping browserAgent.desktopAgent's transport with middleware

  if (config?.debug) {
    console.log("[SailBrowserDesktopAgent] Created with Sail-specific defaults")
  }

  return {
    ...browserAgent,
    use,
  }
}
