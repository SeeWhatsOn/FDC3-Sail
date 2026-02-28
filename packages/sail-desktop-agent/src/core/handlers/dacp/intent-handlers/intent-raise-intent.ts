import { createDACPSuccessResponse } from "../../../dacp-protocol/dacp-message-creators"
import { type DACPHandlerContext } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { ResolveError } from "@finos/fdc3"
import { AppInstanceState } from "../../../state/types"
import {
  NoAppsFoundError,
  TargetAppUnavailableError,
  TargetInstanceUnavailableError,
  FDC3ResolveError,
  IntentDeliveryFailedError,
} from "../../../errors/fdc3-errors"
import { getInstance, getInstancesByAppId } from "../../../state/selectors"
import { addPendingIntent, resolvePendingIntent } from "../../../state/mutators"
import { findIntentHandlers, launchAppAndWaitForInstance } from "./intent-helpers"
import { createResolverAppIntent } from "./intent-resolver-helpers"
import { isDirectoryIntentCompatible } from "./intent-directory-helpers"
import {
  attemptIntentDelivery,
  queueIntentDelivery,
  isIntentListenerReady,
} from "./intent-delivery-helpers"

export async function handleRaiseIntentRequest(
  message: BrowserTypes.RaiseIntentRequest,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, setState, appDirectory, logger } = context

  try {
    const payload = message.payload

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

    if (payload.app) {
      const targetAppId = typeof payload.app === "string" ? payload.app : payload.app.appId
      const targetInstanceId = typeof payload.app === "object" ? payload.app.instanceId : undefined

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

    const state = getState()
    const handlers = findIntentHandlers(state, appDirectory, {
      intent: payload.intent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target: typeof payload.app === "string" ? { appId: payload.app } : payload.app,
    })

    const targetApp =
      typeof payload.app === "string" ? { appId: payload.app } : (payload.app ?? undefined)

    const targetAppId = targetApp?.appId
    const runningInstances = targetAppId
      ? getInstancesByAppId(state, targetAppId).filter(
          instance => instance.state !== AppInstanceState.TERMINATED
        )
      : []
    const isTargetRunning =
      !!targetApp?.instanceId || (targetAppId ? runningInstances.length > 0 : false)

    if (
      targetAppId &&
      isTargetRunning &&
      !isDirectoryIntentCompatible(
        appDirectory,
        targetAppId,
        payload.intent,
        validatedContext.type
      ) &&
      handlers.runningListeners.length === 0
    ) {
      throw new NoAppsFoundError(`No apps found to handle intent: ${payload.intent}`)
    }

    if (!targetApp && handlers.compatibleApps.length === 0) {
      throw new NoAppsFoundError(`No apps found to handle intent: ${payload.intent}`)
    }

    let targetInstanceId: string
    let targetInstanceIsLaunched = false

    if (targetApp?.instanceId) {
      targetInstanceId = targetApp.instanceId
    } else if (targetAppId) {
      const runningListener = handlers.runningListeners.find(
        listener => listener.appId === targetAppId
      )
      if (runningListener) {
        targetInstanceId = runningListener.instanceId
      } else if (runningInstances.length > 0) {
        targetInstanceId = runningInstances[0].instanceId
      } else {
        targetInstanceIsLaunched = true
        targetInstanceId = await launchAppAndWaitForInstance(targetAppId, context, validatedContext)
      }
    } else if (handlers.compatibleApps.length > 1) {
      const appIntent = createResolverAppIntent(
        getState(),
        appDirectory,
        payload.intent,
        validatedContext.type
      )
      const response = createDACPSuccessResponse(message, "raiseIntentResponse", { appIntent })
      sendDACPResponse({ response, instanceId, transport })
      return
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
      throw new NoAppsFoundError(`No handler found for intent: ${payload.intent}`)
    }

    const requestId = message.meta.requestUuid

    // Store pending intent state (resolve/reject not needed - we use timeouts and direct responses)
    context.pendingIntentPromises.set(requestId, {
      resolve: () => {},
      reject: () => {},
      requestType: "raiseIntentRequest",
    })

    const targetInstance = getInstance(getState(), targetInstanceId)
    const resolvedTargetAppId = targetInstance?.appId ?? targetAppId ?? source.appId

    setState(state =>
      addPendingIntent(state, {
        requestId,
        intentName: payload.intent,
        context: validatedContext,
        sourceInstanceId: instanceId,
        targetInstanceId,
        targetAppId: resolvedTargetAppId,
      })
    )

    const shouldWaitForListener =
      targetInstanceIsLaunched || !isIntentListenerReady(context, targetInstanceId, payload.intent)

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

    const payload = message.payload
    const contextPayload = payload?.context as Record<string, unknown> | undefined

    logger.error("DACP: Raise intent request failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      contextType: contextPayload?.type,
      contextHasName: typeof contextPayload?.name === "string",
    })

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
