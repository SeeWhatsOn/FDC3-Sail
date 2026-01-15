import {
  createBrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
  type BrowserDesktopAgentResult,
} from "@finos/fdc3-sail-desktop-agent/browser"
import type { Transport } from "@finos/fdc3-sail-desktop-agent"
import { MiddlewarePipeline, type Middleware } from "./middleware"
export type { Middleware }

/**
 * Configuration for Sail Browser Desktop Agent
 */
export interface SailBrowserDesktopAgentConfig
  extends Omit<BrowserDesktopAgentOptions, "wcpOptions"> {
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

  /**
   * Send a DACP message on behalf of a specific app instance.
   * This is used by external UI components (like channel selectors) that need to
   * control app instances programmatically when using Sail-controlled UI.
   *
   * According to FDC3 2.2 spec, when channelSelectorUrl is false (Sail-controlled UI),
   * the external UI should send DACP messages directly to control app channels.
   *
   * @param instanceId - The app instance ID to send the message on behalf of
   * @param message - The DACP message to send (must have type, payload, and meta with requestUuid/timestamp)
   */
  sendDACPMessageOnBehalfOf: (instanceId: string, message: unknown) => void
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

  // Create middleware pipeline for future use
  const pipeline = new MiddlewarePipeline<unknown>()

  // Add middleware support
  const use = (middleware: Middleware<unknown>) => {
    pipeline.use(middleware)
  }

  // TODO: Wire up middleware pipeline to intercept messages at the transport level
  // This will require wrapping browserAgent.desktopAgent's transport with middleware

  /**
   * Send a DACP message on behalf of a specific app instance.
   * This accesses the transport through the desktop agent's internal structure.
   * We need to do this because the transport is not exposed by createBrowserDesktopAgent.
   * TODO: Explore if we need to add this mechanism to the desktop agent transport layer in the future.
   */
  const sendDACPMessageOnBehalfOf = (instanceId: string, message: unknown): void => {
    // Ensure message has proper structure
    const messageObj = message as Record<string, unknown>
    if (!messageObj.type || !messageObj.payload) {
      throw new Error("Message must have type and payload")
    }

    // Verify instance exists
    if (!browserAgent.wcpConnector.getConnection(instanceId)) {
      throw new Error(`Instance ${instanceId} not found`)
    }

    // Access the desktop agent's handleMessage method directly.
    // Since we're in the same process (browser), we can bypass the transport layer
    // and call handleMessage directly. This is the correct approach for Sail-specific
    // functionality that needs to send DACP messages on behalf of app instances.
    //TODO: use the transport method to send the message in the future
    const desktopAgent = browserAgent.desktopAgent as unknown as {
      transport: Transport
      handleMessage: (message: unknown) => Promise<void>
    }

    if (!desktopAgent.transport || !desktopAgent.handleMessage) {
      throw new Error("Desktop Agent not properly initialized")
    }

    // Enrich message with source metadata (same pattern as WCP connector's bridgeTransports)
    const enrichedMessage = {
      ...messageObj,
      meta: {
        ...(messageObj.meta as Record<string, unknown> | undefined),
        source: {
          ...((messageObj.meta as Record<string, unknown> | undefined)?.source as
            | Record<string, unknown>
            | undefined),
          instanceId,
        },
      },
    }

    // Call the desktop agent's handleMessage directly.
    // This bypasses the transport layer since we're in the same process.
    // This is acceptable for Sail-specific functionality in sail-api.
    // The desktop agent will process the message and route it to the appropriate handler.
    if (config?.debug) {
      console.log("[SailBrowserDesktopAgent] Sending DACP message on behalf of instance", {
        instanceId,
        messageType: messageObj.type,
        enrichedMessage,
      })
    }
    void desktopAgent.handleMessage(enrichedMessage)
  }

  if (config?.debug) {
    console.log("[SailBrowserDesktopAgent] Created with Sail-specific defaults")
  }

  return {
    ...browserAgent,
    use,
    sendDACPMessageOnBehalfOf,
  }
}
