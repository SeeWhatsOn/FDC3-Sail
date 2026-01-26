/**
 * AppLauncher Interface
 *
 * Abstraction for launching FDC3 applications. Implementations handle
 * environment-specific launching (browser tabs/iframes, Electron windows,
 * native processes, etc.)
 */

import type { AppMetadata, AppIdentifier, BrowserTypes } from "@finos/fdc3"

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
   * - Joining any requested channel (if applicable)
   * - Delivering launch context (if specified)
   * - Sending the FDC3 response
   *
   * @param request - Launch request with app identifier and context
   * @param appMetadata - App metadata from directory (for launch details)
   * @returns Promise resolving to launched app identifier
   * @throws Error if launch fails (Desktop Agent will convert to FDC3 error response)
   */
  launch(
    request: BrowserTypes.OpenRequestPayload,
    appMetadata: AppMetadata
  ): Promise<AppIdentifier>
 }
