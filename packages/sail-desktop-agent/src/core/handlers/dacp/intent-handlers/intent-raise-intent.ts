import { createDACPSuccessResponse } from "../../../dacp-protocol/dacp-message-creators"
import { type DACPHandlerContext } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { ResolveError } from "@finos/fdc3"
import { AppInstanceState } from "../../../state/types"
import {
  NoAppsFoundError,
  IntentDeliveryFailedError,
  UserCancelledError,
} from "../../../errors/fdc3-errors"
import { getInstance, getInstancesByAppId } from "../../../state/selectors"
import { findIntentHandlers, launchAppAndWaitForInstance } from "./intent-helpers"
import { appsToIntentHandlerOptions, createResolverAppIntent } from "./intent-resolver-helpers"
import { isDirectoryIntentCompatible } from "./intent-directory-helpers"
import { isValidContext } from "../utils/context-validation"
import {
  attachPendingIntentTimeout,
  cleanupPendingIntentRequest,
  mapIntentRaiseErrorToResolveError,
  normalizeTargetApp,
  registerPendingIntentPromise,
  registerPendingIntentState,
  resolveAppTargetInstance,
  schedulePendingIntentDelivery,
  validateRequestedTargetAvailability,
} from "./intent-raise-shared"

export async function handleRaiseIntentRequest(
  message: BrowserTypes.RaiseIntentRequest,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, appDirectory, logger } = context

  try {
    const payload = message.payload

    if (payload.context !== undefined && !isValidContext(payload.context)) {
      sendDACPErrorResponse({
        message,
        errorType: ResolveError.MalformedContext,
        errorMessage: "Invalid context: context must be an object with a string type property",
        instanceId,
        transport,
      })
      return
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

    const targetApp: { appId: string; instanceId?: string } | undefined = normalizeTargetApp(
      payload.app as unknown
    )
    validateRequestedTargetAvailability(context, targetApp)

    const source = getInstance(getState(), instanceId)
    if (!source) {
      throw new IntentDeliveryFailedError(`Source instance ${instanceId} not found`)
    }

    const state = getState()
    const handlers = findIntentHandlers(state, appDirectory, {
      intent: payload.intent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target: targetApp,
    })

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

    // Resolve target instance in priority order: explicit instance -> targeted app -> resolver selection -> running listener -> launch.
    if (targetApp?.instanceId) {
      targetInstanceId = targetApp.instanceId
    } else if (targetAppId) {
      const runningListener = handlers.runningListeners.find(
        listener => listener.appId === targetAppId
      )
      const resolvedTarget = await resolveAppTargetInstance(context, {
        appId: targetAppId,
        validatedContext,
        runningListenerInstanceId: runningListener?.instanceId,
      })
      targetInstanceId = resolvedTarget.targetInstanceId
      targetInstanceIsLaunched = resolvedTarget.targetInstanceIsLaunched
    } else if (handlers.compatibleApps.length > 1) {
      const appIntent = createResolverAppIntent(
        getState(),
        appDirectory,
        payload.intent,
        validatedContext.type
      )
      if (context.requestIntentResolution) {
        const resolution = await context.requestIntentResolution({
          requestId: message.meta.requestUuid,
          intent: payload.intent,
          context: validatedContext,
          handlers: appsToIntentHandlerOptions(getState(), appIntent.apps),
        })
        if (resolution.selectedHandler == null) {
          throw new UserCancelledError("User cancelled intent resolution")
        }
      }
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

    registerPendingIntentPromise(context, requestId, "raiseIntentRequest")

    const targetInstance = getInstance(getState(), targetInstanceId)
    const resolvedTargetAppId = targetInstance?.appId ?? targetAppId ?? source.appId

    // Keep pending intent in both runtime map (timeouts/delivery state) and serializable state (routing/result lifecycle).
    registerPendingIntentState(context, {
      requestId,
      intentName: payload.intent,
      context: validatedContext,
      sourceInstanceId: instanceId,
      targetInstanceId,
      targetAppId: resolvedTargetAppId,
    })

    // Newly launched apps may not have registered listeners yet, so queue delivery until ready.
    schedulePendingIntentDelivery(
      context,
      requestId,
      targetInstanceId,
      payload.intent,
      targetInstanceIsLaunched
    )

    attachPendingIntentTimeout(context, requestId)
  } catch (error) {
    const requestId = message.meta.requestUuid
    cleanupPendingIntentRequest(context, requestId)

    const payload = message.payload
    const contextPayload = payload?.context as Record<string, unknown> | undefined

    logger.error("DACP: Raise intent request failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      contextType: contextPayload?.type,
      contextHasName: typeof contextPayload?.name === "string",
    })

    const errorType = mapIntentRaiseErrorToResolveError(error)
    const errorMessage = error instanceof Error ? error.message : String(error)

    sendDACPErrorResponse({
      message,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}
