// Main exports for FDC3 Sail Desktop Agent package

// Primary Desktop Agent API - Main entry point
export { DesktopAgent, getDesktopAgent, type DesktopAgentConfig, type DesktopAgentHealth } from "./desktopAgent";

// DACP Protocol Messages (exported for client use)
export * from "./protocol/dacp-messages";

// Transport Layer (transport-agnostic communication)
export * from "./transport";

// DACP Handlers and validation
export * from "./handlers/dacp";
export * from "./handlers/validation/dacp-validator";
export * from "./handlers/validation/dacp-schemas";
export * from "./handlers/types";

// State Management
export * from "./state/AppInstanceRegistry"
export * from "./state/IntentRegistry";
// TODO: Complete implementation
// export * from "./state/PrivateChannelRegistry";

// App directory management
export { AppDirectoryManager } from "./app-directory/appDirectoryManager";

// Default export for convenience
export { default } from "./desktopAgent";