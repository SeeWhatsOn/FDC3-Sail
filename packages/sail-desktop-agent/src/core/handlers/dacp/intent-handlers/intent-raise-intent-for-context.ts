import { createDACPSuccessResponse } from "../../../dacp-protocol/dacp-message-creators"
import { type DACPHandlerContext } from "../../types"
import { sendDACPResponse, sendDACPErrorResponse } from "../utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { ResolveError } from "@finos/fdc3"
import {
  NoAppsFoundError,
  IntentDeliveryFailedError,
  UserCancelledError,
} from "../../../errors/fdc3-errors"
import { getAllIntentListeners, getInstance } from "../../../state/selectors"
import {
  findIntentHandlers,
  findIntentsByContext,
  launchAppAndWaitForInstance,
} from "./intent-helpers"
import { createResolverAppIntent, appsToIntentHandlerOptions } from "./intent-resolver-helpers"
import { getDirectoryIntentsForContext } from "./intent-directory-helpers"
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

function selectIntentCandidatesForContext(
  targetAppId: string | undefined,
  directoryIntents: string[],
  dynamicIntents: string[],
  discoveredIntentNames: string[],
  contextType: string
): string[] {
  if (targetAppId) {
    // Respect explicit targeting: do not fall back to other apps.
    if (directoryIntents.length > 0) {
      return directoryIntents
    }
    if (dynamicIntents.length > 0) {
      return dynamicIntents
    }
    throw new NoAppsFoundError(
      `Target app ${targetAppId} has no intents that handle context type: ${contextType}`
    )
  }

  if (discoveredIntentNames.length === 0) {
    throw new NoAppsFoundError(`No intents found to handle context type: ${contextType}`)
  }

  return discoveredIntentNames
}

function buildResolverAppIntents(
  context: DACPHandlerContext,
  intentCandidates: string[],
  contextType: string
) {
  const { getState, appDirectory } = context
  return intentCandidates
    .map(intentName => createResolverAppIntent(getState(), appDirectory, intentName, contextType))
    .filter(appIntent => appIntent.apps.length > 0)
}

function finalizeRaiseIntentForContextDelivery(
  context: DACPHandlerContext,
  message: BrowserTypes.RaiseIntentForContextRequest,
  sourceInstanceId: string,
  intentName: string,
  validatedContext: BrowserTypes.Context,
  targetInstanceId: string,
  targetAppId: string,
  targetInstanceIsLaunched: boolean
): void {
  const requestId = message.meta.requestUuid
  registerPendingIntentPromise(context, requestId, "raiseIntentForContextRequest")
  registerPendingIntentState(context, {
    requestId,
    intentName,
    context: validatedContext,
    sourceInstanceId,
    targetInstanceId,
    targetAppId,
  })
  schedulePendingIntentDelivery(
    context,
    requestId,
    targetInstanceId,
    intentName,
    targetInstanceIsLaunched
  )
  attachPendingIntentTimeout(context, requestId)
}

export async function handleRaiseIntentForContextRequest(
  message: BrowserTypes.RaiseIntentForContextRequest,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, appDirectory, logger } = context

  try {
    const payload = message.payload
    if (!isValidContext(payload.context)) {
      sendDACPErrorResponse({
        message,
        errorType: ResolveError.MalformedContext,
        errorMessage: "Invalid context: context must be an object with a string type property",
        instanceId,
        transport,
      })
      return
    }
    const validatedContext = payload.context

    const targetApp = normalizeTargetApp(payload.app)
    validateRequestedTargetAvailability(context, targetApp)

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

    const intentCandidates = selectIntentCandidatesForContext(
      targetAppId,
      directoryIntents,
      dynamicIntents,
      intentMetadata.map(intent => intent.name),
      validatedContext.type
    )

    const selectedIntent = intentCandidates[0]
    let targetInstanceId: string | undefined
    let targetInstanceIsLaunched = false

    if (!targetApp && intentCandidates.length > 1) {
      const appIntents = buildResolverAppIntents(context, intentCandidates, validatedContext.type)

      if (appIntents.length === 0) {
        throw new NoAppsFoundError(`No apps found to handle context type: ${validatedContext.type}`)
      }

      if (context.requestIntentResolution) {
        // Keep cancellation semantics for environments that provide an out-of-band resolver callback,
        // but always return chooser data to the requesting app for multi-intent context resolution.
        const firstIntent = intentCandidates[0]
        const firstAppIntent = createResolverAppIntent(
          getState(),
          appDirectory,
          firstIntent,
          validatedContext.type
        )
        if (firstAppIntent.apps.length === 0) {
          throw new NoAppsFoundError(
            `No apps found to handle context type: ${validatedContext.type}`
          )
        }
        const requestId = message.meta.requestUuid
        const handlerOptions = appsToIntentHandlerOptions(getState(), firstAppIntent.apps)
        const resolution = await context.requestIntentResolution({
          requestId,
          intent: firstIntent,
          context: validatedContext,
          handlers: handlerOptions,
        })
        if (resolution.selectedHandler === null) {
          throw new UserCancelledError("User cancelled intent resolution")
        }
      }

      const response = createDACPSuccessResponse(message, "raiseIntentForContextResponse", {
        appIntents,
      })
      sendDACPResponse({ response, instanceId, transport })
      return
    } else {
      const state = getState()
      const handlers = findIntentHandlers(state, appDirectory, {
        intent: selectedIntent,
        context: validatedContext,
        source: { appId: source.appId, instanceId: source.instanceId },
        target: targetApp,
      })

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
    }

    if (!targetInstanceId) {
      throw new IntentDeliveryFailedError("No target instance resolved for raiseIntentForContext")
    }

    const targetInstance = getInstance(getState(), targetInstanceId)
    const resolvedTargetAppId = targetInstance?.appId ?? targetAppId ?? source.appId

    finalizeRaiseIntentForContextDelivery(
      context,
      message,
      instanceId,
      selectedIntent,
      validatedContext,
      targetInstanceId,
      resolvedTargetAppId,
      targetInstanceIsLaunched
    )
  } catch (error) {
    const requestId = message.meta.requestUuid
    cleanupPendingIntentRequest(context, requestId)

    logger.error("DACP: Raise intent for context request failed", error)

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
