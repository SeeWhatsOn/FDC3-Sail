import { createDACPSuccessResponse } from "../../../dacp-protocol/dacp-message-creators"
import { type DACPHandlerContext } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { ResolveError } from "@finos/fdc3"
import { AppInstanceState } from "../../../state/types"
import {
  NoAppsFoundError,
  TargetAppUnavailableError,
  TargetInstanceUnavailableError,
  FDC3ResolveError,
} from "../../../errors/fdc3-errors"
import { getAllIntentListeners, getInstance, getInstancesByAppId } from "../../../state/selectors"
import { addPendingIntent, resolvePendingIntent } from "../../../state/mutators"
import { findIntentHandlers, findIntentsByContext, launchAppAndWaitForInstance, pendingIntentPromises } from "./intent-helpers"
import { createResolverAppIntent } from "./intent-resolver-helpers"
import { getDirectoryIntentsForContext } from "./intent-directory-helpers"
import { attemptIntentDelivery, queueIntentDelivery } from "./intent-delivery-helpers"

export async function handleRaiseIntentForContextRequest(
  message: BrowserTypes.RaiseIntentForContextRequest,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, setState, appDirectory, logger } = context

  try {
    const payload = message.payload
    const validatedContext = payload.context

    const targetApp =
      typeof payload.app === "string" ? { appId: payload.app } : payload.app ?? undefined

    if (targetApp) {
      const targetAppId = targetApp.appId
      const targetInstanceId = targetApp.instanceId

      const apps = appDirectory.retrieveAppsById(targetAppId)
      if (apps.length === 0) {
        throw new TargetAppUnavailableError(`App not found in directory: ${targetAppId}`)
      }

      if (targetInstanceId) {
        const state = getState()
        const instance = getInstance(state, targetInstanceId)
        if (!instance || instance.state === AppInstanceState.TERMINATED) {
          throw new TargetInstanceUnavailableError(
            `Instance not found or terminated: ${targetInstanceId}`
          )
        }
      }
    }

    const source = getInstance(getState(), instanceId)
    if (!source) {
      throw new Error(`Source instance ${instanceId} not found`)
    }

    const intentMetadata = findIntentsByContext(getState(), appDirectory, validatedContext.type)
    if (intentMetadata.length === 0) {
      throw new NoAppsFoundError(
        `No intents found to handle context type: ${validatedContext.type}`
      )
    }

    const targetAppId = targetApp?.appId
    const directoryIntents = targetAppId
      ? getDirectoryIntentsForContext(appDirectory, targetAppId, validatedContext.type)
      : []

    const dynamicIntents = targetAppId
      ? getAllIntentListeners(getState())
          .filter(listener => listener.appId === targetAppId && listener.active)
          .map(listener => listener.intentName)
      : []

    const intentCandidates =
      targetAppId && directoryIntents.length > 0
        ? directoryIntents
        : targetAppId && dynamicIntents.length > 0
          ? dynamicIntents
          : intentMetadata.map(intent => intent.name)

    if (intentCandidates.length === 0) {
      throw new NoAppsFoundError(
        `No intents found to handle context type: ${validatedContext.type}`
      )
    }

    if (!targetApp && intentCandidates.length > 1) {
      const appIntents = intentCandidates
        .map(intentName =>
          createResolverAppIntent(getState(), appDirectory, intentName, validatedContext.type)
        )
        .filter(appIntent => appIntent.apps.length > 0)

      if (appIntents.length === 0) {
        throw new NoAppsFoundError(
          `No apps found to handle context type: ${validatedContext.type}`
        )
      }

      const response = createDACPSuccessResponse(message, "raiseIntentForContextResponse", {
        appIntents,
      })
      sendDACPResponse({ response, instanceId, transport })
      return
    }

    const selectedIntent = intentCandidates[0]

    const state = getState()
    const handlers = findIntentHandlers(state, appDirectory, {
      intent: selectedIntent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target: targetApp,
    })

    let targetInstanceId: string
    let targetInstanceIsLaunched = false

    if (targetApp?.instanceId) {
      targetInstanceId = targetApp.instanceId
    } else if (targetAppId) {
      const runningListener = handlers.runningListeners.find(listener => listener.appId === targetAppId)
      const runningInstances = getInstancesByAppId(state, targetAppId).filter(
        instance => instance.state !== AppInstanceState.TERMINATED
      )

      if (runningListener) {
        targetInstanceId = runningListener.instanceId
      } else if (runningInstances.length > 0) {
        targetInstanceId = runningInstances[0].instanceId
      } else {
        targetInstanceIsLaunched = true
        targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)
      }
    } else if (handlers.runningListeners.length > 0) {
      targetInstanceId = handlers.runningListeners[0].instanceId
    } else if (handlers.availableApps.length > 0) {
      targetInstanceIsLaunched = true
      targetInstanceId = await launchAppAndWaitForInstance(
        handlers.availableApps[0].appId,
        context,
        validatedContext
      )
    } else {
      throw new NoAppsFoundError(`No handler found for intent: ${selectedIntent}`)
    }

    const requestId = message.meta.requestUuid
    let resolvePromise: (result: unknown) => void = () => {}
    let rejectPromise: (error: Error) => void = () => {}
    void new Promise<unknown>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })

    pendingIntentPromises.set(requestId, {
      resolve: resolvePromise,
      reject: rejectPromise,
      requestType: "raiseIntentForContextRequest",
    })

    const targetInstance = getInstance(getState(), targetInstanceId)
    const resolvedTargetAppId = targetInstance?.appId ?? targetAppId ?? source.appId

    setState(state =>
      addPendingIntent(state, {
        requestId,
        intentName: selectedIntent,
        context: validatedContext,
        sourceInstanceId: instanceId,
        targetInstanceId,
        targetAppId: resolvedTargetAppId,
      })
    )

    if (targetInstanceIsLaunched) {
      queueIntentDelivery(context, requestId, true)
    } else {
      attemptIntentDelivery(context, requestId, false)
    }

    const timeoutHandle = setTimeout(() => {
      if (pendingIntentPromises.has(requestId)) {
        pendingIntentPromises.delete(requestId)
        setState(state => resolvePendingIntent(state, requestId))
      }
    }, 30000)

    const promiseData = pendingIntentPromises.get(requestId)
    if (promiseData) {
      promiseData.timeoutHandle = timeoutHandle
    }
  } catch (error) {
    logger.error("DACP: Raise intent for context request failed", error)

    let errorType: ResolveError = ResolveError.IntentDeliveryFailed
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (error instanceof FDC3ResolveError) {
      errorType = error.errorType
    } else if (
      errorMessage.includes("No apps found") ||
      errorMessage.includes("No handler found") ||
      errorMessage.includes("No intents found")
    ) {
      errorType = ResolveError.NoAppsFound
    } else if (errorMessage.includes("App not found in directory")) {
      errorType = ResolveError.TargetAppUnavailable
    } else if (errorMessage.includes("not found") && errorMessage.includes("instance")) {
      errorType = ResolveError.TargetInstanceUnavailable
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
