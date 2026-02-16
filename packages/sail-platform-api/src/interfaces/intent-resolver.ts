/**
 * Intent Resolver Interface
 *
 * Defines the contract for UI components that handle intent resolution
 * when multiple handlers are available for a raised intent.
 */

import type { AppIdentifier, AppMetadata, Context, IntentMetadata } from "@finos/fdc3"

/**
 * Information about a potential intent handler
 */
export interface IntentHandler {
  /** The app that can handle the intent */
  app: AppMetadata

  /** The intent this handler supports */
  intent: IntentMetadata

  /** Instance ID if this is a running app instance */
  instanceId?: string

  /** Whether this is an already-running instance */
  isRunning: boolean
}

/**
 * Request for intent resolution
 */
export interface IntentResolutionRequest {
  /** Unique ID for this resolution request */
  requestId: string

  /** The intent being raised */
  intent: string

  /** The context being passed with the intent */
  context: Context

  /** Available handlers to choose from */
  handlers: IntentHandler[]
}

/**
 * Response from intent resolution
 */
export interface IntentResolutionResponse {
  /** The selected handler */
  selectedHandler: IntentHandler

  /** The app identifier to target */
  target: AppIdentifier
}

/**
 * Intent Resolver Interface
 *
 * Implementations provide UI for users to select between multiple
 * intent handlers. The SailPlatform will call resolve() when the
 * desktop agent needs user input to complete an intent resolution.
 *
 * @example
 * ```typescript
 * const intentResolver: IntentResolver = {
 *   resolve: async (request) => {
 *     // Show dialog with request.handlers
 *     const selected = await showIntentDialog(request)
 *     if (!selected) return null // User cancelled
 *     return {
 *       selectedHandler: selected,
 *       target: { appId: selected.app.appId, instanceId: selected.instanceId }
 *     }
 *   }
 * }
 * ```
 */
export interface IntentResolver {
  /**
   * Called when the user must choose between multiple intent handlers.
   *
   * @param request - The resolution request with available handlers
   * @returns The selected handler, or null if user cancelled
   */
  resolve(request: IntentResolutionRequest): Promise<IntentResolutionResponse | null>
}
