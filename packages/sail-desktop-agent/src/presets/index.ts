/**
 * High-level preset factories for common Desktop Agent integration paths.
 *
 * Prefer presets when you want a batteries-included setup; use manual composition
 * primitives from `@finos/sail-desktop-agent`, `/connectors`, and `/transports`
 * when you need full control over wiring.
 */
export {
  createBrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
  type BrowserDesktopAgentResult,
} from "./browser-desktop-agent.js"

export {
  createWCPClient,
  type WCPClientOptions,
  type WCPClientResult,
} from "../connectors/browser/browser-desktop-agent.js"

export { WCPConnector } from "../connectors/browser/wcp-connector.js"
