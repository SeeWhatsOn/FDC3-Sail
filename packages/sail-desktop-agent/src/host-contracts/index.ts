/**
 * Host Contracts
 *
 * UI-free FDC3 host integration contracts for platform builders.
 * These types describe launch, intent resolution, and channel control
 * without depending on Sail product shell packages.
 */

export type { AppLauncher } from "./app-launcher"

export type {
  IntentResolver,
  IntentResolutionRequest,
  IntentResolutionResponse,
  IntentHandler,
} from "./intent-resolver"

export type { ChannelControl, ChannelSelectionRequest } from "./channel-control"
