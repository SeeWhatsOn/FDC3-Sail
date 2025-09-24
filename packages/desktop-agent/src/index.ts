// Main exports for FDC3 Sail Desktop Agent package

// DACP Protocol Messages (exported for client use)
export * from "./protocol/dacp-messages";

// DACP Handlers and validation
export * from "./handlers/dacp";
export * from "./handlers/validation/dacp-validator";
export * from "./handlers/validation/dacp-schemas";
export * from "./handlers/types";

// State Management (when implemented)
// export * from "./state/AppInstanceRegistry";
// export * from "./state/IntentRegistry";
// export * from "./state/PrivateChannelRegistry";

// App directory management
export { AppDirectoryManager } from "./app-directory/appDirectoryManager";

// Constants
export { APP_CONFIG } from "./constants";