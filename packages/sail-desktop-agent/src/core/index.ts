/**
 * FDC3 Desktop Agent - Core Module
 *
 * This module contains the pure, environment-agnostic FDC3 Desktop Agent implementation.
 * It has zero browser-specific dependencies and can run in any JavaScript environment.
 *
 * ## What's in Core
 *
 * - **DesktopAgent** - Main Desktop Agent class with FDC3 API implementation
 * - **Interfaces** - Transport and other core interfaces
 * - **State Registries** - App instances, intents, channels
 * - **Handlers** - DACP message handlers
 * - **Protocol** - DACP message types
 * - **App Directory** - App directory management
 */

// Core Desktop Agent
export { DesktopAgent } from "./desktop-agent"
export type { DesktopAgentConfig, DesktopAgentOptions } from "./desktop-agent"
export { DEFAULT_FDC3_USER_CHANNELS } from "./default-user-channels"
export {
  DEFAULT_SAIL_DESKTOP_AGENT_CONFIG,
  DEFAULT_SAIL_IMPLEMENTATION_METADATA,
  resolveDesktopAgentConfig,
} from "./sail-default-config"
export type { SailImplementationMetadata } from "./sail-default-config"

// Interfaces (types only - no implementations)
export type { Transport, MessageHandler, DisconnectHandler } from "./interfaces/transport"
export * from "./interfaces"

// State Types (from functional state management)
export type { AgentState, AppInstance, AppInstanceState, StateSetter } from "./state/types"
export { createInitialState, createStateWithOverrides } from "./state/initial-state"
export * from "./state/selectors"
export * from "./state/mutators"

// App Directory
export { AppDirectoryManager, isValidDirectoryUrl } from "./app-directory/app-directory-manager"
export type {
  DirectoryApp,
  DirectoryData,
  DirectoryIntent,
  WebAppDetails,
  NativeAppDetails,
  CitrixAppDetails,
  OnlineNativeAppDetails,
  OtherAppDetails,
  LaunchDetails,
  AppType,
  Icon,
  Screenshot,
  IntentDefinition,
  AppIntent,
} from "./app-directory/types"

// DACP Protocol Messages (types)
export * from "./dacp"

// Handler types
export type {
  DACPHandlerContext,
  DACPMessage,
  MessageValidator,
  ValidationResult,
  MessageType,
  WCPMessageType,
} from "./handlers/types"

// DACP Protocol Utilities re-exported via core/dacp barrel above
