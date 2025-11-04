/**
 * Browser Entry Point
 *
 * Exports Desktop Agent functionality for browser-side usage with MessagePort
 *
 * Note: This is a future enhancement. The browser entry point will allow
 * running the Desktop Agent directly in the browser using MessagePort
 * for communication between apps and the agent.
 */

// Transport
export { MessagePortTransport, type MessageTransport } from "./transport"

// State Registries (for browser-based Desktop Agent)
export { AppInstanceRegistry, AppInstanceState } from "./state/AppInstanceRegistry"
export { IntentRegistry } from "./state/IntentRegistry"
export { AppDirectoryManager } from "./app-directory/appDirectoryManager"

// Types
export type { DACPHandlerContext, DACPHandler } from "./handlers/types"

// Re-export FDC3 types for convenience
export type { AppMetadata, Context, AppIntent, AppIdentifier, IntentResult } from "@finos/fdc3"

// TODO: Create a browser-specific DesktopAgent class that uses MessagePortTransport
// export { BrowserDesktopAgent } from "./BrowserDesktopAgent"
