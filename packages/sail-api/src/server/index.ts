/**
 * Sail API Server Exports - KISS Version
 */

// Main server API (KISS version)
export {
  SailServer,
  type SailServerConfig,
  type DirectoryResponse,
  type ConnectedAppsResponse
} from "./SailServer"

// Desktop Agent Singleton
export { DesktopAgentSingleton } from "./DesktopAgentSingleton"

// Re-export FDC3 types for convenience
export type {
  AppInstance,
  AppInstanceRegistry,
  AppDirectoryManager,
  AppInstanceState
} from "@finos/fdc3-sail-desktop-agent"
