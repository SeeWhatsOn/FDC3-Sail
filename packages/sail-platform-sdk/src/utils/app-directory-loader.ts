/**
 * App Directory Loader - Utility for loading FDC3 app directories
 *
 * This utility handles loading app directories from both file system (Node.js)
 * and RESTful endpoints (universal). It's designed for use in Node.js environments
 * where file system access is available.
 *
 * For browser environments, use AppDirectoryManager.loadDirectory() directly
 * with RESTful endpoint URLs.
 */

import {
  AppDirectoryManager,
  isValidDirectoryUrl,
  type DirectoryApp,
  type DirectoryData,
} from "@finos/fdc3-sail-desktop-agent"
import { promises as fs } from "node:fs"
import { constants } from "node:fs"

/**
 * Interface that explicitly includes the addApplications method
 * This helps ESLint's type checker recognize the method
 */
interface AppDirectoryWithAddApplications {
  addApplications(data: DirectoryApp[] | DirectoryData): void
}

/**
 * Type-safe helper to call addApplications method
 * Uses interface to help ESLint's type checker resolve the method
 */
function addApplicationsToDirectory(
  appDirectory: AppDirectoryManager,
  data: DirectoryApp[] | DirectoryData
): void {
  // Type assertion to interface that explicitly includes the method
  const directory: AppDirectoryWithAddApplications = appDirectory as AppDirectoryWithAddApplications
  directory.addApplications(data)
}

/**
 * Determines if a URI is a valid URL (http/https)
 * Uses the shared validation function from desktop-agent for consistency
 */
function isValidUrl(uri: string): boolean {
  return isValidDirectoryUrl(uri)
}

/**
 * Checks if a file path exists and is accessible
 */
async function isValidFilePath(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, constants.R_OK)
    const stats = await fs.stat(filePath)
    return stats.isFile()
  } catch {
    return false
  }
}

/**
 * Reads application directory data from a local file
 * Supports both formats:
 * - Array format: [{ appId: "...", ... }, ...]
 * - DirectoryData format: { applications: [...] }
 *
 * @param filePath - Path to the local JSON file containing directory data
 * @returns Promise resolving to DirectoryData (can be passed directly to addApplications)
 * @throws Error if file cannot be read or data format is invalid
 */
async function readLocalAppDirectory(filePath: string): Promise<DirectoryData | DirectoryApp[]> {
  try {
    // Read file contents as UTF-8 string
    const data = await fs.readFile(filePath, { encoding: "utf8" })

    // Parse JSON
    const parsed = JSON.parse(data) as DirectoryData | DirectoryApp[]

    // Support both array and DirectoryData formats
    if (Array.isArray(parsed)) {
      // Direct array format: [{ appId: "...", ... }, ...]
      return parsed
    } else if (parsed.applications && Array.isArray(parsed.applications)) {
      // DirectoryData format: { applications: [...] }
      return parsed
    } else {
      throw new Error(
        `Invalid data format in ${filePath}: expected array of applications or DirectoryData with applications array`
      )
    }
  } catch (error) {
    // Provide more context in error messages
    if (error instanceof Error) {
      throw new Error(`Failed to load file ${filePath}: ${error.message}`)
    }
    throw error
  }
}


/**
 * Loads applications from a single source (file path or URL) and adds them to the directory
 * Prevents duplicate applications based on appId
 *
 * @param appDirectory - The AppDirectoryManager instance to load apps into
 * @param source - File path or URL to load applications from
 * @throws Error if loading fails
 */
export async function loadAppDirectorySource(
  appDirectory: AppDirectoryManager,
  source: string
): Promise<void> {
  try {
    // Validate input parameter
    if (!source || typeof source !== "string") {
      throw new Error("Source must be a non-empty string")
    }

    if (isValidUrl(source)) {
      // Handle as remote URL - use the AppDirectoryManager's built-in method
      await appDirectory.loadDirectory(source)
      return
    } else {
      // Handle as local file path
      const isValidFile = await isValidFilePath(source)
      if (!isValidFile) {
        throw new Error(`File does not exist or is not accessible: ${source}`)
      }
      // Read file data (supports both array and DirectoryData formats)
      const fileData = await readLocalAppDirectory(source)
      // Use addApplications() which handles both formats, duplicates, and validation
      addApplicationsToDirectory(appDirectory, fileData)
    }
  } catch (error) {
    const errorMessage = `Failed to load applications from ${source}: ${
      error instanceof Error ? error.message : String(error)
    }`

    console.error(errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * Replaces all currently loaded apps with new ones from multiple sources (files and/or URLs)
 * Uses parallel loading for better performance and provides comprehensive error reporting
 *
 * Strategy:
 * 1. Load all apps from files into memory
 * 2. Use AppDirectoryManager.replace() for URLs (clears and loads URLs)
 * 3. Add file-based apps to the directory
 *
 * @param appDirectory - The AppDirectoryManager instance to load apps into
 * @param sources - Array of file paths and/or URLs to load applications from
 * @throws Error if sources parameter is not an array
 */
export async function replaceAppDirectories(
  appDirectory: AppDirectoryManager,
  sources: string[]
): Promise<void> {
  if (!Array.isArray(sources)) {
    throw new Error("Sources must be an array")
  }

  if (sources.length === 0) {
    // Clear directory by replacing with empty URL array
    await appDirectory.replace([])
    return
  }

  // Separate URLs from file paths
  const urls: string[] = []
  const filePaths: string[] = []

  for (const source of sources) {
    if (isValidUrl(source)) {
      urls.push(source)
    } else {
      filePaths.push(source)
    }
  }

  // Step 1: Load all apps from files into memory (in parallel)
  const fileAppsData: (DirectoryApp[] | DirectoryData)[] = []
  if (filePaths.length > 0) {
    const fileResults = await Promise.allSettled(
      filePaths.map(filePath => readLocalAppDirectory(filePath))
    )

    // Collect successful loads and errors
    const errors: string[] = []
    for (let i = 0; i < fileResults.length; i++) {
      const result = fileResults[i]
      if (result.status === "fulfilled") {
        fileAppsData.push(result.value)
      } else {
        errors.push(
          `Failed to load ${filePaths[i]}: ${(result.reason as Error).message || result.reason}`
        )
      }
    }

    if (errors.length > 0) {
      console.warn("Some file sources failed to load:", errors)
    }
  }

  // Step 2: Replace directory with URLs (this clears existing apps and loads URLs)
  if (urls.length > 0) {
    await appDirectory.replace(urls)
  } else {
    // If no URLs, clear the directory first
    await appDirectory.replace([])
  }

  // Step 3: Add file-based apps (addApplications handles duplicates and both formats)
  for (const fileData of fileAppsData) {
    appDirectory.addApplications(fileData)
  }

  // Log results summary
  const totalApps = appDirectory.retrieveAllApps().length
  console.log(
    `Loaded ${totalApps} apps from ${sources.length} source(s) ` +
      `(${urls.length} URL(s), ${filePaths.length} file(s))`
  )
}

/**
 * Adds applications directly from JSON data to the directory
 * Bypasses file system and REST endpoint validation
 * Useful for dynamically loading apps from JSON strings or objects
 *
 * @param appDirectory - The AppDirectoryManager instance to add apps to
 * @param data - JSON data as string, object, or parsed data
 *              Supports: DirectoryApp[], DirectoryData, or JSON string
 * @throws Error if data format is invalid
 */
export function addApplicationsFromJson(
  appDirectory: AppDirectoryManager,
  data: string | DirectoryApp[] | DirectoryData
): void {
  let parsedData: DirectoryApp[] | DirectoryData

  // Handle string input (JSON string)
  if (typeof data === "string") {
    try {
      parsedData = JSON.parse(data) as DirectoryApp[] | DirectoryData
    } catch (error) {
      throw new Error(
        `Invalid JSON string: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  } else {
    // Already parsed object
    parsedData = data
  }

  // Use AppDirectoryManager's addApplications method
  // This handles both array and DirectoryData formats, validation, and duplicates
  addApplicationsToDirectory(appDirectory, parsedData)
}
