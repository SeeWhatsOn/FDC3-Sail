/**
 * Intent Handler Helper Functions
 *
 * Pure helper functions used by intent handlers.
 * Extracted to reduce file size of intent-handlers.ts.
 */

import type { Context } from "@finos/fdc3"
import type { AgentState, IntentListener } from "../../../state/types"
import type { AppDirectoryManager } from "../../../app-directory/app-directory-manager"
import type { DACPHandlerContext } from "../../types"
import {
  getInstance,
  getInstancesByAppId,
  getActiveListenersForIntent,
  getAllIntentListeners,
} from "../../../state/selectors"
import { AppInstanceState } from "../../../state/types"

/**
 * Map to store promise functions for pending intents.
 * These CANNOT be stored in AgentState (not serializable).
 *
 * Key: requestId
 * Value: Promise resolve/reject functions and timeout handle
 */
export const pendingIntentPromises = new Map<
  string,
  {
    resolve: (result: unknown) => void
    reject: (error: Error) => void
    timeoutHandle?: NodeJS.Timeout
  }
>()


/**
 * Helper to check if context type is compatible with supported types
 */
 function isContextTypeCompatible(supportedTypes: string[], contextType: string): boolean {
  if (supportedTypes.length === 0) {
    return true // Accepts all context types
  }
  return supportedTypes.includes(contextType) || supportedTypes.includes("*")
}

/**
 * Helper to check if result types match
 */
 function isResultTypeCompatible(
  actualResultType: string | undefined,
  requiredResultType: string | undefined
): boolean {
  if (requiredResultType === undefined) {
    return true
  }
  if (actualResultType === undefined) {
    return false
  }
  return actualResultType === requiredResultType
}

/**
 * Helper to find intent handlers using state and app directory
 * Replaces intentRegistry.findIntentHandlers()
 */
export function findIntentHandlers(
  state: AgentState,
  appDirectory: AppDirectoryManager,
  request: {
    intent: string
    context: Context
    target?: { appId: string; instanceId?: string }
    source?: { appId: string; instanceId?: string }
  }
): {
  runningListeners: IntentListener[]
  availableApps: Array<{
    intentName: string
    appId: string
    contextTypes: string[]
    resultType?: string
    displayName?: string
  }>
  compatibleApps: (IntentListener | {
    intentName: string
    appId: string
    contextTypes: string[]
    resultType?: string
    displayName?: string
  })[]
} {
  const { intent, context, target, source } = request

  // Get running listeners for this intent
  let runningListeners = getActiveListenersForIntent(state, intent)

  // Filter by context type compatibility
  runningListeners = runningListeners.filter(l =>
    isContextTypeCompatible(l.contextTypes, context.type)
  )

  // Filter out the source instance from running listeners
  if (source?.instanceId) {
    runningListeners = runningListeners.filter(
      listener => listener.instanceId !== source.instanceId
    )
  }

  // Filter by target if specified
  if (target?.appId) {
    runningListeners = runningListeners.filter(listener => listener.appId === target.appId)
  }

  // Get app capabilities from app directory
  const allApps = appDirectory.retrieveAllApps()
  let availableApps = allApps
    .filter(app => {
      const intents = app.interop?.intents?.listensFor
      if (!intents || typeof intents !== "object") return false
      const intentDef = intents[intent]
      if (!intentDef || typeof intentDef !== "object" || !("contexts" in intentDef)) return false
      const contextTypes = Array.isArray(intentDef.contexts) ? intentDef.contexts : []
      return isContextTypeCompatible(contextTypes, context.type)
    })
    .map(app => {
      const intents = app.interop?.intents?.listensFor
      const intentDef = intents?.[intent]
      const contextTypes = Array.isArray(intentDef?.contexts) ? intentDef.contexts : []
      return {
        intentName: intent,
        appId: app.appId,
        contextTypes,
        resultType: typeof intentDef?.resultType === "string" ? intentDef.resultType : undefined,
        displayName: typeof intentDef?.displayName === "string" ? intentDef.displayName : undefined,
      }
    })

  // Filter by target if specified
  if (target?.appId) {
    availableApps = availableApps.filter(capability => capability.appId === target.appId)
  }

  // Combine and deduplicate (prefer running listeners)
  const runningAppIds = new Set(runningListeners.map(l => l.appId))
  const compatibleApps: (IntentListener | typeof availableApps[0])[] = [
    ...runningListeners,
    ...availableApps.filter(app => !runningAppIds.has(app.appId)),
  ]

  return {
    runningListeners,
    availableApps,
    compatibleApps,
  }
}

/**
 * Helper to create AppIntent objects for FDC3 API responses
 * Replaces intentRegistry.createAppIntents()
 * Includes both apps from directory and running instances with intent listeners
 */
export function createAppIntents(
  state: AgentState,
  appDirectory: AppDirectoryManager,
  intentName: string,
  contextType?: string,
  resultType?: string
): Array<{
  intent: { name: string; displayName?: string }
  apps: Array<{ appId: string; name?: string; version?: string; instanceId?: string }>
}> {
  const allApps = appDirectory.retrieveAllApps()
  const appIntentsMap = new Map<
    string,
    {
      intent: { name: string; displayName?: string }
      apps: Array<{ appId: string; name?: string; version?: string; instanceId?: string }>
    }
  >()

  // Get running listeners for this intent
  let runningListeners = getActiveListenersForIntent(state, intentName)

  // Filter by context type if provided
  if (contextType) {
    runningListeners = runningListeners.filter(listener =>
      isContextTypeCompatible(listener.contextTypes, contextType)
    )
  }

  // Filter out listeners for terminated instances
  const validRunningListeners = runningListeners.filter(listener => {
    const instance = getInstance(state, listener.instanceId)
    return instance && instance.state !== AppInstanceState.TERMINATED
  })

  // Filter running listeners by resultType if provided
  // Check resultType from app directory for each listener's app
  // Note: resultType can be undefined (from "{empty}"), which means "no result type"
  // When resultType is undefined, include all running instances
  // When resultType is defined, only include running instances that match (must be in directory)
  const filteredRunningListeners =
    resultType !== undefined
      ? validRunningListeners.filter(listener => {
          const apps = appDirectory.retrieveAppsById(listener.appId)
          const appInfo = apps[0]
          if (!appInfo) {
            // If app is not in directory, we can't check resultType, so exclude it
            // (only apps in directory can be filtered by resultType)
            return false
          }
          const intents = appInfo.interop?.intents?.listensFor
          if (!intents || typeof intents !== "object") return false
          const intentDef = intents[intentName]
          if (!intentDef || typeof intentDef !== "object") return false
          const actualResultType =
            typeof intentDef.resultType === "string" ? intentDef.resultType : undefined
          return isResultTypeCompatible(actualResultType, resultType)
        })
      : validRunningListeners

  // Track which appIds have running instances
  const runningAppIds = new Set(filteredRunningListeners.map(l => l.appId))

  // First, add apps from directory (those without running instances will be added)
  allApps.forEach(app => {
    const intents = app.interop?.intents?.listensFor
    if (!intents || typeof intents !== "object") return
    const intentDef = intents[intentName]
    if (!intentDef || typeof intentDef !== "object" || !("contexts" in intentDef)) return

    const contextTypes = Array.isArray(intentDef.contexts) ? intentDef.contexts : []
    if (contextType && !isContextTypeCompatible(contextTypes, contextType)) return

    // Filter by resultType if provided
    // Note: resultType can be undefined (from "{empty}"), which means "no result type"
    const actualResultType =
      typeof intentDef.resultType === "string" ? intentDef.resultType : undefined
    if (resultType !== undefined && !isResultTypeCompatible(actualResultType, resultType)) return

    // Skip if this app has running instances (we'll add those separately)
    if (runningAppIds.has(app.appId)) return

    if (!appIntentsMap.has(intentName)) {
      appIntentsMap.set(intentName, {
        intent: {
          name: intentName,
          displayName:
            typeof intentDef.displayName === "string" ? intentDef.displayName : intentName,
        },
        apps: [],
      })
    }

    const appIntent = appIntentsMap.get(intentName)!
    appIntent.apps.push({
      appId: app.appId,
      name: app.name,
      version: app.version,
      // No instanceId for directory apps
    })
  })

  // Then, add running instances with their instanceId
  if (filteredRunningListeners.length > 0) {
    if (!appIntentsMap.has(intentName)) {
      // Get display name from first listener's app directory entry if available
      const firstListener = filteredRunningListeners[0]
      const apps = appDirectory.retrieveAppsById(firstListener.appId)
      const appInfo = apps[0]
      const intentDef = appInfo?.interop?.intents?.listensFor?.[intentName]
      const displayName =
        typeof intentDef === "object" && intentDef && "displayName" in intentDef
          ? (intentDef.displayName as string)
          : intentName

      appIntentsMap.set(intentName, {
        intent: {
          name: intentName,
          displayName,
        },
        apps: [],
      })
    }

    const appIntent = appIntentsMap.get(intentName)!
    filteredRunningListeners.forEach(listener => {
      const instance = getInstance(state, listener.instanceId)
      if (!instance) return

      const apps = appDirectory.retrieveAppsById(listener.appId)
      const appInfo = apps[0] // Take first matching app

      appIntent.apps.push({
        appId: listener.appId,
        name: appInfo?.name,
        version: appInfo?.version,
        instanceId: listener.instanceId,
      })
    })
  }

  return Array.from(appIntentsMap.values())
}

/**
 * Helper to find intents by context type
 * Replaces intentRegistry.findIntentsByContext()
 */
export function findIntentsByContext(
  state: AgentState,
  appDirectory: AppDirectoryManager,
  contextType: string
): Array<{ name: string; displayName?: string }> {
  const intentNames = new Set<string>()

  // Get intents from active listeners
  const allListeners = getAllIntentListeners(state)
  allListeners.forEach(listener => {
    if (listener.active && isContextTypeCompatible(listener.contextTypes, contextType)) {
      intentNames.add(listener.intentName)
    }
  })

  // Get intents from app directory
  const allApps = appDirectory.retrieveAllApps()
  allApps.forEach(app => {
    const intents = app.interop?.intents?.listensFor
    if (!intents || typeof intents !== "object") return
    Object.entries(intents).forEach(([intentName, intentDef]) => {
      if (intentDef && typeof intentDef === "object" && "contexts" in intentDef) {
        const contextTypes = Array.isArray(intentDef.contexts) ? intentDef.contexts : []
        if (isContextTypeCompatible(contextTypes, contextType)) {
          intentNames.add(intentName)
        }
      }
    })
  })

  return Array.from(intentNames).map(name => ({
    name,
    displayName: name, // Could be enhanced to get from app directory
  }))
}

/**
 * Helper function to launch an app and wait for it to be registered
 *
 * Per FDC3 spec: "Allow, by default, at least a 15 second timeout for an application,
 * launched via fdc3.open, fdc3.raiseIntent or fdc3.raiseIntentForContext to add any
 * context listener (via fdc3.addContextListener) or intent listener (via fdc3.addIntentListener)
 * necessary to deliver context or intent and context to it on launch."
 *
 * This function waits for any NEW instance of the app to be created and connected,
 * rather than waiting for a specific instanceId, since the Desktop Agent may create
 * a different instanceId than what the launcher returns.
 */
export async function launchAppAndWaitForInstance(
  appId: string,
  context: DACPHandlerContext,
  validatedContext: unknown
): Promise<string> {
  const { appLauncher, appDirectory, getState, logger } = context

  if (!appLauncher) {
    throw new Error("App launching not available - no AppLauncher configured")
  }

  // Get app metadata from directory
  const apps = appDirectory.retrieveAppsById(appId)
  if (apps.length === 0) {
    throw new Error(`App not found in directory: ${appId}`)
  }
  const appMetadata = apps[0]

  logger.info("DACP: Launching app for intent", {
    appId,
    hasContext: !!validatedContext,
  })

  // Track existing instances BEFORE launch to identify the new one
  const state = getState()
  const existingInstances = getInstancesByAppId(state, appId)
  const existingInstanceIds = new Set(existingInstances.map(i => i.instanceId))

  // Launch the app
  const launchResult = await appLauncher.launch(
    {
      app: { appId },
      context: validatedContext as Context | undefined,
    },
    appMetadata
  )

  const launcherInstanceId = launchResult.instanceId
  if (!launcherInstanceId) {
    throw new Error("App launcher did not return an instance ID")
  }

  // Set timestamp AFTER launch completes to catch instances created during/after launch
  // Use a small buffer to account for any timing differences
  const launchTimestamp = Date.now() - 500 // 500ms before to catch instances created during launch

  logger.info("DACP: App launched, waiting for new instance registration", {
    appId,
    launcherInstanceId,
    existingInstances: existingInstanceIds.size,
    launchTimestamp,
  })

  // Wait for a NEW instance to be registered and connected
  // Per FDC3 spec: at least 15 seconds timeout
  const maxWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
  const checkInterval = 100 // Check every 100ms
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    // Query for all instances of this app
    const currentState = context.getState()
    const allInstances = getInstancesByAppId(currentState, appId)
    const elapsed = Date.now() - startTime

    // Log all instances periodically (every 2 seconds) for debugging
    const shouldLog =
      elapsed < checkInterval * 2 ||
      Math.floor(elapsed / 2000) !== Math.floor((elapsed - checkInterval) / 2000)
    if (shouldLog) {
      logger.debug("DACP: Checking for new instance", {
        appId,
        elapsedMs: elapsed,
        totalInstances: allInstances.length,
        existingCount: existingInstanceIds.size,
        instances: allInstances.map(i => ({
          instanceId: i.instanceId,
          state: i.state,
          createdAt: i.createdAt.getTime(),
          isNew: !existingInstanceIds.has(i.instanceId),
          isRecent: i.createdAt.getTime() >= launchTimestamp,
          isReady: i.state === AppInstanceState.CONNECTED || i.state === AppInstanceState.PENDING,
          matchesLauncher: i.instanceId === launcherInstanceId,
        })),
        launcherInstanceId,
        launchTimestamp,
        currentTime: Date.now(),
      })
    }

    // Find a new instance (not in the existing set)
    // Accept PENDING or CONNECTED state - PENDING means WCP handshake complete and ready to receive messages
    // The 15 second timeout allows the app to add listeners per FDC3 spec
    const newInstance = allInstances.find(instance => {
      const isNew = !existingInstanceIds.has(instance.instanceId)
      const isRecent = instance.createdAt.getTime() >= launchTimestamp
      const isReady =
        instance.state === AppInstanceState.CONNECTED || instance.state === AppInstanceState.PENDING

      if (isNew && isRecent && !isReady) {
        logger.debug("DACP: Found new instance but not ready yet", {
          instanceId: instance.instanceId,
          state: instance.state,
          createdAt: instance.createdAt.getTime(),
          launchTimestamp,
        })
      }

      return isNew && isRecent && isReady
    })

    if (newInstance) {
      logger.info("DACP: New app instance registered and ready", {
        appId,
        instanceId: newInstance.instanceId,
        launcherInstanceId,
        state: newInstance.state,
        elapsedMs: Date.now() - startTime,
      })
      return newInstance.instanceId
    }

    // Also check if the launcher's instanceId exists (PENDING or CONNECTED) for compatibility
    const launcherInstance = getInstance(currentState, launcherInstanceId)
    if (
      launcherInstance &&
      (launcherInstance.state === AppInstanceState.CONNECTED ||
        launcherInstance.state === AppInstanceState.PENDING)
    ) {
      logger.info("DACP: Launcher instance registered and ready", {
        appId,
        instanceId: launcherInstanceId,
        state: launcherInstance.state,
      })
      return launcherInstanceId
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }

  // Log debug info before throwing
  const finalState = context.getState()
  const finalInstances = getInstancesByAppId(finalState, appId)
  logger.error("DACP: Timeout waiting for new instance", {
    appId,
    launcherInstanceId,
    existingInstancesBeforeLaunch: existingInstanceIds.size,
    currentInstances: finalInstances.length,
    currentInstanceStates: finalInstances.map(i => ({
      instanceId: i.instanceId,
      state: i.state,
      createdAt: i.createdAt.getTime(),
      launchTimestamp,
    })),
  })

  throw new Error(
    `No new instance of app ${appId} registered and connected within ${maxWaitTime}ms (FDC3 spec minimum timeout)`
  )
}
