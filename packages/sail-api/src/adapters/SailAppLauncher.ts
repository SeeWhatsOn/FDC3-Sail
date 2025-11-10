/**
 * Sail App Launcher
 *
 * Browser-based app launcher for Sail FDC3 implementation.
 * Launches apps by sending messages to the Sail UI to open apps in
 * iframes, tabs, or windows.
 */

import type {
  AppLauncher,
  AppLaunchRequest,
  AppLaunchResult,
  AppMetadata,
} from "@finos/fdc3-sail-desktop-agent"
import { v4 as uuidv4 } from "uuid"

/**
 * Configuration for Sail App Launcher
 */
export interface SailAppLauncherConfig {
  /**
   * Callback to notify Sail UI to open an app.
   * The UI is responsible for creating the iframe/tab/window.
   *
   * @param appMetadata - App metadata from directory
   * @param instanceId - Generated instance ID
   * @param context - Optional launch context
   * @returns Promise that resolves when UI has initiated the launch
   */
  onLaunchApp: (
    appMetadata: AppMetadata,
    instanceId: string,
    context?: unknown
  ) => Promise<void>
}

/**
 * Sail-specific implementation of AppLauncher.
 *
 * This launcher works with the Sail UI to open apps in the browser.
 * It generates instance IDs and delegates to the UI for actual rendering.
 */
export class SailAppLauncher implements AppLauncher {
  constructor(private config: SailAppLauncherConfig) {}

  async launch(request: AppLaunchRequest, appMetadata: AppMetadata): Promise<AppLaunchResult> {
    // Generate instance ID if not targeting existing instance
    const instanceId = request.app.instanceId || uuidv4()

    // Determine launch URL from app metadata
    const url = this.extractAppUrl(appMetadata)
    if (!url) {
      throw new Error(`Cannot launch app ${request.app.appId}: no URL found in app metadata`)
    }

    // Notify Sail UI to open the app
    await this.config.onLaunchApp(appMetadata, instanceId, request.context)

    // Return launch result
    return {
      appIdentifier: {
        appId: request.app.appId,
        instanceId,
      },
      launchMetadata: {
        url,
        method: "iframe", // TODO: Determine from app metadata or config
      },
    }
  }

  /**
   * Extract app URL from metadata
   */
  private extractAppUrl(appMetadata: AppMetadata): string | undefined {
    // Try common locations for URL in app metadata
    if (appMetadata.details?.url) {
      return appMetadata.details.url as string
    }

    // Future: support other URL locations or formats
    return undefined
  }
}
