/**
 * FDC3 App Directory load helpers (REST /v2/apps + local FDC3-shaped JSON).
 */

import type { DirectoryApp } from "./DirectoryInterface"

/** FDC3 App Directory document wrapper (`GET …/v2/apps` response shape). */
export type DirectoryData = {
  applications: DirectoryApp[]
}

export function parseDirectoryData(
  data: DirectoryApp[] | DirectoryData,
): DirectoryApp[] {
  if (Array.isArray(data)) {
    return data
  }
  if (data.applications && Array.isArray(data.applications)) {
    return data.applications
  }
  throw new Error(
    "Invalid data format: expected array of DirectoryApp or DirectoryData with applications array",
  )
}

/** Fill title from deprecated/alternate `name` when title is missing (common in fixtures). */
export function ensureApplicationTitle(app: DirectoryApp): DirectoryApp {
  if (app.title) {
    return app
  }
  const name = (app as { name?: string }).name
  if (typeof name === "string" && name.length > 0) {
    app.title = name
  }
  return app
}

export function validateApplication(app: DirectoryApp, source?: string): void {
  ensureApplicationTitle(app)
  if (!app.appId || !app.title || !app.type || !app.details) {
    const sourceInfo = source ? ` in ${source}` : ""
    throw new Error(
      `Invalid application${sourceInfo}: missing required fields (appId, title, type, or details)`,
    )
  }
}

export function validateApplications(
  applications: DirectoryApp[],
  source?: string,
): void {
  for (const app of applications) {
    validateApplication(app, source)
  }
}

/**
 * Keep apps that pass validation; skip incomplete entries so one bad record
 * does not reject an entire directory document.
 */
export function acceptApplications(
  applications: DirectoryApp[],
  source?: string,
): DirectoryApp[] {
  const accepted: DirectoryApp[] = []
  for (const app of applications) {
    try {
      validateApplication(app, source)
      accepted.push(app)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.warn(
        `Skipping invalid application from ${source ?? "directory"}: ${reason}`,
      )
    }
  }
  return accepted
}

/**
 * Parse + validate host-supplied local App Directory JSON (bundled, storage, etc.).
 */
export function loadLocalDirectoryData(
  data: DirectoryApp[] | DirectoryData,
  source = "local",
): DirectoryApp[] {
  const applications = parseDirectoryData(data)
  validateApplications(applications, source)
  return applications
}

function normalizeDirectoryUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const basePath = urlObj.pathname.replace(/\/$/, "")
    // Static App Directory JSON documents are fetched as-is (not REST /v2/apps).
    if (basePath.toLowerCase().endsWith(".json")) {
      urlObj.pathname = basePath
      return urlObj.toString()
    }
    if (basePath.endsWith("/v2/apps")) {
      urlObj.pathname = basePath
      return urlObj.toString()
    }
    urlObj.pathname = `${basePath}/v2/apps`
    return urlObj.toString()
  } catch {
    return url
  }
}

/** Directory URLs must be http/https REST endpoints (FDC3 App Directory spec). */
export function isValidDirectoryUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === "http:" || urlObj.protocol === "https:"
  } catch {
    return false
  }
}

/** Fetches and validates apps from a remote /v2/apps endpoint or static JSON URL. */
export async function fetchAppDirectory(url: string): Promise<DirectoryApp[]> {
  try {
    const normalizedUrl = normalizeDirectoryUrl(url)
    const response = await fetch(normalizedUrl)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${normalizedUrl}: ${response.status} ${response.statusText}`,
      )
    }

    const data = (await response.json()) as DirectoryApp[] | DirectoryData
    const applications = acceptApplications(
      parseDirectoryData(data),
      normalizedUrl,
    )
    if (applications.length === 0) {
      throw new Error(`No valid applications found at ${normalizedUrl}`)
    }
    return applications
  } catch (error) {
    throw new Error(
      `Failed to fetch from ${url}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/** Merges apps without duplicate appIds (first wins). */
export function mergeAppsWithoutDuplicates(
  existingApps: DirectoryApp[],
  incomingApps: DirectoryApp[],
): DirectoryApp[] {
  const existingAppIds = new Set(existingApps.map((app) => app.appId))
  const newApps: DirectoryApp[] = []
  for (const app of incomingApps) {
    if (!existingAppIds.has(app.appId)) {
      existingAppIds.add(app.appId)
      newApps.push(app)
    }
  }
  return [...existingApps, ...newApps]
}
