/**
 * Sail Platform Interfaces
 *
 * These interfaces define the contracts that UI implementations must fulfill.
 * The SailPlatform depends on these abstractions, allowing it to remain
 * UI-agnostic while still providing rich user interactions.
 */

export type {
  IntentResolver,
  IntentResolutionRequest,
  IntentResolutionResponse,
  IntentHandler,
} from "./intent-resolver"

export type {
  ChannelSelector,
  ChannelSelectionRequest,
} from "./channel-selector"

// Re-export AppLauncher from desktop-agent for convenience
export type { AppLauncher } from "@finos/sail-desktop-agent"
