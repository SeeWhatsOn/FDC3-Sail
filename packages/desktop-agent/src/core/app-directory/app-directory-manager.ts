/**
 * AppDirectoryManager - FDC3 Application Directory Implementation
 *
 * This module implements the FDC3 App Directory specification, which defines
 * app directories as RESTful web services. According to FDC3 2.2:
 * - App directories MUST support GET /v2/apps (all applications)
 * - App directories MUST support GET /v2/apps/{appId} (specific application)
 *
 * This implementation:
 * - Provides query functionality over a set of apps (retrieveApps, retrieveIntents, etc.)
 * - Validates directory URLs (must be http/https REST endpoints)
 * - Manages a list of directory URLs (multiple directories supported)
 * - Fetches applications from RESTful endpoints
 * - Validates directory responses against FDC3 schema
 *
 * NOTE: File system operations are not part of the FDC3 spec and are handled
 * by utilities in @finos/sail-platform-sdk for Node.js environments.
 *
 * @see https://fdc3.finos.org/docs/2.0/app-directory/spec
 */

import type { DirectoryApp, DirectoryData, DirectoryIntent, WebAppDetails } from "./types"

/**
 * Helper function to check if result types match
 * @param real - The actual result type
 * @param required - The required result type
 * @returns true if types match (both undefined or both the same string)
 */
function genericResultTypeSame(
  real: string | undefined,
  required: string | undefined
): boolean {
  if (required === undefined) {
    return true
  }
  if (real === undefined) {
    return false
  }
  return real === required
}

/**
 * Parses directory data from various formats into an array of DirectoryApp
 * Supports both array format and DirectoryData format
 *
 * @param data - Either an array of DirectoryApp or DirectoryData object
 * @returns Array of DirectoryApp entries
 * @throws Error if data format is invalid
 */
function parseDirectoryData(data: DirectoryApp[] | DirectoryData): DirectoryApp[] {
  if (Array.isArray(data)) {
    return data
  }
  if (data.applications && Array.isArray(data.applications)) {
    return data.applications
  }
  throw new Error(
    "Invalid data format: expected array of DirectoryApp or DirectoryData with applications array"
  )
}

/**
 * Validates that an application has all required fields
 *
 * @param app - The application to validate
 * @param source - Optional source identifier for error messages
 * @throws Error if required fields are missing
 */
function validateApplication(app: DirectoryApp, source?: string): void {
  if (!app.appId || !app.title || !app.type || !app.details) {
    const sourceInfo = source ? ` in ${source}` : ""
    throw new Error(
      `Invalid application${sourceInfo}: missing required fields (appId, title, type, or details)`
    )
  }
}

/**
 * Validates multiple applications
 *
 * @param applications - Array of applications to validate
 * @param source - Optional source identifier for error messages
 * @throws Error if any application is missing required fields
 */
function validateApplications(applications: DirectoryApp[], source?: string): void {
  for (const app of applications) {
    validateApplication(app, source)
  }
}

/**
 * Normalizes a directory URL to point to the /v2/apps endpoint
 * If the URL already ends with /v2/apps, returns as-is
 * Otherwise, appends /v2/apps to the base URL
 *
 * @param url - The directory base URL
 * @returns Normalized URL pointing to /v2/apps endpoint
 */
function normalizeDirectoryUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // If URL already ends with /v2/apps, return as-is
    if (urlObj.pathname.endsWith("/v2/apps")) {
      return url
    }
    // Remove trailing slash if present
    const basePath = urlObj.pathname.replace(/\/$/, "")
    // Append /v2/apps endpoint
    urlObj.pathname = `${basePath}/v2/apps`
    return urlObj.toString()
  } catch {
    // If URL parsing fails, return original (will be caught by validation)
    return url
  }
}

/**
 * Validates a directory URL according to FDC3 specification
 * Directory URLs must be http/https REST endpoints
 *
 * @param url - The URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidDirectoryUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    // Must be http or https
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false
    }
    // Should be a valid URL format
    return true
  } catch {
    return false
  }
}

/**
 * AppDirectoryManager - FDC3 application directory with RESTful endpoint support
 *
 * Implements the FDC3 App Directory specification for managing applications
 * from RESTful web services. Supports multiple directory endpoints and validates
 * responses according to the FDC3 2.2 specification.
 *
 * Features:
 * - Query functionality (retrieveApps, retrieveIntents, retrieveAppsById, etc.)
 * - RESTful endpoint loading (FDC3-compliant /v2/apps endpoints)
 * - Multiple directory support (aggregates apps from multiple sources)
 * - Directory URL validation
 * - Response validation (FDC3 schema compliance)
 * - Parallel loading from multiple sources
 * - Duplicate application prevention (by appId)
 * - URL-based application filtering
 */
export class AppDirectoryManager {
  /**
   * Array of all applications in the directory
   */
  public allApps: DirectoryApp[]

  /**
   * List of configured directory URLs (RESTful endpoints)
   * Multiple directories can be configured per FDC3 spec
   */
  private directoryUrls: string[] = []

  /**
   * Creates a new AppDirectoryManager instance with an empty directory.
   *
   * Load apps after construction using:
   * - `loadDirectory(url)` - Load from REST endpoint
   * - `addApplications(data)` - Add from JSON data (files, in-memory)
   * - `add(app)` - Add a single app (mainly for testing)
   *
   * @example
   * ```typescript
   * const directory = new AppDirectoryManager()
   * await directory.loadDirectory("https://example.com/v2/apps")
   * ```
   */
  constructor() {
    this.allApps = []
  }

  /**
   * Fetches application directory data from a RESTful endpoint
   * Implements FDC3 2.2 GET /v2/apps endpoint
   *
   * @param url - The RESTful endpoint URL (will be normalized to /v2/apps)
   * @returns Promise resolving to array of DirectoryApp entries
   * @throws Error if fetch fails, response format is invalid, or not FDC3-compliant
   */
  private async fetchRemoteAppDirectory(url: string): Promise<DirectoryApp[]> {
    try {
      // Normalize URL to /v2/apps endpoint
      const normalizedUrl = normalizeDirectoryUrl(url)

      // Fetch data from RESTful endpoint
      const response = await fetch(normalizedUrl)
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${normalizedUrl}: ${response.status} ${response.statusText}`
        )
      }

      // Parse JSON response
      const data = (await response.json()) as DirectoryData | { applications?: DirectoryApp[]; message?: string }

      // FDC3 spec: /v2/apps returns AllApplicationsResponse with applications array
      // Support both formats: { applications: [...] } and direct array (for compatibility)
      const applications = parseDirectoryData(data as DirectoryApp[] | DirectoryData)

      // Validate each application has required fields
      validateApplications(applications, normalizedUrl)

      return applications
    } catch (error) {
      // Provide more context in error messages
      throw new Error(
        `Failed to fetch from ${url}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Validates a directory URL and adds it to the list of configured directories
   * Does not fetch immediately - use loadDirectory() or replace() to fetch
   *
   * @param url - RESTful endpoint URL (http/https) to add
   * @throws Error if URL is invalid
   */
  addDirectoryUrl(url: string): void {
    if (!url || typeof url !== "string") {
      throw new Error("Directory URL must be a non-empty string")
    }

    if (!isValidDirectoryUrl(url)) {
      throw new Error(
        `Invalid directory URL: ${url}. ` +
          `Must be a valid http/https REST endpoint. ` +
          `For file system operations, use utilities from @finos/sail-platform-sdk.`
      )
    }

    // Add to list if not already present
    if (!this.directoryUrls.includes(url)) {
      this.directoryUrls.push(url)
    }
  }

  /**
   * Gets the list of configured directory URLs
   *
   * @returns Array of directory URLs
   */
  getDirectoryUrls(): string[] {
    return [...this.directoryUrls]
  }

  /**
   * Removes a directory URL from the list
   *
   * @param url - The directory URL to remove
   */
  removeDirectoryUrl(url: string): void {
    this.directoryUrls = this.directoryUrls.filter(u => u !== url)
  }

  /**
   * Clears all configured directory URLs
   */
  clearDirectoryUrls(): void {
    this.directoryUrls = []
  }

  /**
   * Loads applications from a RESTful endpoint and adds them to the directory
   * Prevents duplicate applications based on appId
   * Also adds the URL to the configured directories list
   *
   * @param url - RESTful endpoint URL (http/https) to load applications from
   * @throws Error if URL is invalid, loading fails, or data format is invalid
   */
  async loadDirectory(url: string): Promise<void> {
    try {
      // Validate and add to directory list
      this.addDirectoryUrl(url)

      // Fetch from remote endpoint
      const apps = await this.fetchRemoteAppDirectory(url)

      // Add non-duplicate apps based on appId
      const existingAppIds = new Set(this.allApps.map(app => app.appId))
      const newApps = apps.filter(app => !existingAppIds.has(app.appId))
      this.allApps.push(...newApps)
    } catch (error) {
      const errorMessage = `Failed to load applications from ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`

      console.error(errorMessage)
      throw new Error(errorMessage) // Re-throw to ensure caller is aware of the failure
    }
  }

  /**
   * Replaces all currently loaded apps with new ones from multiple RESTful endpoints
   * Updates the configured directory URLs list and fetches from all directories
   * Uses parallel loading for better performance and provides comprehensive error reporting
   *
   * @param urls - Array of RESTful endpoint URLs (http/https) to load applications from
   * @throws Error if urls parameter is not an array
   * @throws Error if any URL is invalid (not http/https)
   */
  async replace(urls: string[]): Promise<void> {
    if (!Array.isArray(urls)) {
      throw new Error("URLs must be an array")
    }

    if (urls.length === 0) {
      this.allApps = []
      this.directoryUrls = []
      console.log("No directories provided - cleared all applications and directory URLs")
      return
    }

    // Validate all URLs before attempting to load
    const invalidUrls = urls.filter(url => !isValidDirectoryUrl(url))
    if (invalidUrls.length > 0) {
      throw new Error(
        `Invalid directory URLs provided: ${invalidUrls.join(", ")}. ` +
          `Must be valid http/https REST endpoints. ` +
          `For file system operations, use utilities from @finos/sail-platform-sdk.`
      )
    }

    // Update directory URLs list
    this.directoryUrls = [...urls]

    // Clear existing applications
    this.allApps = []

    // Load from all sources in parallel using Promise.allSettled
    // This allows partial success even if some sources fail
    const results = await Promise.allSettled(urls.map(url => this.loadDirectory(url)))

    // Collect errors using filter + map (more functional approach)
    const errors = results
      .map((result, index) =>
        result.status === "rejected"
          ? `Failed to load ${urls[index]}: ${(result.reason as Error).message || result.reason}`
          : null
      )
      .filter((error): error is string => error !== null)

    // Log results summary
    const successCount = results.filter(result => result.status === "fulfilled").length
    console.log(
      `Loaded ${this.allApps.length} apps from ${successCount}/${urls.length} directory source(s)`
    )

    if (errors.length > 0) {
      console.warn("Some directories failed to load:", errors)
    }
  }

  /**
   * Adds a single application to the directory
   * Note: This method does not check for duplicates or validate the application.
   * For adding multiple apps with validation and duplicate checking, use addApplications().
   *
   * @param app - The DirectoryApp to add
   */
  add(app: DirectoryApp): void {
    this.allApps.push(app)
  }

  /**
   * Adds multiple applications directly from JSON data
   * Bypasses REST endpoint validation - useful for loading from files or dynamic sources
   *
   * Accepts either:
   * - Array of applications: `[{ appId: "...", ... }, ...]`
   * - DirectoryData format: `{ applications: [...] }`
   *
   * Prevents duplicate applications based on appId and validates required fields
   *
   * @param data - Either an array of DirectoryApp or DirectoryData object
   * @throws Error if data format is invalid or applications are missing required fields
   */
  addApplications(data: DirectoryApp[] | DirectoryData): void {
    // Parse data format
    const applications = parseDirectoryData(data)

    // Validate all applications
    validateApplications(applications)

    // Prevent duplicates based on appId
    const existingAppIds = new Set(this.allApps.map(app => app.appId))
    const newApps = applications.filter(app => !existingAppIds.has(app.appId))

    // Add non-duplicate apps
    this.allApps.push(...newApps)
  }

  /**
   * Retrieves all web applications that match a specific URL
   * Useful for finding applications associated with a particular website
   *
   * @param url - The URL to search for in web application details
   * @returns Array of DirectoryApp entries matching the URL
   */
  retrieveAppsByUrl(url: string): DirectoryApp[] {
    // Return empty array for invalid input
    if (!url || typeof url !== "string") {
      return []
    }

    // Filter for web apps matching the specified URL
    return this.retrieveAllApps().filter(
      app => app.type === "web" && (app.details as WebAppDetails)?.url === url
    )
  }

  // ============================================================================
  // Query Methods (previously in AppDirectory)
  // ============================================================================

  /**
   * Checks if an intent matches the given criteria
   * @param intent - The intent definition to check
   * @param contextType - Optional context type to match
   * @param intentName - Optional intent name to match
   * @param resultType - Optional result type to match
   * @returns true if the intent matches all provided criteria
   */
  private intentMatches(
    intent: DirectoryIntent,
    contextType: string | undefined,
    intentName: string | undefined,
    resultType: string | undefined
  ): boolean {
    // Check intent name if provided
    if (intentName !== undefined && intent.intentName !== intentName) {
      return false
    }

    // Check context type if provided
    if (contextType !== undefined && !intent.contexts.includes(contextType)) {
      return false
    }

    // Check result type if provided
    if (!genericResultTypeSame(intent.resultType, resultType)) {
      return false
    }

    return true
  }

  /**
   * Retrieves all intents for a specific app
   * @param app - The application to get intents for
   * @returns Array of DirectoryIntent objects for the app
   */
  private retrieveIntentsForApp(app: DirectoryApp): DirectoryIntent[] {
    const listensFor = app.interop?.intents?.listensFor
    if (!listensFor || typeof listensFor !== "object") {
      return []
    }

    return Object.entries(listensFor).map(([intentName, intentDef]) => ({
      name: intentName,
      intentName,
      appId: app.appId,
      contexts: intentDef.contexts,
      resultType: intentDef.resultType,
      displayName: intentDef.displayName,
      customConfig: intentDef.customConfig,
    }))
  }

  /**
   * Retrieves all intents from all apps in the directory
   * @returns Array of all DirectoryIntent objects
   */
  retrieveAllIntents(): DirectoryIntent[] {
    return this.allApps.flatMap(app => this.retrieveIntentsForApp(app))
  }

  /**
   * Retrieves intents matching the given criteria
   * @param contextType - Optional context type to filter by
   * @param intentName - Optional intent name to filter by
   * @param resultType - Optional result type to filter by
   * @returns Array of DirectoryIntent objects matching the criteria
   */
  retrieveIntents(
    contextType: string | undefined,
    intentName: string | undefined,
    resultType: string | undefined
  ): DirectoryIntent[] {
    // Early return if no filters provided
    if (contextType === undefined && intentName === undefined && resultType === undefined) {
      return this.retrieveAllIntents()
    }

    // Filter during iteration for better performance
    return this.allApps.flatMap(app => {
      const appIntents = this.retrieveIntentsForApp(app)
      return appIntents.filter(intent =>
        this.intentMatches(intent, contextType, intentName, resultType)
      )
    })
  }

  /**
   * Retrieves apps matching the given criteria
   * @param contextType - Optional context type to filter by
   * @param intentName - Optional intent name to filter by
   * @param resultType - Optional result type to filter by
   * @returns Array of DirectoryApp objects matching the criteria
   */
  retrieveApps(
    contextType: string | undefined,
    intentName?: string ,
    resultType?: string 
  ): DirectoryApp[] {
    // Early return if no filters provided
    if (contextType === undefined && intentName === undefined && resultType === undefined) {
      return [...this.allApps]
    }

    // Get unique app IDs from matching intents
    // Convert optional parameters to required undefined for retrieveIntents
    const appIds = new Set(
      this.retrieveIntents(contextType, intentName ?? undefined, resultType ?? undefined).map(intent => intent.appId)
    )

    return this.allApps.filter(app => appIds.has(app.appId))
  }

  /**
   * Retrieves apps by their appId
   * @param appId - The application ID to search for
   * @returns Array of DirectoryApp objects with the given appId
   */
  retrieveAppsById(appId: string): DirectoryApp[] {
    return this.allApps.filter(app => app.appId === appId)
  }

  /**
   * Retrieves all apps in the directory
   * @returns Array of all DirectoryApp objects
   */
  retrieveAllApps(): DirectoryApp[] {
    return [...this.allApps]
  }
}
