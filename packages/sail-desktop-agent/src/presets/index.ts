/**
 * High-level preset factories for common Desktop Agent integration paths.
 *
 * Prefer presets when you want a batteries-included setup; use manual composition
 * primitives from `@finos/sail-desktop-agent`, `/connectors`, and `/transports`
 * when you need full control over wiring.
 */
export {
  createBrowserDesktopAgent,
  createWCPClient,
  type BrowserDesktopAgentOptions,
  type BrowserDesktopAgentResult,
  type WCPClientOptions,
  type WCPClientResult,
} from "../connectors/browser/browser-desktop-agent.js"

export { WCPConnector } from "../connectors/browser/wcp/wcp-connector.js"
