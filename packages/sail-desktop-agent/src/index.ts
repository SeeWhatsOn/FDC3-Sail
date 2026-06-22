/**
 * FDC3 Desktop Agent - Core Package
 *
 * Browser-resident hosts use {@link createBrowserDesktopAgent} from this entry point.
 * Lower-level WCP primitives: `@finos/sail-desktop-agent/browser`.
 */

// Re-export everything from core
export * from "./core"

// UI-free host contracts for platform builders (launch, intent resolver, channel control)
export * from "./host-contracts"

// Browser Desktop Agent factory (DA-owned WCP app connection)
export {
  createBrowserDesktopAgent,
  type BrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
} from "./core/create-browser-desktop-agent.js"

export {
  getBrowserDesktopAgentSession,
  isBrowserDesktopAgent,
  clearBrowserDesktopAgentSession,
  createBrowserHostControllers,
  type BrowserDesktopAgentSession,
  type BrowserHostControllers,
  type BrowserHostControllerOptions,
  type BrowserIntentResolverController,
  type BrowserChannelsController,
  type AppChannelChangeEvent,
  type BrowserAppsController,
  type BrowserAppOpenOptions,
  type BrowserAppInstance,
  type HandshakeFailureEvent,
} from "./core/browser-session.js"

// NOTE: Lower-level browser connector APIs are NOT exported here
// Import from @finos/sail-desktop-agent/browser for:
// - WCPConnector
// - MessagePortTransport
