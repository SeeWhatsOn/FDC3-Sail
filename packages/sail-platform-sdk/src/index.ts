// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

// SailPlatform - Primary API for Sail Platform SDK
export {
  SailPlatform,
  type SailPlatformConfig,
  type WorkspacesApi,
  type LayoutsApi,
  type ConfigApi,
} from "./sail-platform"

// UI Interfaces (for implementing custom UI)
export type {
  IntentResolver,
  IntentResolutionRequest,
  IntentResolutionResponse,
  IntentHandler,
  ChannelSelector,
  ChannelSelectionRequest,
} from "./interfaces"

// ============================================================================
// TYPES
// ============================================================================

export * from "./types/sail-types"
export * from "./types/sail-messages"

// ============================================================================
// LOW-LEVEL APIs (for advanced use cases)
// ============================================================================

// Sail Browser Desktop Agent (use SailPlatform instead for most cases)
export { createSailBrowserDesktopAgent } from "./sail-browser-desktop-agent"
export type { SailBrowserDesktopAgentConfig } from "./sail-browser-desktop-agent"

// Services
export { SailAppLauncher } from "./services/app-launcher/sail-app-launcher"

// Sail Platform Client (workspaces, layouts, config)
export {
  // Platform client
  SailPlatformClient,
  LocalStorageBackend,
  type PlatformApi,
  type SailPlatformClientConfig,
  type LocalStorageBackendConfig,
  type RemoteBackendConfig,
} from "./client"

// Middleware pipeline (kept for future usage)
export { MiddlewarePipeline, type Middleware } from "./middleware/middleware"

// Browser Desktop Agent (re-export from @finos/sail-desktop-agent/browser)
export {
  WCPConnector,
  MessagePortTransport,
  createBrowserDesktopAgent,
  type WCPConnectorOptions,
  type WCPConnectorEvents,
  type AppConnectionMetadata,
  type BrowserDesktopAgentOptions,
  type BrowserDesktopAgentResult,
} from "@finos/sail-desktop-agent/browser"

// Core Desktop Agent types (for library consumers)
export {
  DesktopAgent,
  type DesktopAgentConfig,
  type Transport,
  type MessageHandler,
  type DisconnectHandler,
  type AppLauncher,
  type DirectoryApp,
  type WebAppDetails,
} from "@finos/sail-desktop-agent"

// Validation utilities for downstream consumers
export {
  createZodValidator,
  zodValidator,
  strictZodValidator,
} from "./services/validation/zod-validator"
export { validateDACPMessage, safeParseDACPMessage } from "./services/validation/dacp-zod-validator"
export * from "./services/validation/dacp-schemas"
