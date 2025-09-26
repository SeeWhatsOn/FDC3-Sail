import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
  generateEventUuid,
  DACPErrorType,
} from '../validation/dacp-validator'
import {
  RaiseintentrequestSchema,
  Raiseintentrequest,
  AddintentlistenerrequestSchema,
  IntentlistenerunsubscriberequestSchema,
  FindintentrequestSchema,
  ContextSchema,
} from '../validation/dacp-schemas'
import { DACPHandlerContext, logger } from '../types'
import { Context, AppMetadata, IntentResolution } from '@finos/fdc3'
import { intentRegistry } from '../../state/IntentRegistry'
import { appInstanceRegistry } from '../../state/AppInstanceRegistry'

export async function handleRaiseIntentRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort, instanceId } = context

  try {
    const request = validateDACPMessage(message, RaiseintentrequestSchema)

    logger.info('DACP: Processing raise intent request', {
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

    const response = createDACPSuccessResponse(request, 'raiseIntentResponse', {
      intentResult: intentResult,
      source: intentResolution.source?.appId,
    })

    messagePort.postMessage(response)
  } catch (error) {
    logger.error('DACP: Raise intent request failed', error)
    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED,
      'raiseIntentResponse',
      error instanceof Error ? error.message : 'Intent delivery failed'
    )
    messagePort.postMessage(errorResponse)
  }
}

export async function handleAddIntentListener(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort, instanceId } = context

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

    const response = createDACPSuccessResponse(request, 'addIntentListenerResponse', {
      listenerId,
    })

    messagePort.postMessage(response)
  } catch (error) {
    logger.error('DACP: Add intent listener failed', error)
    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.LISTENER_ERROR,
      'addIntentListenerResponse',
      error instanceof Error ? error.message : 'Failed to add intent listener'
    )
    messagePort.postMessage(errorResponse)
  }
}

export async function handleIntentListenerUnsubscribe(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort } = context

  try {
    const request = validateDACPMessage(message, IntentlistenerunsubscriberequestSchema)
    const listenerId = request.payload.listenerId as string;

    const unregistered = intentRegistry.unregisterListener(listenerId)
    if (!unregistered) {
      throw new Error(`Intent listener ${listenerId} not found`)
    }

    const response = createDACPSuccessResponse(request, 'intentListenerUnsubscribeResponse')
    messagePort.postMessage(response)
  } catch (error) {
    logger.error('DACP: Intent listener unsubscribe failed', error)
    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.LISTENER_ERROR,
      'intentListenerUnsubscribeResponse',
      error instanceof Error ? error.message : 'Failed to unsubscribe intent listener'
    )
    messagePort.postMessage(errorResponse)
  }
}

export async function handleFindIntentRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort } = context

  try {
    const request = validateDACPMessage(message, FindintentrequestSchema)
    const intent = request.payload.intent as string;
    const contextType = (request.payload.context as Context)?.type;

    const appIntents = intentRegistry.createAppIntents(intent, contextType)

    const response = createDACPSuccessResponse(request, 'findIntentResponse', {
      appIntent: appIntents[0] ?? { intent: { name: intent, displayName: intent }, apps: [] },
    })

    messagePort.postMessage(response)
  } catch (error) {
    logger.error('DACP: Find intent request failed', error)
    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.NO_APPS_FOUND,
      'findIntentResponse',
      error instanceof Error ? error.message : 'Failed to find apps for intent'
    )
    messagePort.postMessage(errorResponse)
  }
}