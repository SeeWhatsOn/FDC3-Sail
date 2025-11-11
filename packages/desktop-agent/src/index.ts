/**
 * FDC3 Desktop Agent - Pure, Environment-Agnostic Implementation
 *
 * This package provides a pure FDC3 Desktop Agent with dependency injection.
 * All environment-specific concerns (transport, app launching) are injected
 * via constructor, making this portable across any runtime.
 */

// Core Desktop Agent class
export { DesktopAgent } from "./desktop-agent"
export type { DesktopAgentConfig } from "./desktop-agent"

// Interfaces (contracts for implementations)
export type { Transport, MessageHandler, DisconnectHandler } from "./interfaces/transport"
export type { AppLauncher, AppLaunchRequest, AppLaunchResult } from "./interfaces/app-launcher"

// State registries
export { AppInstanceRegistry } from "./state/app-instance-registry"
export { IntentRegistry } from "./state/intent-registry"
export { ChannelContextRegistry } from "./state/channel-context-registry"
export { AppChannelRegistry } from "./state/app-channel-registry"
export { UserChannelRegistry } from "./state/user-channel-registry"
export { AppDirectoryManager } from "./app-directory/app-directory-manager"

// Handler types (for advanced usage)
export type { DACPHandlerContext, DACPHandler } from "./handlers/types"

// Re-export common FDC3 types for convenience
export type { AppMetadata, Context, AppIntent, AppIdentifier } from "@finos/fdc3"
