/**
 * Mock AppLauncher for Cucumber Tests
 *
 * Simulates app launching without requiring a real browser or UI.
 * Provides hooks for tests to control and verify launch behavior.
 */

import type { AppLauncher, AppLaunchRequest, AppLaunchResult } from "../../src/core/interfaces/app-launcher"
import type { AppMetadata } from "@finos/fdc3"

/**
 * Mock AppLauncher that simulates app launches for testing.
 *
 * - Auto-generates instance IDs
 * - Tracks all launch attempts
 * - Can be configured to fail for specific apps
 * - Emits app validation events for test coordination
 */
export class MockAppLauncher implements AppLauncher {
  private nextInstanceId: number = 0
  private launchHistory: Array<{ request: AppLaunchRequest; metadata: AppMetadata }> = []
  private failApps: Set<string> = new Set()
  
  // Callbacks for test coordination
  public onAppLaunched?: (instanceId: string, appId: string) => void | Promise<void>
  public onInstanceCreated?: (instanceId: string, appId: string) => void

  /**
   * Launch an app, returning a mock instance ID.
   * Throws error if app is configured to fail or contains "missing" in name.
   */
  async launch(request: AppLaunchRequest, appMetadata: AppMetadata): Promise<AppLaunchResult> {
    const appId = request.app.appId

    // Track launch attempt
    this.launchHistory.push({ request, metadata: appMetadata })

    // Check for failure conditions
    if (appId.includes("missing") || this.failApps.has(appId)) {
      throw new Error("AppNotFound")
    }

    // Generate instance ID
    const instanceId = `uuid-${this.nextInstanceId++}`

    // Notify tests that instance was created (so they can register it in state)
    if (this.onInstanceCreated) {
      this.onInstanceCreated(instanceId, appId)
    }

    // Notify tests that app was launched (so they can simulate validation)
    if (this.onAppLaunched) {
      await this.onAppLaunched(instanceId, appId)
    }

    return {
      appIdentifier: {
        appId,
        instanceId,
      },
      launchMetadata: {
        method: "mock",
      },
    }
  }

  /**
   * Configure specific app to fail on launch
   */
  setAppToFail(appId: string): void {
    this.failApps.add(appId)
  }

  /**
   * Clear failure configuration
   */
  clearFailures(): void {
    this.failApps.clear()
  }

  /**
   * Get launch history for verification
   */
  getLaunchHistory(): Array<{ request: AppLaunchRequest; metadata: AppMetadata }> {
    return [...this.launchHistory]
  }

  /**
   * Clear launch history
   */
  clearHistory(): void {
    this.launchHistory = []
  }

  /**
   * Reset instance ID counter (useful between tests)
   */
  resetInstanceCounter(): void {
    this.nextInstanceId = 0
  }
}
