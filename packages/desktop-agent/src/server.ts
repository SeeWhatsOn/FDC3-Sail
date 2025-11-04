/**
 * Server Entry Point
 *
 * Exports Desktop Agent functionality for server-side (Node.js) usage with Socket.IO
 */

// Main Desktop Agent
export { startDesktopAgent, type DesktopAgentConnectionHandler, type DesktopAgentDependencies } from "./index"

// Transport
export { SocketIOTransport, type MessageTransport } from "./transport"

// State Registries
export { AppInstanceRegistry, AppInstanceState } from "./state/AppInstanceRegistry"
export { IntentRegistry } from "./state/IntentRegistry"
export { AppDirectoryManager } from "./app-directory/appDirectoryManager"

// Types
export type { DACPHandlerContext, DACPHandler } from "./handlers/types"

// Re-export FDC3 types for convenience
export type { AppMetadata, Context, AppIntent, AppIdentifier, IntentResult } from "@finos/fdc3"
