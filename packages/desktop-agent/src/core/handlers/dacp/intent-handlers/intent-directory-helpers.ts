import type { AppDirectoryManager } from "../../../app-directory/app-directory-manager"
import { isContextTypeCompatible } from "./intent-helpers"

export function getDirectoryIntentsForContext(
  appDirectory: AppDirectoryManager,
  appId: string,
  contextType: string
): string[] {
  const appInfo = appDirectory.retrieveAppsById(appId)[0]
  if (!appInfo) {
    return []
  }

  const listensFor = appInfo.interop?.intents?.listensFor
  if (!listensFor || typeof listensFor !== "object") {
    return []
  }

  return Object.entries(listensFor)
    .filter(([, intentDef]) => {
      if (!intentDef || typeof intentDef !== "object" || !("contexts" in intentDef)) {
        return false
      }
      const contextTypes = Array.isArray(intentDef.contexts) ? intentDef.contexts : []
      return isContextTypeCompatible(contextTypes, contextType)
    })
    .map(([intentName]) => intentName)
}

export function isDirectoryIntentCompatible(
  appDirectory: AppDirectoryManager,
  appId: string,
  intentName: string,
  contextType: string
): boolean {
  return getDirectoryIntentsForContext(appDirectory, appId, contextType).includes(intentName)
}
