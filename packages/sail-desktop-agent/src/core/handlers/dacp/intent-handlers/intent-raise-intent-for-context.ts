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
  IntentDeliveryFailedError,
} from "../../../errors/fdc3-errors"
import { getAllIntentListeners, getInstance, getInstancesByAppId } from "../../../state/selectors"
import { addPendingIntent, resolvePendingIntent } from "../../../state/mutators"
import { findIntentHandlers, findIntentsByContext, launchAppAndWaitForInstance } from "./intent-helpers"
import { createResolverAppIntent } from "./intent-resolver-helpers"
import { getDirectoryIntentsForContext } from "./intent-directory-helpers"
import {
  attemptIntentDelivery,
  queueIntentDelivery,
  isIntentListenerReady,
} from "./intent-delivery-helpers"

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
      throw new IntentDeliveryFailedError(`Source instance ${instanceId} not found`)
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

    let intentCandidates: string[]

    if (targetAppId) {
      // When a target app is specified, ONLY use that app's intents
      // Never fall back to other apps - that would violate the user's explicit target
      if (directoryIntents.length > 0) {
        intentCandidates = directoryIntents
      } else if (dynamicIntents.length > 0) {
        intentCandidates = dynamicIntents
      } else {
        // Target app specified but has no compatible intents - this is an error
        throw new NoAppsFoundError(
          `Target app ${targetAppId} has no intents that handle context type: ${validatedContext.type}`
        )
      }
    } else {
      // No target specified - use all available intents
      intentCandidates = intentMetadata.map(intent => intent.name)

      if (intentCandidates.length === 0) {
        throw new NoAppsFoundError(
          `No intents found to handle context type: ${validatedContext.type}`
        )
      }
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

    context.pendingIntentPromises.set(requestId, {
      resolve: () => {},
      reject: () => {},
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

    // Check if we need to wait for the listener to be ready
    // This matches the behavior in raiseIntent handler
    const shouldWaitForListener =
      targetInstanceIsLaunched ||
      !isIntentListenerReady(context, targetInstanceId, selectedIntent)

    if (shouldWaitForListener) {
      queueIntentDelivery(context, requestId, true)
    } else {
      attemptIntentDelivery(context, requestId, false)
    }

    const timeoutHandle = setTimeout(() => {
      if (context.pendingIntentPromises.has(requestId)) {
        context.pendingIntentPromises.delete(requestId)
        setState(state => resolvePendingIntent(state, requestId))
      }
    }, 30000)

    const promiseData = context.pendingIntentPromises.get(requestId)
    if (promiseData) {
      promiseData.timeoutHandle = timeoutHandle
    }
  } catch (error) {
    // Clean up any partial pending intent state
    const requestId = message.meta.requestUuid
    const pendingEntry = context.pendingIntentPromises.get(requestId)
    if (pendingEntry) {
      if (pendingEntry.timeoutHandle) {
        clearTimeout(pendingEntry.timeoutHandle)
      }
      if (pendingEntry.deliveryTimeoutHandle) {
        clearTimeout(pendingEntry.deliveryTimeoutHandle)
      }
      context.pendingIntentPromises.delete(requestId)
    }

    logger.error("DACP: Raise intent for context request failed", error)

    let errorType: ResolveError = ResolveError.IntentDeliveryFailed
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (error instanceof NoAppsFoundError) {
      errorType = ResolveError.NoAppsFound
    } else if (error instanceof TargetAppUnavailableError) {
      errorType = ResolveError.TargetAppUnavailable
    } else if (error instanceof TargetInstanceUnavailableError) {
      errorType = ResolveError.TargetInstanceUnavailable
    } else if (error instanceof FDC3ResolveError) {
      errorType = error.errorType
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
