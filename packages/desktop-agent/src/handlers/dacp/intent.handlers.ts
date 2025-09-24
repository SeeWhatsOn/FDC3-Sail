import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
  generateEventUuid,
  DACPErrorType
} from '../validation/dacp-validator'
import {
  RaiseintentrequestSchema,
  Raiseintentrequest,
  AddintentlistenerrequestSchema,
  ContextSchema
} from '../validation/dacp-schemas'
import { DACPHandlerContext, logger } from '../types'
import { Context, AppMetadata, IntentResolution } from '@finos/fdc3'

interface IntentListener {
  listenerId: string
  intent: string
  messagePort: MessagePort
  instanceId: string
  appId: string
}

const intentListeners = new Map<string, IntentListener>()

export async function handleRaiseIntentRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort } = context

  try {
    const request = validateDACPMessage(message, RaiseintentrequestSchema)

    logger.info('DACP: Processing raise intent request', {
      intent: request.payload.intent,
      contextType: request.payload.context.type,
      targetApp: request.payload.app,
      requestUuid: request.meta.requestUuid
    })

    const validatedContext = validateDACPMessage(request.payload.context, ContextSchema)

    const intentResolution = await processIntentResolution(
      request,
      validatedContext
    )

    const intentResult = await intentResolution.getResult();

    const response = createDACPSuccessResponse(
      request,
      'raiseIntentResponse',
      {
        intentResult: intentResult,
        source: intentResolution.source?.appId
      }
    )

    messagePort.postMessage(response)

    logger.debug('DACP: Raise intent request completed successfully', {
      intent: request.payload.intent,
      requestUuid: request.meta.requestUuid
    })

  } catch (error) {
    logger.error('DACP: Raise intent request failed', error)

    let errorType: DACPErrorType = DACP_ERROR_TYPES.INTENT_DELIVERY_FAILED
    if (error instanceof Error) {
      if (error.message.includes('No apps found')) {
        errorType = DACP_ERROR_TYPES.NO_APPS_FOUND
      } else if (error.message.includes('Resolver unavailable')) {
        errorType = DACP_ERROR_TYPES.RESOLVER_UNAVAILABLE
      }
    }

    const errorResponse = createDACPErrorResponse(
      message as any,
      errorType,
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
  const { messagePort } = context

  try {
    const request = validateDACPMessage(message, AddintentlistenerrequestSchema)

    logger.info('DACP: Adding intent listener', {
      intent: request.payload.intent,
      requestUuid: request.meta.requestUuid
    })

    const listenerId = generateEventUuid()

    const { instanceId, appId } = getAppInfoFromContext()

    const listener: IntentListener = {
      listenerId,
      intent: request.payload.intent,
      messagePort,
      instanceId,
      appId
    }

    intentListeners.set(listenerId, listener)

    await registerWithSailIntentManager(listener)

    const response = createDACPSuccessResponse(
      request,
      'addIntentListenerResponse',
      { listenerId }
    )

    messagePort.postMessage(response)

    logger.debug('DACP: Intent listener added successfully', {
      listenerId,
      intent: request.payload.intent,
      requestUuid: request.meta.requestUuid
    })

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
    const request = message as any

    if (!request.payload?.listenerId) {
      throw new Error('Missing listenerId in unsubscribe request')
    }

    const listenerId = request.payload.listenerId

    logger.info('DACP: Unsubscribing intent listener', {
      listenerId,
      requestUuid: request.meta?.requestUuid
    })

    const listener = intentListeners.get(listenerId)
    if (!listener) {
      throw new Error(`Intent listener ${listenerId} not found`)
    }

    intentListeners.delete(listenerId)

    await unregisterFromSailIntentManager(listener)

    const response = createDACPSuccessResponse(
      request,
      'intentListenerUnsubscribeResponse'
    )

    messagePort.postMessage(response)

    logger.debug('DACP: Intent listener unsubscribed successfully', {
      listenerId,
      intent: listener.intent,
      requestUuid: request.meta?.requestUuid
    })

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
    const request = message as any

    if (!request.payload?.intent) {
      throw new Error('Missing intent in find intent request')
    }

    logger.info('DACP: Finding apps for intent', {
      intent: request.payload.intent,
      contextType: request.payload.context?.type,
      requestUuid: request.meta?.requestUuid
    })

    const apps = await findAppsForIntent(
      request.payload.intent,
      request.payload.context
    )

    const response = createDACPSuccessResponse(
      request,
      'findIntentResponse',
      {
        intent: request.payload.intent,
        apps: apps
      }
    )

    messagePort.postMessage(response)

    logger.debug('DACP: Find intent request completed', {
      intent: request.payload.intent,
      appsFound: apps.length,
      requestUuid: request.meta?.requestUuid
    })

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

async function processIntentResolution(
  request: Raiseintentrequest,
  context: Context
): Promise<IntentResolution> {
  try {
    logger.debug('Processing intent resolution through Sail infrastructure', {
      intent: request.payload.intent,
      contextType: context.type,
      targetApp: request.payload.app
    })

    const mockResolution: IntentResolution = {
      source: {
        appId: request.payload.app || 'default-app',
        instanceId: 'resolved-instance-id'
      } as AppMetadata,
      intent: request.payload.intent,
      getResult: () => new Promise(resolve => resolve({ type: 'test' } as Context)),
    }

    return mockResolution

  } catch (error) {
    logger.error('Failed to process intent resolution through Sail infrastructure', error)
    throw error
  }
}

async function findAppsForIntent(
  intent: string,
  context: Context
): Promise<AppMetadata[]> {
  try {
    logger.debug('Finding apps for intent through Sail infrastructure', {
      intent,
      contextType: context?.type
    })

    const mockApps: AppMetadata[] = [
      {
        appId: 'chart-app',
        name: 'Chart Application',
        title: 'Financial Charts',
        description: 'View financial charts and data',
        version: '1.0.0',
        icons: [{ src: '/icons/chart-app.svg' }]
      }
    ]

    return mockApps

  } catch (error) {
    logger.error('Failed to find apps for intent', error)
    throw error
  }
}

function getAppInfoFromContext(): { instanceId: string; appId: string } {
  return {
    instanceId: 'current-app-instance-id',
    appId: 'current-app-id'
  }
}

async function registerWithSailIntentManager(
  listener: IntentListener
): Promise<void> {
  try {
    logger.debug('Registering intent listener with Sail intent manager', {
      listenerId: listener.listenerId,
      intent: listener.intent,
      appId: listener.appId
    })

  } catch (error) {
    logger.error('Failed to register with Sail intent manager', error)
    throw error
  }
}

async function unregisterFromSailIntentManager(
  listener: IntentListener
): Promise<void> {
  try {
    logger.debug('Unregistering intent listener from Sail intent manager', {
      listenerId: listener.listenerId,
      intent: listener.intent,
      appId: listener.appId
    })

  } catch (error) {
    logger.error('Failed to unregister from Sail intent manager', error)
    throw error
  }
}

export async function deliverIntentToListeners(
  intent: string,
  context: Context,
  sourceApp: string
): Promise<void> {
  const matchingListeners = Array.from(intentListeners.values())
    .filter(listener => listener.intent === intent)

  logger.debug(`Delivering intent to ${matchingListeners.length} listeners`, {
    intent,
    contextType: context.type,
    sourceApp
  })

  const deliveries = matchingListeners.map(async (listener) => {
    try {
      const intentEvent = createDACPEvent('intentEvent', {
        intent,
        context,
        sourceApp
      })

      listener.messagePort.postMessage(intentEvent)

      logger.debug('Intent event delivered to listener', {
        listenerId: listener.listenerId,
        intent,
        targetApp: listener.appId
      })

    } catch (error) {
      logger.error('Failed to deliver intent to listener', {
        listenerId: listener.listenerId,
        intent,
        error
      })
    }
  })

  await Promise.allSettled(deliveries)
}

export function cleanupIntentListeners(instanceId: string): void {
  const listenersToRemove = Array.from(intentListeners.entries())
    .filter(([_, listener]) => listener.instanceId === instanceId)
    .map(([listenerId, _]) => listenerId)

  listenersToRemove.forEach(listenerId => {
    intentListeners.delete(listenerId)
    logger.debug('Cleaned up intent listener', { listenerId, instanceId })
  })
}