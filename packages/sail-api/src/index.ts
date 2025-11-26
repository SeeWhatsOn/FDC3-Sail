// Protocol and Type Definitions
export * from "./protocol/sail-messages";
export * from "./types/sail-types";

// Client APIs
export * from "./client/SailServerClientAPI";
export * from "./client/SailPlatformApi";

// Server API
export * from "./server";

// Sail Desktop Agents
export {
  SailServerDesktopAgent,
  type SailServerDesktopAgentConfig,
  type Middleware,
} from "./SailDesktopAgent";
export {
  createSailBrowserDesktopAgent,
  type SailBrowserDesktopAgentConfig,
} from "./SailBrowserDesktopAgent";

// Adapters
export * from "./adapters";

// Platform API
export * from "./platform";

// Browser Desktop Agent (re-export from @finos/fdc3-sail-desktop-agent/browser)
export {
  createBrowserDesktopAgent,
  type BrowserDesktopAgentOptions,
  type BrowserDesktopAgentResult,
  WCPConnector,
  type WCPConnectorOptions,
  type WCPConnectorEvents,
  type AppConnectionMetadata,
  MessagePortTransport,
  DesktopAgent,
  type DesktopAgentConfig,
} from "@finos/fdc3-sail-desktop-agent/browser";
