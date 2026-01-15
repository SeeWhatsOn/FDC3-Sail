/**
 * FDC3 Desktop Agent - Core Module
 *
 * This module contains the pure, environment-agnostic FDC3 Desktop Agent implementation.
 * It has zero browser-specific dependencies and can run in any JavaScript environment.
 *
 * ## What's in Core
 *
 * - **DesktopAgent** - Main Desktop Agent class with FDC3 API implementation
 * - **Interfaces** - Transport, AppLauncher, and other core interfaces
 * - **State Registries** - App instances, intents, channels
 * - **Handlers** - DACP message handlers
 * - **Protocol** - DACP message types
 * - **App Directory** - App directory management
 */

// Core Desktop Agent
export { DesktopAgent } from "./desktop-agent"
export type { DesktopAgentConfig } from "./desktop-agent"

// Interfaces (types only - no implementations)
export type { Transport, MessageHandler, DisconnectHandler } from "./interfaces/transport"
export type { AppLauncher } from "./interfaces/app-launcher"
export * from "./interfaces"

// State Registries
export { AppInstanceRegistry } from "./state/app-instance-registry"
export type { AppInstance, AppInstanceState } from "./state/app-instance-registry"
export { IntentRegistry } from "./state/intent-registry"
export { ChannelContextRegistry } from "./state/channel-context-registry"
export { AppChannelRegistry } from "./state/app-channel-registry"
export { UserChannelRegistry } from "./state/user-channel-registry"
export { PrivateChannelRegistry } from "./state/private-channel-registry"

// App Directory
export { AppDirectoryManager } from "./app-directory/app-directory-manager"

// DACP Protocol Messages (types)
export * from "./protocol/dacp-messages"

// Handler types and validation
export type { DACPHandlerContext, MessageValidator, ValidationResult } from "./handlers/types"
export { noopValidator } from "./handlers/validation/dacp-validator"

// DACP Schemas (for external validators like Zod validator in sail-platform-sdk)
export * from "./handlers/validation/dacp-schemas"
