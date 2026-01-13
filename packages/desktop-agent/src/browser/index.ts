/**
 * Browser Module - FDC3 Desktop Agent for Browser Environments
 *
 * This module provides browser-specific implementations for running
 * an FDC3 Desktop Agent in the browser with WCP support.
 *
 * ## Key Components
 *
 * - **createBrowserDesktopAgent()** - Factory for complete browser DA setup
 * - **WCPConnector** - Handles WCP1-3 handshake with iframe apps
 * - **MessagePortTransport** - Transport for MessagePort communication
 *
 * ## Tree-Shaking
 *
 * This module is tree-shakeable. If you only import the core Desktop Agent
 * from the root package, this browser-specific code will NOT be included
 * in your bundle.
 *
 * To use browser functionality, explicitly import from this submodule:
 *
 * ```typescript
 * // ✅ Browser code included
 * import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'
 *
 * // ✅ Browser code NOT included (core only)
 * import { DesktopAgent } from '@finos/fdc3-sail-desktop-agent'
 * ```
 *
 * ## Usage Patterns
 *
 * ### Pattern 1: Complete Browser DA (Recommended)
 * ```typescript
 * import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'
 *
 * const { desktopAgent, wcpConnector, start } = createBrowserDesktopAgent({
 *   wcpOptions: {
 *     getIntentResolverUrl: (id) => `/resolver?id=${id}`,
 *     getChannelSelectorUrl: (id) => `/selector?id=${id}`
 *   }
 * })
 *
 * start()
 * ```
 *
 * ### Pattern 2: Manual Composition (Advanced)
 * ```typescript
 * import { DesktopAgent } from '@finos/fdc3-sail-desktop-agent'
 * import { WCPConnector, MessagePortTransport } from '@finos/fdc3-sail-desktop-agent/browser'
 * import { createInMemoryTransportPair } from '@finos/fdc3-sail-desktop-agent/transports'
 *
 * const [daTransport, wcpTransport] = createInMemoryTransportPair()
 * const desktopAgent = new DesktopAgent({ transport: daTransport })
 * const wcpConnector = new WCPConnector(wcpTransport)
 *
 * desktopAgent.start()
 * wcpConnector.start()
 * ```
 *
 * ### Pattern 3: Sail-Controlled UI
 * ```typescript
 * import { createBrowserDesktopAgent } from '@finos/fdc3-sail-desktop-agent/browser'
 *
 * const { desktopAgent, wcpConnector, start } = createBrowserDesktopAgent({
 *   wcpOptions: {
 *     // Return false to indicate Sail provides UI externally
 *     getIntentResolverUrl: () => false,
 *     getChannelSelectorUrl: () => false
 *   }
 * })
 *
 * start()
 * // Apps receive WCP3Handshake with intentResolverUrl: false, channelSelectorUrl: false
 * ```
 */

// Main factory function (recommended entry point)
export { createBrowserDesktopAgent } from "./browser-desktop-agent"
export type { BrowserDesktopAgentOptions, BrowserDesktopAgentResult } from "./browser-desktop-agent"

// Core browser components (for advanced usage)
export { WCPConnector } from "./wcp/wcp-connector"
export type {
  WCPConnectorEvents,
  WCPConnectorOptions,
  AppConnectionMetadata,
  IntentHandler,
  IntentResolverPayload,
  IntentResolverResponse,
} from "./wcp/wcp-connector"

export { MessagePortTransport } from "./wcp/message-port-transport"

// Re-export core Desktop Agent for convenience
// (This is safe - it's already in the core package)
export { DesktopAgent } from "../core/desktop-agent"
export type { DesktopAgentConfig } from "../core/desktop-agent"
