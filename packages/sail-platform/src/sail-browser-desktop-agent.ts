import { SailDesktopAgent, type SailDesktopAgentOptions } from "@finos/sail-desktop-agent"
import { wireWcp4OriginAllowlist } from "./wcp4-origin-allowlist"

/**
 * Configuration for Sail Browser Desktop Agent
 */
export interface SailBrowserDesktopAgentConfig extends Omit<
  SailDesktopAgentOptions,
  "appConnectionOptions"
> {
  /**
   * App connection options with Sail-specific defaults.
   */
  appConnectionOptions?: SailDesktopAgentOptions["appConnectionOptions"]

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
 * - Connection lifecycle management
 *
 * For host channel chrome, use {@link SailPlatform} (`changeAppChannel`, `getAppUserChannel`)
 * instead of sending raw DACP messages.
 *
 * @example
 * ```typescript
 * const desktopAgent = createSailBrowserDesktopAgent({
 *   appLauncher: myLauncher,
 *   debug: true,
 * })
 * ```
 */
export function createSailBrowserDesktopAgent(
  config?: SailBrowserDesktopAgentConfig,
): SailDesktopAgent {
  // Merge Sail-specific defaults with user config
  const appConnectionOptions: SailDesktopAgentOptions["appConnectionOptions"] = {
    // Sail-specific defaults: UI is provided by Sail parent window
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
    fdc3Version: "2.2",
    handshakeTimeout: 5000,
    ...config?.appConnectionOptions,
  }

  const desktopAgent = new SailDesktopAgent({
    ...config,
    appConnectionOptions,
  })

  if (config?.allowedOrigins !== undefined) {
    wireWcp4OriginAllowlist(desktopAgent, config.allowedOrigins, config.debug)
  }

  if (config?.debug) {
    console.log("[SailBrowserDesktopAgent] Created with Sail-specific defaults")
  }

  return desktopAgent
}
