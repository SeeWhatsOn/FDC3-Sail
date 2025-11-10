/**
 * AppLauncher Interface
 *
 * Abstraction for launching FDC3 applications. Implementations handle
 * environment-specific launching (browser tabs/iframes, Electron windows,
 * native processes, etc.)
 */

import type { Context, AppMetadata, AppIdentifier } from "@finos/fdc3"

/**
 * Request to launch an application
 * Extends FDC3 OpenRequestPayload with targetChannelId
 */
export interface AppLaunchRequest {
  /**
   * App identifier (FDC3 standard structure)
   */
  app: AppIdentifier

  /**
   * Optional context to pass to the app on launch
   */
  context?: Context

  /**
   * Optional channel ID for the app to join after launch
   */
  targetChannelId?: string | null
}

/**
 * Result of a successful app launch
 * Extends FDC3 OpenResponsePayload with required appIdentifier and launchMetadata
 */
export interface AppLaunchResult {
  /**
   * App identifier (required, from FDC3 OpenResponsePayload)
   */
  appIdentifier: AppIdentifier

  /**
   * Optional metadata about how/where the app was launched
   */
  launchMetadata?: {
    /**
     * URL or path where the app was launched
     */
    url?: string

    /**
     * Launch method used (e.g., "iframe", "window", "tab", "electron")
     */
    method?: string

    /**
     * Any additional environment-specific metadata
     */
    [key: string]: unknown
  }
}

/**
 * AppLauncher interface for launching FDC3 applications.
 * Implementations handle environment-specific app launching logic.
 */
export interface AppLauncher {
  /**
   * Launch an application and return information about the launched instance.
   *
   * The launcher is responsible for:
   * 1. Determining how to launch based on app metadata (type, url, etc.)
   * 2. Performing the actual launch (open tab, create window, spawn process, etc.)
   * 3. Generating a unique instance ID
   * 4. Returning launch result for the Desktop Agent to complete registration
   *
   * The Desktop Agent will handle:
   * - Registering the instance in AppInstanceRegistry
   * - Setting the target channel (if specified)
   * - Delivering launch context (if specified)
   * - Sending the FDC3 response
   *
   * @param request - Launch request with app identifier, context, target channel
   * @param appMetadata - App metadata from directory (for launch details)
   * @returns Promise resolving to launch result
   * @throws Error if launch fails (Desktop Agent will convert to FDC3 error response)
   */
  launch(request: AppLaunchRequest, appMetadata: AppMetadata): Promise<AppLaunchResult>
}
