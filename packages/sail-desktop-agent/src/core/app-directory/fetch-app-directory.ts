/**
 * FDC3 App Directory REST fetch utilities.
 *
 * Implements FDC3 2.2 GET /v2/apps fetching and URL validation.
 *
 * @see https://fdc3.finos.org/docs/2.0/app-directory/spec
 */

import type { DirectoryApp, DirectoryData } from "./types"

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

function validateApplication(app: DirectoryApp, source?: string): void {
  if (!app.appId || !app.title || !app.type || !app.details) {
    const sourceInfo = source ? ` in ${source}` : ""
    throw new Error(
      `Invalid application${sourceInfo}: missing required fields (appId, title, type, or details)`
    )
  }
}

export function validateApplications(applications: DirectoryApp[], source?: string): void {
  for (const app of applications) {
    validateApplication(app, source)
  }
}

export function parseAppDirectoryData(data: DirectoryApp[] | DirectoryData): DirectoryApp[] {
  return parseDirectoryData(data)
}

function normalizeDirectoryUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    if (urlObj.pathname.endsWith("/v2/apps")) {
      return url
    }
    const basePath = urlObj.pathname.replace(/\/$/, "")
    urlObj.pathname = `${basePath}/v2/apps`
    return urlObj.toString()
  } catch {
    return url
  }
}

/**
 * Validates a directory URL according to FDC3 specification (http/https REST endpoints).
 */
export function isValidDirectoryUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Fetches application directory data from a RESTful endpoint (FDC3 GET /v2/apps).
 */
export async function fetchAppDirectory(url: string): Promise<DirectoryApp[]> {
  try {
    const normalizedUrl = normalizeDirectoryUrl(url)
    const response = await fetch(normalizedUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${normalizedUrl}: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as
      | DirectoryData
      | { applications?: DirectoryApp[]; message?: string }

    const applications = parseDirectoryData(data as DirectoryApp[] | DirectoryData)
    validateApplications(applications, normalizedUrl)
    return applications
  } catch (error) {
    throw new Error(
      `Failed to fetch from ${url}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
