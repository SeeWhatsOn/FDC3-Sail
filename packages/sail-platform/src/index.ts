// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

// SailPlatform - Primary API for Sail Platform SDK
export { SailPlatform, type SailPlatformConfig } from "./sail-platform"

export type {
  SailDesktopAgentApps,
  SailDesktopAgentChannels,
  IntentResolverUIMethods,
  AppChannelChangeEvent,
  HandshakeFailureEvent,
} from "@finos/sail-desktop-agent"

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

// ============================================================================
// LOW-LEVEL APIs (for advanced use cases)
// ============================================================================

// Sail Browser Desktop Agent (use SailPlatform instead for most cases)
export { createSailBrowserDesktopAgent } from "./sail-browser-desktop-agent"
export type { SailBrowserDesktopAgentConfig } from "./sail-browser-desktop-agent"

// Services
export { SailAppLauncher } from "./services/app-launcher/sail-app-launcher"

// Sail Platform Client (host-owned config persistence)
export { SailPlatformClient, type SailPlatformClientConfig } from "./client"

// Browser-ready Desktop Agent (re-export from @finos/sail-desktop-agent)
export { SailDesktopAgent, type SailDesktopAgentOptions } from "@finos/sail-desktop-agent"

// Desktop Agent types (for library consumers)
export {
  type AppConnectionMetadata,
  type AppConnectionOptions,
  type SailImplementationMetadata,
  type ValidationMode,
  type AppLauncher,
  type DirectoryApp,
  type WebAppDetails,
} from "@finos/sail-desktop-agent"

// Utilities
export { generateUuid } from "./utils/uuid"
