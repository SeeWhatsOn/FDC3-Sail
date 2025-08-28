// Main exports for FDC3 Sail Desktop Agent package

// Core desktop agent implementation
export { SailFDC3Server } from "./desktop-agent/SailFDC3Server"
export { initSocketService } from "./desktop-agent/initSocketService"
export { SailAppInstanceManager } from "./desktop-agent/sailAppInstanceManager"

// Handlers
export * from "./desktop-agent/handlers"

// Types
export * from "./types"

// App directory management
export { AppDirectoryManager } from "./app-directory/appDirectoryManager"

// Constants
export { APP_CONFIG } from "./constants"
