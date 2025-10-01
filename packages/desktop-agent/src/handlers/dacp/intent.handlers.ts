import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  // createDACPEvent,
  DACP_ERROR_TYPES,
  generateEventUuid,
} from "../validation/dacp-validator"
import {
  RaiseintentrequestSchema,
  AddintentlistenerrequestSchema,
  IntentlistenerunsubscriberequestSchema,
  FindintentrequestSchema,
  ContextSchema,
} from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"
import { type Context } from "@finos/fdc3"

export async function handleRaiseIntentRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { socket, instanceId, appInstanceRegistry, intentRegistry } = context

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

    // The intent resolution logic is complex and will be handled by the IntentRegistry
    const intentResolution = await intentRegistry.resolveIntent({
      intent: request.payload.intent,
      context: validatedContext,
      source: { appId: source.appId, instanceId: source.instanceId },
      target: request.payload.app ? { appId: request.payload.app } : undefined,
      requestId: request.meta.requestUuid,
    })

    const intentResult = await intentResolution.getResult()

    const response = createDACPSuccessResponse(request, "raiseIntentResponse", {
      intentResult: intentResult,
      source: intentResolution.source?.appId,
    })

    socket.emit("fdc3_message", response)
  } catch (error) {
    logger.error("DACP: Raise intent request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED,
      "raiseIntentResponse",
      error instanceof Error ? error.message : "Intent delivery failed"
    )
    socket.emit("fdc3_message", errorResponse)
  }
}

export function handleAddIntentListener(message: unknown, context: DACPHandlerContext): void {
  const { socket, instanceId, appInstanceRegistry, intentRegistry } = context

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

    socket.emit("fdc3_message", response)
  } catch (error) {
    logger.error("DACP: Add intent listener failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "addIntentListenerResponse",
      error instanceof Error ? error.message : "Failed to add intent listener"
    )
    socket.emit("fdc3_message", errorResponse)
  }
}

export function handleIntentListenerUnsubscribe(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { socket, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, IntentlistenerunsubscriberequestSchema)
    const listenerId = (request.payload as { listenerId: string }).listenerId

    const unregistered = intentRegistry.unregisterListener(listenerId)
    if (!unregistered) {
      throw new Error(`Intent listener ${listenerId} not found`)
    }

    const response = createDACPSuccessResponse(request, "intentListenerUnsubscribeResponse")
    socket.emit("fdc3_message", response)
  } catch (error) {
    logger.error("DACP: Intent listener unsubscribe failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "intentListenerUnsubscribeResponse",
      error instanceof Error ? error.message : "Failed to unsubscribe intent listener"
    )
    socket.emit("fdc3_message", errorResponse)
  }
}

export function handleFindIntentRequest(message: unknown, context: DACPHandlerContext): void {
  const { socket, intentRegistry } = context

  try {
    const request = validateDACPMessage(message, FindintentrequestSchema)
    const intent = (request.payload as { intent: string }).intent
    const contextType = (request.payload as { context: Context })?.context?.type

    const appIntents = intentRegistry.createAppIntents(intent, contextType)

    const response = createDACPSuccessResponse(request, "findIntentResponse", {
      appIntent: appIntents[0] ?? { intent: { name: intent, displayName: intent }, apps: [] },
    })

    socket.emit("fdc3_message", response)
  } catch (error) {
    logger.error("DACP: Find intent request failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.NO_APPS_FOUND,
      "findIntentResponse",
      error instanceof Error ? error.message : "Failed to find apps for intent"
    )
    socket.emit("fdc3_message", errorResponse)
  }
}
