/**
 * FDC3 Desktop Agent - Pure, Environment-Agnostic Implementation
 *
 * This package provides a pure FDC3 Desktop Agent with dependency injection.
 * All environment-specific concerns (transport, app launching) are injected
 * via constructor, making this portable across any runtime.
 */

// Core Desktop Agent class
export { DesktopAgent } from "./DesktopAgent"
export type { DesktopAgentConfig } from "./DesktopAgent"

// Interfaces (contracts for implementations)
export type { Transport, MessageHandler, DisconnectHandler } from "./interfaces/Transport"
export type { AppLauncher, AppLaunchRequest, AppLaunchResult } from "./interfaces/AppLauncher"

// State registries
export { AppInstanceRegistry } from "./state/AppInstanceRegistry"
export { IntentRegistry } from "./state/IntentRegistry"
export { ChannelContextRegistry } from "./state/ChannelContextRegistry"
export { AppChannelRegistry } from "./state/AppChannelRegistry"
export { UserChannelRegistry } from "./state/UserChannelRegistry"
export { AppDirectoryManager } from "./app-directory/appDirectoryManager"

// Handler types (for advanced usage)
export type { DACPHandlerContext, DACPHandler } from "./handlers/types"

// Re-export common FDC3 types for convenience
export type { AppMetadata, Context, AppIntent, AppIdentifier } from "@finos/fdc3"
