/**
 * Mock Intent Resolver for Cucumber Tests
 *
 * Simulates user interaction with intent resolver UI.
 * Tests can program specific choices or use auto-resolution logic.
 */

import type {
  IntentResolutionCallback,
  IntentResolutionRequest,
  IntentResolutionResponse,
} from "../../src/core/handlers/types"

/**
 * Mock implementation of intent resolver for testing.
 *
 * Provides three resolution modes:
 * 1. Auto-resolve: Returns first handler if only one option
 * 2. Programmed: Returns pre-configured choice set by test
 * 3. Default: Returns first handler in list
 */
export class MockIntentResolver {
  private nextChoice: { instanceId?: string; appId: string } | null = null
  private resolutionHistory: IntentResolutionRequest[] = []

  /**
   * Program the next resolution choice.
   * The resolver will return this handler on next call.
   */
  setNextChoice(handler: { instanceId?: string; appId: string }): void {
    this.nextChoice = handler
  }

  /**
   * Clear programmed choice
   */
  clearChoice(): void {
    this.nextChoice = null
  }

  /**
   * Get resolution history for verification
   */
  getResolutionHistory(): IntentResolutionRequest[] {
    return [...this.resolutionHistory]
  }

  /**
   * Clear resolution history
   */
  clearHistory(): void {
    this.resolutionHistory = []
  }

  /**
   * Create the callback function that matches IntentResolutionCallback interface.
   * This is what gets passed to DesktopAgent config.
   */
  createCallback(): IntentResolutionCallback {
    return async (request: IntentResolutionRequest): Promise<IntentResolutionResponse> => {
      // Track the request
      this.resolutionHistory.push(request)

      // Auto-resolve if only one handler available
      if (request.handlers.length === 1) {
        return {
          requestId: request.requestId,
          selectedHandler: {
            instanceId: request.handlers[0].instanceId,
            appId: request.handlers[0].appId,
          },
        }
      }

      // Use programmed choice if available
      if (this.nextChoice) {
        const selected = this.nextChoice
        this.nextChoice = null // Consume the choice
        return {
          requestId: request.requestId,
          selectedHandler: selected,
        }
      }

      // Default: return first handler
      return {
        requestId: request.requestId,
        selectedHandler: {
          instanceId: request.handlers[0].instanceId,
          appId: request.handlers[0].appId,
        },
      }
    }
  }
}
