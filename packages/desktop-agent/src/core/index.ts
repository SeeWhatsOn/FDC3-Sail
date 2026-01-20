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

// State Types (from functional state management)
export type { AgentState, AppInstance, AppInstanceState } from "./state/types"
export { createInitialState, createStateWithOverrides } from "./state/initial"
export * from "./state/selectors"
export * from "./state/transforms"

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
export * from "./protocol/dacp-messages"

// Handler types
export type { DACPHandlerContext, DACPMessage, MessageValidator, ValidationResult } from "./handlers/types"

// DACP Protocol Utilities (errors, constants, message creators, utilities)
export * from "./protocol/dacp-utilities"
