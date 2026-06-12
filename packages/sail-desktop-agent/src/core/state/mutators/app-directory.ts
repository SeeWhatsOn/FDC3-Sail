/**
 * App directory mutators — immutable updates to AgentState.appDirectory.
 */

import { produce } from "immer"
import type { AgentState } from "../types"
import type { DirectoryApp, DirectoryData } from "../../app-directory/types"
import {
  fetchAppDirectory,
  isValidDirectoryUrl,
  parseAppDirectoryData,
  validateApplications,
} from "../../app-directory/fetch-app-directory"
import { consoleLogger } from "../../interfaces/logger"

function mergeAppsWithoutDuplicates(
  existingApps: DirectoryApp[],
  incomingApps: DirectoryApp[]
): DirectoryApp[] {
  const existingAppIds = new Set(existingApps.map(app => app.appId))
  const newApps: DirectoryApp[] = []
  for (const app of incomingApps) {
    if (!existingAppIds.has(app.appId)) {
      existingAppIds.add(app.appId)
      newApps.push(app)
    }
  }
  return [...existingApps, ...newApps]
}

/** Adds a single app without duplicate or validation checks (tests / config seeding). */
export function addApplication(state: AgentState, app: DirectoryApp): AgentState {
  return produce(state, draft => {
    draft.appDirectory.apps.push(app)
  })
}

/** Adds apps from array or DirectoryData with validation and appId dedupe. */
export function addApplications(
  state: AgentState,
  data: DirectoryApp[] | DirectoryData
): AgentState {
  const applications = parseAppDirectoryData(data)
  validateApplications(applications)

  return produce(state, draft => {
    draft.appDirectory.apps = mergeAppsWithoutDuplicates(draft.appDirectory.apps, applications)
  })
}

/** Registers a directory URL without fetching. */
export function addDirectoryUrl(state: AgentState, url: string): AgentState {
  if (!url || typeof url !== "string") {
    throw new Error("Directory URL must be a non-empty string")
  }

  if (!isValidDirectoryUrl(url)) {
    throw new Error(
      `Invalid directory URL: ${url}. ` +
        `Must be a valid http/https REST endpoint. ` +
        `For file system operations, use utilities from @finos/sail-platform-api.`
    )
  }

  if (state.appDirectory.directoryUrls.includes(url)) {
    return state
  }

  return produce(state, draft => {
    draft.appDirectory.directoryUrls.push(url)
  })
}

export function removeDirectoryUrl(state: AgentState, url: string): AgentState {
  return produce(state, draft => {
    draft.appDirectory.directoryUrls = draft.appDirectory.directoryUrls.filter(u => u !== url)
  })
}

export function clearDirectoryUrls(state: AgentState): AgentState {
  return produce(state, draft => {
    draft.appDirectory.directoryUrls = []
  })
}

/** Fetches from a REST endpoint and merges apps into state (also registers the URL). */
export async function loadDirectoryIntoState(state: AgentState, url: string): Promise<AgentState> {
  try {
    let nextState = addDirectoryUrl(state, url)
    const apps = await fetchAppDirectory(url)
    nextState = produce(nextState, draft => {
      draft.appDirectory.apps = mergeAppsWithoutDuplicates(draft.appDirectory.apps, apps)
    })
    return nextState
  } catch (error) {
    const errorMessage = `Failed to load applications from ${url}: ${
      error instanceof Error ? error.message : String(error)
    }`
    consoleLogger.error(errorMessage)
    throw new Error(errorMessage)
  }
}

/** Replaces catalog apps and URLs, then loads from all given endpoints in parallel. */
export async function replaceAppDirectories(
  state: AgentState,
  urls: string[]
): Promise<AgentState> {
  if (!Array.isArray(urls)) {
    throw new Error("URLs must be an array")
  }

  if (urls.length === 0) {
    consoleLogger.info("No directories provided - cleared all applications and directory URLs")
    return produce(state, draft => {
      draft.appDirectory.apps = []
      draft.appDirectory.directoryUrls = []
    })
  }

  const invalidUrls = urls.filter(url => !isValidDirectoryUrl(url))
  if (invalidUrls.length > 0) {
    throw new Error(
      `Invalid directory URLs provided: ${invalidUrls.join(", ")}. ` +
        `Must be valid http/https REST endpoints. ` +
        `For file system operations, use utilities from @finos/sail-platform-api.`
    )
  }

  let nextState = produce(state, draft => {
    draft.appDirectory.apps = []
    draft.appDirectory.directoryUrls = [...urls]
  })

  const results = await Promise.allSettled(
    urls.map(async url => ({ url, apps: await fetchAppDirectory(url) }))
  )

  for (const result of results) {
    if (result.status === "fulfilled") {
      nextState = produce(nextState, draft => {
        draft.appDirectory.apps = mergeAppsWithoutDuplicates(
          draft.appDirectory.apps,
          result.value.apps
        )
      })
    }
  }

  const errors = results
    .map((result, index) =>
      result.status === "rejected"
        ? `Failed to load ${urls[index]}: ${(result.reason as Error).message || result.reason}`
        : null
    )
    .filter((error): error is string => error !== null)

  const successCount = results.filter(result => result.status === "fulfilled").length
  consoleLogger.info(
    `Loaded ${nextState.appDirectory.apps.length} apps from ${successCount}/${urls.length} directory source(s)`
  )

  if (errors.length > 0) {
    consoleLogger.warn("Some directories failed to load:", errors)
  }

  return nextState
}
