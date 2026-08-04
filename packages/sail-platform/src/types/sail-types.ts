// ============================================================================
// SAIL PLATFORM TYPES
// ============================================================================
//
// Sail-specific types and interfaces shared across packages (e.g. sail-finance's
// channel-selector components). These types define the core Sail platform
// abstractions.
//
// ============================================================================

// Re-export DirectoryApp and WebAppDetails from sail-desktop-agent for consistency
export type { DirectoryApp, WebAppDetails } from "@finos/sail-desktop-agent"

// ============================================================================
// SAIL INSTANCE MANAGEMENT
// ============================================================================

/**
 * Unique identifier for a specific app instance in the Sail platform
 */
export type InstanceID = string

// Note: WebAppDetails and DirectoryApp are re-exported from @finos/sail-desktop-agent above

// ============================================================================
// SAIL UI TYPES
// ============================================================================

/**
 * Tab/Channel visual representation for UI rendering
 * Used across multiple packages for channel visualization
 */
export interface TabDetail {
  id: string
  icon: string
  background: string
}

/**
 * Sail app hosting approach
 */
export enum AppHosting {
  Frame,
  Tab,
}
