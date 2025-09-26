// ============================================================================
// SAIL SOCKET SERVER EXPORTS
// ============================================================================
//
// Main exports for the Sail Socket Server application
// Provides types and protocol definitions for client consumption
//
// ============================================================================

// Sail protocol messages (for client use)
export * from "./protocol/sail-messages"

// Sail platform types (for client use)
export * from "./types/sail-types"

// Core server functionality (internal use)
// Export only what's needed for external integration
export {
  DualProtocolHandler,
  type DualProtocolConfig,
  type DualProtocolContext,
} from "./services/DualProtocolHandler"
