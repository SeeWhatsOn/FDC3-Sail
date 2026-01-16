/**
 * Browser Module - FDC3 Desktop Agent for Browser Environments
 *
 * This module provides browser-specific implementations for running
 * an FDC3 Desktop Agent in the browser with WCP support.
 *
 * ## Key Components
 *
 * - **createBrowserDesktopAgent()** - Factory for complete local browser DA setup
 * - **createWCPClient()** - Factory for remote DA (server/worker) mode
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
 * ### Pattern 1: Local Browser DA (Desktop Agent in same window)
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
 * ### Pattern 2: Server Mode (Desktop Agent on server)
 * ```typescript
 * import { createWCPClient } from '@finos/fdc3-sail-desktop-agent/browser'
 * import { SocketIOClientTransport } from '@finos/sail-platform-sdk'
 *
 * const transport = new SocketIOClientTransport({ url: 'wss://server.com' })
 * const { wcpConnector, start } = createWCPClient({
 *   transport,
 *   wcpOptions: {
 *     getIntentResolverUrl: () => false,  // Sail-controlled UI
 *     getChannelSelectorUrl: () => false,
 *   }
 * })
 *
 * start()
 * ```
 *
 * ### Pattern 3: Worker Mode (Desktop Agent in Web Worker)
 * ```typescript
 * import { createWCPClient } from '@finos/fdc3-sail-desktop-agent/browser'
 * import { WebWorkerTransport } from '@finos/sail-platform-sdk'
 *
 * const worker = new Worker('desktop-agent-worker.js')
 * const transport = new WebWorkerTransport(worker)
 * const { wcpConnector, start } = createWCPClient({ transport })
 *
 * start()
 * ```
 *
 * ### Pattern 4: Manual Composition (Advanced)
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
 */

// Main factory functions
export { createBrowserDesktopAgent, createWCPClient } from "./browser-desktop-agent"
export type {
  BrowserDesktopAgentOptions,
  BrowserDesktopAgentResult,
  WCPClientOptions,
  WCPClientResult,
} from "./browser-desktop-agent"

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
