import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createIntentEvent,
  DACP_ERROR_TYPES,
  generateEventUuid,
} from "../validation/dacp-validator"
import {
  RaiseintentrequestSchema,
  AddintentlistenerrequestSchema,
  IntentlistenerunsubscriberequestSchema,
  FindintentrequestSchema,
  IntentresultrequestSchema,
  ContextSchema,
} from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"
import { type Context } from "@finos/fdc3"

export async function handleRaiseIntentRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, appInstanceRegistry, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, RaiseintentrequestSchema)

    logger.info("DACP: Processing raise intent request", {
      intent: request.payload.intent,
      requestUuid: request.meta.requestUuid,
    })

    const validatedContext = validateDACPMessage(request.payload.context, ContextSchema)
    const source = appInstanceRegistry.getInstance(instanceId)

    if (!source) {
      throw new Error(`Source instance ${instanceId} not found`)
    }

    // Find intent handlers for this request
    const handlers = intentRegistry.findIntentHandlers({
      intent: request.payload.intent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target: request.payload.app ? { appId: request.payload.app } : undefined,
      requestId: request.meta.requestUuid,
    })

    // Check if we have any compatible handlers
    if (handlers.compatibleApps.length === 0) {
      throw new Error(`No apps found to handle intent: ${request.payload.intent}`)
    }

    // For now, select the first running listener or first available app
    // TODO: Implement UI resolution when multiple handlers exist
    let targetInstanceId: string
    let targetAppId: string

    if (handlers.runningListeners.length > 0) {
      // Use a running listener (preferred)
      const listener = handlers.runningListeners[0]
      targetInstanceId = listener.instanceId
      targetAppId = listener.appId
    } else if (handlers.availableApps.length > 0) {
      // Need to launch an app
      const appCapability = handlers.availableApps[0]
      targetAppId = appCapability.appId
      // TODO: Implement app launching logic
      throw new Error(`App launching not yet implemented for: ${targetAppId}`)
    } else {
      throw new Error(`No handler found for intent: ${request.payload.intent}`)
    }

    // Register pending intent and get promise for result
    const resultPromise = intentRegistry.registerPendingIntent({
      requestId: request.meta.requestUuid,
      intentName: request.payload.intent,
      context: validatedContext,
      sourceInstanceId: instanceId,
      targetInstanceId,
      targetAppId,
      timeoutMs: 30000,
    })

    // Send intentEvent to target app
    const intentEvent = createIntentEvent(
      request.payload.intent,
      validatedContext,
      request.meta.requestUuid,
      instanceId
    )

    logger.info("DACP: Sending intentEvent to target app", {
      targetInstanceId,
      intent: request.payload.intent,
      requestUuid: request.meta.requestUuid,
    })

    transport.send(targetInstanceId, intentEvent)

    // Wait for the result from intentResultRequest handler
    const intentResult = await resultPromise

    // Send response back to source app
    const response = createDACPSuccessResponse(request, "raiseIntentResponse", {
      intentResult,
      source: targetAppId,
    })

    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: Raise intent request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED,
      "raiseIntentResponse",
      error instanceof Error ? error.message : "Intent delivery failed"
    )
    transport.send(instanceId, errorResponse)
  }
}

export function handleAddIntentListener(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, AddintentlistenerrequestSchema)
    const instance = appInstanceRegistry.getInstance(instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for adding intent listener`)
    }

    const listenerId = generateEventUuid()

    intentRegistry.registerListener({
      listenerId,
      intentName: request.payload.intent,
      instanceId,
      appId: instance.appId,
    })

    const response = createDACPSuccessResponse(request, "addIntentListenerResponse", {
      listenerId,
    })

    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: Add intent listener failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "addIntentListenerResponse",
      error instanceof Error ? error.message : "Failed to add intent listener"
    )
    transport.send(instanceId, errorResponse)
  }
}

export function handleIntentListenerUnsubscribe(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, IntentlistenerunsubscriberequestSchema)
    const listenerId = (request.payload as { listenerId: string }).listenerId

    const unregistered = intentRegistry.unregisterListener(listenerId)
    if (!unregistered) {
      throw new Error(`Intent listener ${listenerId} not found`)
    }

    const response = createDACPSuccessResponse(request, "intentListenerUnsubscribeResponse")
    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: Intent listener unsubscribe failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "intentListenerUnsubscribeResponse",
      error instanceof Error ? error.message : "Failed to unsubscribe intent listener"
    )
    transport.send(instanceId, errorResponse)
  }
}

export function handleFindIntentRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, FindintentrequestSchema)
    const intent = (request.payload as { intent: string }).intent
    const contextType = (request.payload as { context: Context })?.context?.type

    const appIntents = intentRegistry.createAppIntents(intent, contextType)

    const response = createDACPSuccessResponse(request, "findIntentResponse", {
      appIntent: appIntents[0] ?? { intent: { name: intent, displayName: intent }, apps: [] },
    })

    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: Find intent request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.NO_APPS_FOUND,
      "findIntentResponse",
      error instanceof Error ? error.message : "Failed to find apps for intent"
    )
    transport.send(instanceId, errorResponse)
  }
}

export function handleIntentResultRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, IntentresultrequestSchema)

    logger.info("DACP: Processing intent result request", {
      requestUuid: request.meta.requestUuid,
      responseToRequestUuid: request.meta.responseToRequestUuid,
    })

    // Get the original request ID from meta.responseToRequestUuid
    const originalRequestId = request.meta.responseToRequestUuid

    // Check if there's a pending intent for this request
    const pendingIntent = intentRegistry.getPendingIntent(originalRequestId)

    if (!pendingIntent) {
      throw new Error(`No pending intent found for request: ${originalRequestId}`)
    }

    // Verify that the instanceId matches the target instance
    if (pendingIntent.targetInstanceId !== instanceId) {
      throw new Error(
        `Intent result from wrong instance. Expected ${pendingIntent.targetInstanceId}, got ${instanceId}`
      )
    }

    // Check for error in the result
    if (request.payload.error) {
      const error = new Error(request.payload.error)
      intentRegistry.rejectPendingIntent(originalRequestId, error)

      // Send acknowledgment response
      const response = createDACPSuccessResponse(request, "intentResultResponse")
      transport.send(instanceId, response)
      return
    }

    // Resolve the pending intent with the result
    const intentResult = request.payload.intentResult
    intentRegistry.resolvePendingIntent(originalRequestId, intentResult)

    // Send acknowledgment response
    const response = createDACPSuccessResponse(request, "intentResultResponse")
    transport.send(instanceId, response)

    logger.info("DACP: Intent result processed successfully", {
      originalRequestId,
      hasResult: !!intentResult,
    })
  } catch (error) {
    logger.error("DACP: Intent result request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED,
      "intentResultResponse",
      error instanceof Error ? error.message : "Failed to process intent result"
    )
    transport.send(instanceId, errorResponse)
  }
}
