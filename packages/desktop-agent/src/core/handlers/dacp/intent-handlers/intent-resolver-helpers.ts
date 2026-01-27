/**
 * Intent Resolver Helper Functions
 *
 * Helpers for building appIntent payloads for resolver responses.
 */

import type { AppDirectoryManager } from "../../../app-directory/app-directory-manager"
import type { AgentState } from "../../../state/types"
import { AppInstanceState } from "../../../state/types"
import {
  getActiveListenersForIntent,
  getInstance,
  getInstancesByAppId,
} from "../../../state/selectors"
import { isContextTypeCompatible, isResultTypeCompatible } from "./intent-helpers"

/**
 * Helper to create AppIntent objects for intent resolver responses.
 * Includes running instances first, then directory apps.
 */
export function createResolverAppIntent(
  state: AgentState,
  appDirectory: AppDirectoryManager,
  intentName: string,
  contextType?: string,
  resultType?: string
): {
  intent: { name: string; displayName?: string }
  apps: Array<{ appId: string; name?: string; version?: string; instanceId?: string }>
} {
  const apps: Array<{ appId: string; name?: string; version?: string; instanceId?: string }> = []

  const allApps = appDirectory.retrieveAllApps()
  const directoryAppIds = new Set<string>()

  allApps.forEach(app => {
    const intents = app.interop?.intents?.listensFor
    if (!intents || typeof intents !== "object") return
    const intentDef = intents[intentName]
    if (!intentDef || typeof intentDef !== "object" || !("contexts" in intentDef)) return

    const contextTypes = Array.isArray(intentDef.contexts) ? intentDef.contexts : []
    if (contextType && !isContextTypeCompatible(contextTypes, contextType)) return

    const actualResultType =
      typeof intentDef.resultType === "string" ? intentDef.resultType : undefined
    if (resultType !== undefined && !isResultTypeCompatible(actualResultType, resultType)) return

    directoryAppIds.add(app.appId)

    const instances = getInstancesByAppId(state, app.appId).filter(
      instance => instance.state !== AppInstanceState.TERMINATED
    )

    instances.forEach(instance => {
      apps.push({
        appId: app.appId,
        name: app.name,
        version: app.version,
        instanceId: instance.instanceId,
      })
    })
  })

  let runningListeners = getActiveListenersForIntent(state, intentName)
  if (contextType) {
    runningListeners = runningListeners.filter(listener =>
      isContextTypeCompatible(listener.contextTypes, contextType)
    )
  }

  const validRunningListeners = runningListeners.filter(listener => {
    const instance = getInstance(state, listener.instanceId)
    return instance && instance.state !== AppInstanceState.TERMINATED
  })

  const filteredDynamicListeners =
    resultType !== undefined
      ? []
      : validRunningListeners.filter(listener => !directoryAppIds.has(listener.appId))

  filteredDynamicListeners.forEach(listener => {
    const appInfo = appDirectory.retrieveAppsById(listener.appId)[0]
    apps.push({
      appId: listener.appId,
      name: appInfo?.name,
      version: appInfo?.version,
      instanceId: listener.instanceId,
    })
  })

  const runningInstanceAppIds = new Set(
    apps.filter(entry => entry.instanceId).map(entry => entry.appId)
  )

  const directoryMatches = allApps.filter(app => {
    const intents = app.interop?.intents?.listensFor
    if (!intents || typeof intents !== "object") return false
    const intentDef = intents[intentName]
    if (!intentDef || typeof intentDef !== "object" || !("contexts" in intentDef)) return false

    const contextTypes = Array.isArray(intentDef.contexts) ? intentDef.contexts : []
    if (contextType && !isContextTypeCompatible(contextTypes, contextType)) return false

    const actualResultType =
      typeof intentDef.resultType === "string" ? intentDef.resultType : undefined
    if (resultType !== undefined && !isResultTypeCompatible(actualResultType, resultType)) return false

    return true
  })

  const directoryAppsWithoutInstances = directoryMatches.filter(
    app => !runningInstanceAppIds.has(app.appId)
  )
  const directoryAppsWithInstances = directoryMatches.filter(app =>
    runningInstanceAppIds.has(app.appId)
  )

  ;[...directoryAppsWithoutInstances, ...directoryAppsWithInstances].forEach(app => {
    apps.push({
      appId: app.appId,
      name: app.name,
      version: app.version,
    })
  })

  return {
    intent: { name: intentName, displayName: intentName },
    apps,
  }
}
