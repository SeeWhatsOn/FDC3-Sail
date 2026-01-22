import {
  createDACPSuccessResponse,
  createIntentEvent,
  DACP_ERROR_TYPES,
  generateEventUuid,
} from "../../protocol/dacp-utilities"
import { type DACPHandlerContext, type DACPMessage, type IntentHandlerOption } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import { type Context, ResolveError } from "@finos/fdc3"
import { AppInstanceState } from "../../state/types"
import {
  NoAppsFoundError,
  TargetAppUnavailableError,
  TargetInstanceUnavailableError,
  // IntentDeliveryFailedError,
  UserCancelledError,
  FDC3ResolveError,
} from "../../errors/fdc3-errors"
import {
  getInstance,
  getInstancesByAppId,
  getActiveListenersForIntent,
  getListenersForInstance,
  getPendingIntent,
  getAllIntentListeners,
} from "../../state/selectors"
import {
  registerIntentListener,
  unregisterIntentListener,
  addPendingIntent,
  resolvePendingIntent,
} from "../../state/transforms"
import type { AgentState, IntentListener } from "../../state/types"
import type { AppDirectoryManager } from "../../app-directory/app-directory-manager"

/**
 * Map to store promise functions for pending intents
 * These can't be stored in state (not serializable), so we manage them separately
 */
const pendingIntentPromises = new Map<
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
function findIntentHandlers(
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
function createAppIntents(
  state:AgentState,
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
function findIntentsByContext(
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
async function launchAppAndWaitForInstance(
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

  const launcherInstanceId = launchResult.appIdentifier.instanceId
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

export async function handleRaiseIntentRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, setState, appDirectory, logger } = context

  try {
    const payload = message.payload as {
      intent: string
      context: Context
      app?: string | { appId: string; instanceId?: string }
    }

    const contextPayload = payload.context as Record<string, unknown>
    logger.info("DACP: Processing raise intent request", {
      intent: payload.intent,
      requestUuid: message.meta.requestUuid,
      contextType: contextPayload?.type,
      contextKeys: contextPayload ? Object.keys(contextPayload) : [],
      hasName: typeof contextPayload?.name === "string",
      contextPayload: JSON.stringify(contextPayload),
    })

    const validatedContext: Context = payload.context

    const validatedContextRecord = validatedContext as Record<string, unknown>
    logger.debug("DACP: Context validated successfully", {
      contextType: validatedContext.type,
      hasId: !!validatedContext.id,
      hasName: typeof validatedContextRecord.name === "string",
      contextKeys: Object.keys(validatedContextRecord),
      validatedContext: JSON.stringify(validatedContextRecord),
    })

    // Validate target app/instance BEFORE attempting delivery
    if (payload.app) {
      const targetAppId = typeof payload.app === "string" ? payload.app : payload.app.appId
      const targetInstanceId = typeof payload.app === "object" ? payload.app.instanceId : undefined

      // Check if app exists in directory
      const apps = appDirectory.retrieveAppsById(targetAppId)
      if (apps.length === 0) {
        throw new TargetAppUnavailableError(`App not found in directory: ${targetAppId}`)
      }

      // Check if specific instance exists (if specified)
      if (targetInstanceId) {
        const state = getState()
        const instance = getInstance(state, targetInstanceId)
        if (!instance || instance.state === AppInstanceState.TERMINATED) {
          throw new TargetInstanceUnavailableError(`Instance not found or terminated: ${targetInstanceId}`)
        }
      }
    }

    const source = getInstance(getState(), instanceId)

    if (!source) {
      throw new Error(`Source instance ${instanceId} not found`)
    }

    // Find intent handlers for this request
    const state = getState()
    const handlers = findIntentHandlers(state, appDirectory, {
      intent: payload.intent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target:
        typeof payload.app === "string"
          ? { appId: payload.app }
          : payload.app,
    })

    // Safety check: Filter out listeners whose instances no longer exist
    // This prevents zombie instances from appearing in the resolver
    const originalRunningCount = handlers.runningListeners.length
    const validRunningListeners = handlers.runningListeners.filter(listener => {
      const instance = getInstance(state, listener.instanceId)
      if (!instance) {
        logger.warn("DACP: Found listener for non-existent instance, filtering out", {
          listenerId: listener.listenerId,
          instanceId: listener.instanceId,
          appId: listener.appId,
          intent: payload.intent,
        })
        return false
      }
      if (instance.state === AppInstanceState.TERMINATED) {
        logger.warn("DACP: Found listener for terminated instance, filtering out", {
          listenerId: listener.listenerId,
          instanceId: listener.instanceId,
          appId: listener.appId,
          intent: payload.intent,
        })
        return false
      }
      return true
    })

    // Rebuild handlers with filtered running listeners if any were filtered
    // We need to rebuild compatibleApps because it's built from runningListeners + availableApps
    // If we filtered out zombie listeners, compatibleApps would still contain them
    const finalHandlers =
      validRunningListeners.length !== originalRunningCount
        ? (() => {
            const runningAppIds = new Set(validRunningListeners.map(l => l.appId))
            logger.info("DACP: Filtered out zombie listeners", {
              originalCount: originalRunningCount,
              validCount: validRunningListeners.length,
              filteredCount: originalRunningCount - validRunningListeners.length,
            })
            return {
              ...handlers,
              runningListeners: validRunningListeners,
              // Rebuild compatibleApps with filtered runningListeners to remove zombie instances
              compatibleApps: [
                ...validRunningListeners,
                ...handlers.availableApps.filter(app => !runningAppIds.has(app.appId)),
              ],
            }
          })()
        : handlers

    logger.info("DACP: Intent handlers found", {
      intent: payload.intent,
      runningListeners: finalHandlers.runningListeners.length,
      availableApps: finalHandlers.availableApps.length,
      compatibleApps: finalHandlers.compatibleApps.length,
      contextType: validatedContext.type,
      hasName: typeof (validatedContext as Record<string, unknown>).name === "string",
    })

    // Check if we have any compatible handlers
    if (finalHandlers.compatibleApps.length === 0) {
      logger.error("DACP: No compatible handlers found", {
        intent: payload.intent,
        contextType: validatedContext.type,
        runningListeners: finalHandlers.runningListeners.length,
        availableApps: finalHandlers.availableApps.length,
      })
      throw new NoAppsFoundError(`No apps found to handle intent: ${payload.intent}`)
    }

    let targetInstanceId: string
    let targetAppId: string

    // Check if we need UI resolution (multiple handlers available)
    const needsResolution =
      finalHandlers.compatibleApps.length > 1 && context.requestIntentResolution

    if (needsResolution) {
      // Build handler options for UI with app metadata
      const handlerOptions: IntentHandlerOption[] = finalHandlers.compatibleApps.map(handler => {
        const isRunning = "instanceId" in handler
        const apps = appDirectory.retrieveAppsById(handler.appId)
        const appInfo = apps[0] // Take first matching app
        return {
          instanceId: isRunning ? (handler).instanceId : undefined,
          appId: handler.appId,
          appName: appInfo?.title || handler.appId,
          appIcon: appInfo?.icons?.[0]?.src,
          isRunning,
        }
      })

      logger.info("DACP: Multiple handlers found, requesting UI resolution", {
        intent: payload.intent,
        handlerCount: handlerOptions.length,
      })

      // Request UI resolution
      const resolution = await context.requestIntentResolution!({
        requestId: message.meta.requestUuid,
        intent: payload.intent,
        context: validatedContext,
        handlers: handlerOptions,
      })

      if (!resolution.selectedHandler) {
        throw new UserCancelledError("Intent resolution cancelled by user")
      }

      targetAppId = resolution.selectedHandler.appId

      // Re-query handlers after user selection to get current state
      // (apps may have been launched/closed while user was selecting)
      const currentState = getState()
      const currentHandlers = findIntentHandlers(currentState, appDirectory, {
        intent: payload.intent,
        context: validatedContext,
        source: { appId: source.appId, instanceId: source.instanceId },
        target: { appId: targetAppId },
      })

      // Check if there's a running instance for the selected app
      const runningInstance = currentHandlers.runningListeners.find(
        listener => listener.appId === targetAppId
      )

      if (resolution.selectedHandler.instanceId) {
        // User selected a specific running instance - verify it still exists
        const selectedInstance = getInstance(currentState, resolution.selectedHandler.instanceId)
        if (selectedInstance && selectedInstance.state !== AppInstanceState.TERMINATED) {
          targetInstanceId = resolution.selectedHandler.instanceId
          logger.info("DACP: Using user-selected running instance", {
            targetInstanceId,
            targetAppId,
            instanceState: selectedInstance.state,
          })

          // Verify intent listener is registered on the selected instance
          const listeners = getListenersForInstance(currentState, targetInstanceId).filter(
            l => l.intentName === payload.intent && l.active
          )

          if (listeners.length === 0) {
            logger.warn(
              "DACP: No intent listener found on selected instance, waiting for registration",
              {
                targetInstanceId,
                intent: payload.intent,
              }
            )

            // Wait for listener to be registered (max 5 seconds for running instances)
            const listenerWaitTime = 5000
            const listenerCheckInterval = 100
            const listenerWaitStart = Date.now()
            let listenerRegistered = false

            while (Date.now() - listenerWaitStart < listenerWaitTime) {
              const waitState = getState()
              const currentListeners = getListenersForInstance(waitState, targetInstanceId).filter(
                l => l.intentName === payload.intent && l.active
              )

              if (currentListeners.length > 0) {
                listenerRegistered = true
                logger.info("DACP: Intent listener found on selected instance", {
                  targetInstanceId,
                  intent: payload.intent,
                  listenerId: currentListeners[0].listenerId,
                })
                break
              }

              await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
            }

            if (!listenerRegistered) {
              logger.warn(
                "DACP: No intent listener registered on selected instance, sending intent event anyway",
                {
                  targetInstanceId,
                  intent: payload.intent,
                }
              )
            }
          }
        } else if (runningInstance) {
          // Selected instance no longer exists, but there's another running instance
          targetInstanceId = runningInstance.instanceId
          logger.warn("DACP: Selected instance no longer available, using other running instance", {
            selectedInstanceId: resolution.selectedHandler.instanceId,
            targetInstanceId,
            targetAppId,
          })
        } else {
          // Selected instance gone, need to launch new one
          logger.warn("DACP: Selected instance no longer available, launching new instance", {
            selectedInstanceId: resolution.selectedHandler.instanceId,
            targetAppId,
          })
          targetInstanceId = await launchAppAndWaitForInstance(
            targetAppId,
            context,
            validatedContext
          )
        }
      } else if (runningInstance) {
        // User selected app but no specific instance - use running instance if available
        targetInstanceId = runningInstance.instanceId
        logger.info("DACP: Using existing running instance for selected app", {
          targetInstanceId,
          targetAppId,
        })

        // Verify intent listener is registered on this instance
        const listeners = getListenersForInstance(currentState, targetInstanceId).filter(
          l => l.intentName === payload.intent && l.active
        )

        if (listeners.length === 0) {
          logger.warn(
            "DACP: No intent listener found on running instance, waiting for registration",
            {
              targetInstanceId,
              intent: payload.intent,
            }
          )

          // Wait for listener to be registered (max 5 seconds for running instances)
          const listenerWaitTime = 5000
          const listenerCheckInterval = 100
          const listenerWaitStart = Date.now()
          let listenerRegistered = false

          while (Date.now() - listenerWaitStart < listenerWaitTime) {
            const waitState = getState()
            const currentListeners = getListenersForInstance(waitState, targetInstanceId).filter(
              l => l.intentName === payload.intent && l.active
            )

            if (currentListeners.length > 0) {
              listenerRegistered = true
              logger.info("DACP: Intent listener found on running instance", {
                targetInstanceId,
                intent: payload.intent,
                listenerId: currentListeners[0].listenerId,
              })
              break
            }

            await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
          }

          if (!listenerRegistered) {
            logger.warn(
              "DACP: No intent listener registered on running instance, sending intent event anyway",
              {
                targetInstanceId,
                intent: payload.intent,
              }
            )
          }
        }
      } else {
        // Need to launch the app
        targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)

        // Per FDC3 spec: Allow time for app to add intent listener after launch
        // Wait up to 15 seconds for the app to register its intent listener
        logger.info("DACP: Waiting for app to register intent listener (UI resolution path)", {
          targetInstanceId,
          intent: payload.intent,
        })

        const listenerWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
        const listenerCheckInterval = 100 // Check every 100ms
        const listenerWaitStart = Date.now()
        let listenerRegistered = false

        while (Date.now() - listenerWaitStart < listenerWaitTime) {
          // Check if a listener has been registered for this intent on this instance
          const waitState = getState()
          const listeners = getListenersForInstance(waitState, targetInstanceId).filter(
            l => l.intentName === payload.intent && l.active
          )

          if (listeners.length > 0) {
            listenerRegistered = true
            logger.info("DACP: Intent listener registered (UI resolution path)", {
              targetInstanceId,
              intent: payload.intent,
              listenerId: listeners[0].listenerId,
            })
            break
          }

          await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
        }

        if (!listenerRegistered) {
          logger.warn(
            "DACP: No intent listener registered within timeout (UI resolution path), sending intent event anyway",
            {
              targetInstanceId,
              intent: payload.intent,
              timeout: listenerWaitTime,
            }
          )
          // Continue anyway - the app might handle the intent event when it registers the listener
        }
      }
    } else if (finalHandlers.runningListeners.length > 0) {
      // Single handler or no UI - use a running listener (preferred)
      const listener = finalHandlers.runningListeners[0]
      targetInstanceId = listener.instanceId
      targetAppId = listener.appId
      logger.info("DACP: Using running listener", {
        targetInstanceId,
        targetAppId,
        intent: payload.intent,
        contextType: validatedContext.type,
        hasName: typeof (validatedContext as Record<string, unknown>).name === "string",
      })
    } else if (finalHandlers.availableApps.length > 0) {
      // Need to launch an app
      const appCapability = finalHandlers.availableApps[0]
      targetAppId = appCapability.appId
      logger.info("DACP: Launching app for intent", {
        targetAppId,
        intent: payload.intent,
        contextType: validatedContext.type,
        hasName: typeof (validatedContext as Record<string, unknown>).name === "string",
      })
      targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)
      logger.info("DACP: App launched successfully", {
        targetInstanceId,
        targetAppId,
      })

      // Per FDC3 spec: Allow time for app to add intent listener after launch
      // Wait up to 15 seconds for the app to register its intent listener
      // This ensures the app is ready to receive the intent event
      logger.info("DACP: Waiting for app to register intent listener", {
        targetInstanceId,
        intent: payload.intent,
      })

      const listenerWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
      const listenerCheckInterval = 100 // Check every 100ms
      const listenerWaitStart = Date.now()
      let listenerRegistered = false

      while (Date.now() - listenerWaitStart < listenerWaitTime) {
        // Check if a listener has been registered for this intent on this instance
        const waitState = getState()
        const listeners = getListenersForInstance(waitState, targetInstanceId).filter(
          l => l.intentName === payload.intent && l.active
        )

        if (listeners.length > 0) {
          listenerRegistered = true
          logger.info("DACP: Intent listener registered", {
            targetInstanceId,
            intent: payload.intent,
            listenerId: listeners[0].listenerId,
          })
          break
        }

        await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
      }

      if (!listenerRegistered) {
        logger.warn(
          "DACP: No intent listener registered within timeout, sending intent event anyway",
          {
            targetInstanceId,
            intent: payload.intent,
            timeout: listenerWaitTime,
          }
        )
        // Continue anyway - the app might handle the intent event when it registers the listener
        // or the app might be using a different mechanism to handle intents
      }
    } else {
      throw new NoAppsFoundError(`No handler found for intent: ${payload.intent}`)
    }

    // Register pending intent and get promise for result
    // Note: PendingIntent includes resolve/reject functions which can't be serialized in state
    // We'll need to handle this differently - store the pending intent metadata in state
    // and manage the promise separately
    const requestId = message.meta.requestUuid
    let resolvePromise: (result: unknown) => void
    let rejectPromise: (error: Error) => void
    const resultPromise = new Promise<unknown>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })

    // Store promise functions in Map (they can't be serialized in state)
    pendingIntentPromises.set(requestId, {
      resolve: resolvePromise!,
      reject: rejectPromise!,
    })

    // Store pending intent metadata in state (without promise functions)
    setState(state =>
      addPendingIntent(state, {
        requestId,
        intentName: payload.intent,
        context: validatedContext,
        sourceInstanceId: instanceId,
        targetInstanceId,
        targetAppId,
        resolve: () => {}, // Placeholder - actual resolve is in Map
        reject: () => {}, // Placeholder - actual reject is in Map
      })
    )

    // Send intentEvent to target app
    const intentEvent = createIntentEvent(
      payload.intent,
      validatedContext,
      requestId,
      {
        appId: source.appId,
        instanceId: source.instanceId,
      }
    )

    logger.info("DACP: Sending intentEvent to target app", {
      targetInstanceId,
      targetAppId,
      intent: payload.intent,
      requestUuid: requestId,
      eventUuid: intentEvent.meta.eventUuid,
      hasDestination: true,
      contextType: validatedContext.type,
      contextHasName: typeof (validatedContext as Record<string, unknown>).name === "string",
      intentEventPayload: JSON.stringify(intentEvent.payload),
    })

    // Add routing metadata
    const intentEventWithRouting = {
      ...intentEvent,
      meta: {
        ...intentEvent.meta,
        destination: { instanceId: targetInstanceId },
      },
    }

    // Verify target instance exists and is ready before sending
    const targetInstanceForEvent = getInstance(getState(), targetInstanceId)
    if (!targetInstanceForEvent) {
      throw new Error(`Target instance ${targetInstanceId} not found when sending intent event`)
    }

    // Ensure instance is in a ready state (PENDING or CONNECTED)
    if (
      targetInstanceForEvent.state !== AppInstanceState.PENDING &&
      targetInstanceForEvent.state !== AppInstanceState.CONNECTED
    ) {
      logger.warn("DACP: Target instance not in ready state, waiting briefly", {
        targetInstanceId,
        targetState: targetInstanceForEvent.state,
      })
      // Wait a bit for instance to become ready (max 2 seconds)
      const maxWait = 2000
      const checkInterval = 100
      const startTime = Date.now()
      while (Date.now() - startTime < maxWait) {
        const waitState = getState()
        const instance = getInstance(waitState, targetInstanceId)
        if (
          instance &&
          (instance.state === AppInstanceState.PENDING ||
            instance.state === AppInstanceState.CONNECTED)
        ) {
          logger.info("DACP: Target instance became ready", {
            targetInstanceId,
            targetState: instance.state,
            waitedMs: Date.now() - startTime,
          })
          break
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }

      // Re-check after waiting
      const finalState = getState()
      const finalInstance = getInstance(finalState, targetInstanceId)
      if (
        finalInstance &&
        finalInstance.state !== AppInstanceState.PENDING &&
        finalInstance.state !== AppInstanceState.CONNECTED
      ) {
        throw new Error(
          `Target instance ${targetInstanceId} is not in ready state: ${finalInstance.state}`
        )
      }
    }

    logger.info("DACP: Target instance verified, sending intentEvent", {
      targetInstanceId,
      targetAppId: targetInstanceForEvent.appId,
      targetState: targetInstanceForEvent.state,
      eventType: intentEventWithRouting.type,
    })

    transport.send(intentEventWithRouting)

    logger.info("DACP: intentEvent sent, waiting for intentResultRequest", {
      targetInstanceId,
      requestUuid: requestId,
      timeoutMs: 30000,
    })

    // Set up timeout for pending intent
    const timeoutHandle = setTimeout(() => {
      const promiseData = pendingIntentPromises.get(requestId)
      if (promiseData) {
        promiseData.reject(new Error("Intent result timeout"))
        pendingIntentPromises.delete(requestId)
        setState(state => resolvePendingIntent(state, requestId))
      }
    }, 30000)

    // Store timeout handle
    const promiseData = pendingIntentPromises.get(requestId)
    if (promiseData) {
      promiseData.timeoutHandle = timeoutHandle
    }

    // Wait for the result from intentResultRequest handler
    await resultPromise

    // Get target app instance information
    const finalState = getState()
    const targetInstance = getInstance(finalState, targetInstanceId)
    if (!targetInstance) {
      throw new Error(`Target instance ${targetInstanceId} not found`)
    }

    // Send response back to source app with intentResolution
    const response = createDACPSuccessResponse(message, "raiseIntentResponse", {
      intentResolution: {
        source: {
          appId: targetInstance.appId,
          instanceId: targetInstance.instanceId,
        },
        intent: payload.intent,
      },
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    const payload = message.payload
    const context = payload?.context as Record<string, unknown> | undefined

    logger.error("DACP: Raise intent request failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      contextType: context?.type,
      contextHasName: typeof context?.name === "string",
    })

    // Determine error type from error instance
    let errorType: string = ResolveError.IntentDeliveryFailed
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (error instanceof FDC3ResolveError) {
      errorType = error.errorType
    } else if (errorMessage.includes("No apps found") || errorMessage.includes("No handler found")) {
      errorType = ResolveError.NoAppsFound
    } else if (errorMessage.includes("App not found in directory")) {
      errorType = ResolveError.TargetAppUnavailable
    } else if (errorMessage.includes("not found") && errorMessage.includes("instance")) {
      errorType = ResolveError.TargetInstanceUnavailable
    } else if (errorMessage.includes("cancelled by user")) {
      errorType = ResolveError.UserCancelled
    }

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

export function handleAddIntentListener(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const payload = message.payload as { intent: string; contextTypes?: string[] }
    const instance = getInstance(getState(), instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for adding intent listener`)
    }

    const listenerId = generateEventUuid()

    setState(state =>
      registerIntentListener(state, {
        listenerId,
        intentName: payload.intent,
        instanceId,
        appId: instance.appId,
        contextTypes: payload.contextTypes ?? [],
      })
    )

    // FDC3 spec requires listenerUUID (not listenerId) in the response payload
    //TODO: change the var to match the spec - listenerId -> listenerUUID
    const response = createDACPSuccessResponse(message, "addIntentListenerResponse", {
      listenerUUID: listenerId,
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Add intent listener failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.LISTENER_ERROR,
      errorMessage: error instanceof Error ? error.message : "Failed to add intent listener",
      instanceId,
      transport,
    })
  }
}

export function handleIntentListenerUnsubscribe(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const listenerUUID = (message.payload as { listenerUUID: string }).listenerUUID

    // Check if listener exists before removing
    const state = getState()
    const listener = state.intents.listeners[listenerUUID]
    if (!listener) {
      throw new Error(`Intent listener ${listenerUUID} not found`)
    }

    setState(state => unregisterIntentListener(state, listenerUUID))

    const response = createDACPSuccessResponse(message, "intentListenerUnsubscribeResponse")
    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Intent listener unsubscribe failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.LISTENER_ERROR,
      errorMessage: error instanceof Error ? error.message : "Failed to unsubscribe intent listener",
      instanceId,
      transport,
    })
  }
}

export function handleFindIntentRequest(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState, appDirectory, logger } = context

  try {
    const payload = message.payload as { intent: string; context?: Context; resultType?: string }
    const intent = payload.intent
    const contextType = payload.context?.type
    const resultType = payload.resultType

    const appIntents = createAppIntents(getState(), appDirectory, intent, contextType, resultType)

    const response = createDACPSuccessResponse(message, "findIntentResponse", {
      appIntent: appIntents[0] ?? { intent: { name: intent, displayName: intent }, apps: [] },
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Find intent request failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.NO_APPS_FOUND,
      errorMessage: error instanceof Error ? error.message : "Failed to find apps for intent",
      instanceId,
      transport,
    })
  }
}

export function handleIntentResultRequest(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const payload = message.payload as {
      raiseIntentRequestUuid: string
      intentResult?: unknown
    }

    logger.info("DACP: Processing intent result request", {
      requestUuid: message.meta.requestUuid,
      raiseIntentRequestUuid: payload.raiseIntentRequestUuid,
    })

    // Get the original request ID from payload.raiseIntentRequestUuid
    const originalRequestId = payload.raiseIntentRequestUuid

    // Check if there's a pending intent for this request
    const state = getState()
    const pendingIntent = getPendingIntent(state, originalRequestId)

    if (!pendingIntent) {
      throw new Error(`No pending intent found for request: ${originalRequestId}`)
    }

    // Verify that the instanceId matches the target instance
    if (pendingIntent.targetInstanceId !== instanceId) {
      throw new Error(
        `Intent result from wrong instance. Expected ${pendingIntent.targetInstanceId}, got ${instanceId}`
      )
    }

    // Note: Errors are communicated via error responses, not via message.payload.error
    // If the intent handler failed, it would send an error response directly,
    // not an intentResultRequest with an error field

    // Resolve the pending intent with the result
    const intentResult = payload.intentResult

    // Get promise functions from Map and resolve
    const promiseData = pendingIntentPromises.get(originalRequestId)
    if (promiseData) {
      if (promiseData.timeoutHandle) {
        clearTimeout(promiseData.timeoutHandle)
      }
      promiseData.resolve(intentResult)
      pendingIntentPromises.delete(originalRequestId)
    }

    // Remove from state
    setState(state => resolvePendingIntent(state, originalRequestId))

    // Send acknowledgment response
    const response = createDACPSuccessResponse(message, "intentResultResponse")
    sendDACPResponse({ response, instanceId, transport })

    logger.info("DACP: Intent result processed successfully", {
      originalRequestId,
      hasResult: !!intentResult,
    })
  } catch (error) {
    logger.error("DACP: Intent result request failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED,
      errorMessage: error instanceof Error ? error.message : "Failed to process intent result",
      instanceId,
      transport,
    })
  }
}

export function handleFindIntentsByContextRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, appDirectory, logger } = context

  try {
    const payload = message.payload as { context: Context }
    const contextType = payload.context?.type

    if (!contextType) {
      throw new Error("Context type is required for findIntentsByContext")
    }

    logger.info("DACP: Finding intents for context type", { contextType })

    // Find all intents that can handle this context type
    const intentMetadata = findIntentsByContext(getState(), appDirectory, contextType)

    // Convert to AppIntent[] format
    const appIntents = intentMetadata.map(metadata => {
      const appIntentsForIntent = createAppIntents(getState(), appDirectory, metadata.name, contextType)
      return (
        appIntentsForIntent[0] || {
          intent: { name: metadata.name, displayName: metadata.displayName || metadata.name },
          apps: [],
        }
      )
    })

    const response = createDACPSuccessResponse(message, "findIntentsByContextResponse", {
      appIntents,
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Find intents by context request failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.NO_APPS_FOUND,
      errorMessage: error instanceof Error ? error.message : "Failed to find intents for context type",
      instanceId,
      transport,
    })
  }
}

export async function handleRaiseIntentForContextRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, setState, appDirectory, logger } = context

  try {
    const payload = message.payload as {
      context: Context
      app?: { appId: string; instanceId?: string }
    }

    logger.info("DACP: Processing raise intent for context request", {
      requestUuid: message.meta.requestUuid,
    })

    // app is an AppIdentifier object (with appId, instanceId, desktopAgent)
    const validatedContext = payload.context

    // Validate target app/instance BEFORE attempting delivery
    if (payload.app) {
      const targetAppId = payload.app.appId
      const targetInstanceId = payload.app.instanceId

      // Check if app exists in directory
      const apps = appDirectory.retrieveAppsById(targetAppId)
      if (apps.length === 0) {
        throw new TargetAppUnavailableError(`App not found in directory: ${targetAppId}`)
      }

      // Check if specific instance exists (if specified)
      if (targetInstanceId) {
        const state = getState()
        const instance = getInstance(state, targetInstanceId)
        if (!instance || instance.state === AppInstanceState.TERMINATED) {
          throw new TargetInstanceUnavailableError(`Instance not found or terminated: ${targetInstanceId}`)
        }
      }
    }

    const source = getInstance(getState(), instanceId)

    if (!source) {
      throw new Error(`Source instance ${instanceId} not found`)
    }

    // Find all intents that can handle this context type
    const intentMetadata = findIntentsByContext(getState(), appDirectory, validatedContext.type)

    if (intentMetadata.length === 0) {
      throw new NoAppsFoundError(`No intents found to handle context type: ${validatedContext.type}`)
    }

    // For now, use the first intent found
    // TODO: Implement UI resolution when multiple intents exist
    const selectedIntent = intentMetadata[0].name

    logger.info("DACP: Selected intent for context", {
      intent: selectedIntent,
      contextType: validatedContext.type,
    })

    // Find handlers for this intent
    const state = getState()
    const handlers = findIntentHandlers(state, appDirectory, {
      intent: selectedIntent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target: payload.app, // app is already an AppIdentifier object
    })

    if (handlers.compatibleApps.length === 0) {
      throw new NoAppsFoundError(`No apps found to handle intent: ${selectedIntent}`)
    }

    // Select target (prefer running listeners)
    let targetInstanceId: string
    let targetAppId: string

    if (handlers.runningListeners.length > 0) {
      const listener = handlers.runningListeners[0]
      targetInstanceId = listener.instanceId
      targetAppId = listener.appId
    } else if (handlers.availableApps.length > 0) {
      const appCapability = handlers.availableApps[0]
      targetAppId = appCapability.appId
      targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)

      // Per FDC3 spec: Allow time for app to add intent listener after launch
      // Wait up to 15 seconds for the app to register its intent listener
      logger.info("DACP: Waiting for app to register intent listener (context-first)", {
        targetInstanceId,
        intent: selectedIntent,
      })

      const listenerWaitTime = 15000 // 15 seconds (FDC3 spec minimum)
      const listenerCheckInterval = 100 // Check every 100ms
      const listenerWaitStart = Date.now()
      let listenerRegistered = false

      while (Date.now() - listenerWaitStart < listenerWaitTime) {
        const waitState = getState()
        const listeners = getListenersForInstance(waitState, targetInstanceId).filter(
          l => l.intentName === selectedIntent && l.active
        )

        if (listeners.length > 0) {
          listenerRegistered = true
          logger.info("DACP: Intent listener registered (context-first)", {
            targetInstanceId,
            intent: selectedIntent,
            listenerId: listeners[0].listenerId,
          })
          break
        }

        await new Promise(resolve => setTimeout(resolve, listenerCheckInterval))
      }

      if (!listenerRegistered) {
        logger.warn(
          "DACP: No intent listener registered within timeout (context-first), sending intent event anyway",
          {
            targetInstanceId,
            intent: selectedIntent,
            timeout: listenerWaitTime,
          }
        )
      }
    } else {
      throw new NoAppsFoundError(`No handler found for intent: ${selectedIntent}`)
    }

    // Register pending intent and get promise for result
    const requestId = message.meta.requestUuid
    let resolvePromise: (result: unknown) => void
    let rejectPromise: (error: Error) => void
    const resultPromise = new Promise<unknown>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })

    // Store promise functions in Map (can't be in state)
    pendingIntentPromises.set(requestId, {
      resolve: resolvePromise!,
      reject: rejectPromise!,
    })

    // Store pending intent metadata in state (without promise functions)
    setState(state =>
      addPendingIntent(state, {
        requestId,
        intentName: selectedIntent,
        context: validatedContext,
        sourceInstanceId: instanceId,
        targetInstanceId,
        targetAppId,
        resolve: () => {}, // Placeholder - actual resolve is in Map
        reject: () => {}, // Placeholder - actual reject is in Map
      })
    )

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      const promiseData = pendingIntentPromises.get(requestId)
      if (promiseData) {
        promiseData.reject(new Error("Intent result timeout"))
        pendingIntentPromises.delete(requestId)
        setState(state => resolvePendingIntent(state, requestId))
      }
    }, 30000)

    const promiseData = pendingIntentPromises.get(requestId)
    if (promiseData) {
      promiseData.timeoutHandle = timeoutHandle
    }

    // Send intentEvent to target app
    const intentEvent = createIntentEvent(
      selectedIntent,
      validatedContext,
      requestId,
      {
        appId: source.appId,
        instanceId: source.instanceId,
      }
    )

    logger.info("DACP: Sending intentEvent for context-first intent", {
      targetInstanceId,
      intent: selectedIntent,
      contextType: validatedContext.type,
    })

    // Add routing metadata
    const intentEventWithRouting = {
      ...intentEvent,
      meta: {
        ...intentEvent.meta,
        destination: { instanceId: targetInstanceId },
      },
    }

    transport.send(intentEventWithRouting)

    // Wait for result
    await resultPromise

    // Get target app instance information
    const finalState = getState()
    const targetInstance = getInstance(finalState, targetInstanceId)
    if (!targetInstance) {
      throw new Error(`Target instance ${targetInstanceId} not found`)
    }

    // Send response with intentResolution
    const response = createDACPSuccessResponse(message, "raiseIntentForContextResponse", {
      intentResolution: {
        source: {
          appId: targetInstance.appId,
          instanceId: targetInstance.instanceId,
        },
        intent: selectedIntent,
      },
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Raise intent for context request failed", error)

    // Determine error type from error instance
    let errorType: string = ResolveError.IntentDeliveryFailed
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (error instanceof FDC3ResolveError) {
      errorType = error.errorType
    } else if (errorMessage.includes("No apps found") || errorMessage.includes("No handler found") || errorMessage.includes("No intents found")) {
      errorType = ResolveError.NoAppsFound
    } else if (errorMessage.includes("App not found in directory")) {
      errorType = ResolveError.TargetAppUnavailable
    } else if (errorMessage.includes("not found") && errorMessage.includes("instance")) {
      errorType = ResolveError.TargetInstanceUnavailable
    } else if (errorMessage.includes("cancelled by user")) {
      errorType = ResolveError.UserCancelled
    }

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}
