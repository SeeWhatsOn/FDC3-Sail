import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
} from '../validation/dacp-validator'
import {
  BroadcastrequestSchema,
  AddcontextlistenerrequestSchema,
  ContextSchema,
  ContextlistenerunsubscriberequestSchema,
} from '../validation/dacp-schemas'
import { DACPHandlerContext, logger } from '../types'
import { Context } from '@finos/fdc3'
import { appInstanceRegistry } from '../../state/AppInstanceRegistry'

/**
 * Handles broadcast requests to send context to a channel
 * Implements DACP broadcastRequest message handling
 */
export async function handleBroadcastRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort } = context

  try {
    const request = validateDACPMessage(message, BroadcastrequestSchema)

    logger.info('DACP: Processing broadcast request', {
      channelId: request.payload.channelId,
      contextType: request.payload.context.type,
      requestUuid: request.meta.requestUuid,
    })

    const validatedContext = validateDACPMessage(request.payload.context, ContextSchema)

    // In a real implementation, this would update the channel's context in a central store.
    // For now, we just notify listeners.

    await notifyContextListeners(request.payload.channelId, validatedContext, context)

    const response = createDACPSuccessResponse(request, 'broadcastResponse')

    messagePort.postMessage(response)

    logger.debug('DACP: Broadcast request completed successfully', {
      requestUuid: request.meta.requestUuid,
    })
  } catch (error) {
    logger.error('DACP: Broadcast request failed', error)

    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.BROADCAST_ERROR,
      'broadcastResponse',
      error instanceof Error ? error.message : 'Unknown broadcast error'
    )

    messagePort.postMessage(errorResponse)
  }
}

/**
 * Handles add context listener requests
 * Implements DACP addContextListenerRequest message handling
 */
export async function handleAddContextListener(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort, instanceId } = context

  try {
    const request = validateDACPMessage(message, AddcontextlistenerrequestSchema)
    const contextType = request.payload.contextType ?? '*'; // Default to all contexts if not specified

    logger.info('DACP: Adding context listener', {
      instanceId,
      contextType,
      requestUuid: request.meta.requestUuid,
    })

    appInstanceRegistry.addContextListener(instanceId, contextType)

    // The listenerId is the contextType itself for simplicity in unsubscribing.
    const listenerId = contextType

    const response = createDACPSuccessResponse(request, 'addContextListenerResponse', {
      listenerId,
    })

    messagePort.postMessage(response)

    logger.debug('DACP: Context listener added successfully', {
      listenerId,
      instanceId,
      requestUuid: request.meta.requestUuid,
    })
  } catch (error) {
    logger.error('DACP: Add context listener failed', error)

    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.LISTENER_ERROR,
      'addContextListenerResponse',
      error instanceof Error ? error.message : 'Failed to add context listener'
    )

    messagePort.postMessage(errorResponse)
  }
}

/**
 * Handles context listener unsubscribe requests
 * Implements DACP contextListenerUnsubscribeRequest message handling
 */
export async function handleContextListenerUnsubscribe(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { messagePort, instanceId } = context

  try {
    const request = validateDACPMessage(message, ContextlistenerunsubscriberequestSchema)
    const listenerId = request.payload.listenerId as string

    logger.info('DACP: Unsubscribing context listener', {
      listenerId,
      instanceId,
      requestUuid: request.meta?.requestUuid,
    })

    const removed = appInstanceRegistry.removeContextListener(instanceId, listenerId)

    if (!removed) {
      throw new Error(`Context listener ${listenerId} not found for instance ${instanceId}`)
    }

    const response = createDACPSuccessResponse(request, 'contextListenerUnsubscribeResponse')

    messagePort.postMessage(response)

    logger.debug('DACP: Context listener unsubscribed successfully', {
      listenerId,
      instanceId,
      requestUuid: request.meta?.requestUuid,
    })
  } catch (error) {
    logger.error('DACP: Context listener unsubscribe failed', error)

    const errorResponse = createDACPErrorResponse(
      message as any,
      DACP_ERROR_TYPES.LISTENER_ERROR,
      'contextListenerUnsubscribeResponse',
      error instanceof Error ? error.message : 'Failed to unsubscribe context listener'
    )

    messagePort.postMessage(errorResponse)
  }
}

async function notifyContextListeners(
  channelId: string,
  context: Context,
  handlerContext: DACPHandlerContext
): Promise<void> {
  // Find instances on the same channel
  const instancesOnChannel = appInstanceRegistry.getInstancesOnChannel(channelId)

  const notifications = instancesOnChannel.map(async instance => {
    // Check if the instance is listening for this context type
    const listensForType = instance.contextListeners.has(context.type) || instance.contextListeners.has('*')

    if (listensForType) {
      try {
        const contextEvent = createDACPEvent('contextEvent', {
          channelId,
          context,
        })

        // This is a simplification. In a real scenario, we would need the message port
        // for each instance. This highlights the need to store the port in the AppInstanceRegistry.
        handlerContext.messagePort.postMessage(contextEvent)

        logger.debug('Context event sent to listener', {
          instanceId: instance.instanceId,
          channelId,
          contextType: context.type,
        })
      } catch (error) {
        logger.error('Failed to notify context listener', {
          instanceId: instance.instanceId,
          error,
        })
      }
    }
  })

  await Promise.allSettled(notifications)
}
