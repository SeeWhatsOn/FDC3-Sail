import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
  generateEventUuid
} from '../validation/dacp-validator'
import {
  BroadcastrequestSchema,
  AddcontextlistenerrequestSchema,
  ContextSchema
} from '../validation/dacp-schemas'
import { DACPHandlerContext, logger } from '../types'
import { Context } from '@finos/fdc3'

// Type for context listener registration
interface ContextListener {
  listenerId: string
  channelId?: string
  contextType?: string
  messagePort: MessagePort
  instanceId: string
}

// Global context listeners registry (in production, this should be per-user session)
const contextListeners = new Map<string, ContextListener>()

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
      requestUuid: request.meta.requestUuid
    })

    const validatedContext = validateDACPMessage(request.payload.context, ContextSchema)

    await processBroadcast(request.payload.channelId, validatedContext)

    await notifyContextListeners(request.payload.channelId, validatedContext)

    const response = createDACPSuccessResponse(
      request,
      'broadcastResponse'
    )

    messagePort.postMessage(response)

    logger.debug('DACP: Broadcast request completed successfully', {
      requestUuid: request.meta.requestUuid
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
  const { messagePort } = context

  try {
    const request = validateDACPMessage(message, AddcontextlistenerrequestSchema)

    logger.info('DACP: Adding context listener', {
      channelId: request.payload.channelId,
      contextType: request.payload.contextType,
      requestUuid: request.meta.requestUuid
    })

    const listenerId = generateEventUuid()

    const instanceId = getInstanceIdFromContext()

    const listener: ContextListener = {
      listenerId,
      channelId: request.payload.channelId,
      contextType: request.payload.contextType,
      messagePort,
      instanceId
    }

    contextListeners.set(listenerId, listener)

    await registerWithSailContextManager(listener)

    const response = createDACPSuccessResponse(
      request,
      'addContextListenerResponse',
      { listenerId }
    )

    messagePort.postMessage(response)

    logger.debug('DACP: Context listener added successfully', {
      listenerId,
      requestUuid: request.meta.requestUuid
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
  const { messagePort } = context

  try {
    const request = message as any

    if (!request.payload?.listenerId) {
      throw new Error('Missing listenerId in unsubscribe request')
    }

    const listenerId = request.payload.listenerId

    logger.info('DACP: Unsubscribing context listener', {
      listenerId,
      requestUuid: request.meta?.requestUuid
    })

    const removed = contextListeners.delete(listenerId)

    if (!removed) {
      throw new Error(`Context listener ${listenerId} not found`)
    }

    await unregisterFromSailContextManager(listenerId)

    const response = createDACPSuccessResponse(
      request,
      'contextListenerUnsubscribeResponse'
    )

    messagePort.postMessage(response)

    logger.debug('DACP: Context listener unsubscribed successfully', {
      listenerId,
      requestUuid: request.meta?.requestUuid
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

async function processBroadcast(
  channelId: string,
  context: Context
): Promise<void> {
  try {
    logger.debug('Processing broadcast through Sail infrastructure', {
      channelId: channelId,
      contextType: context.type
    })

  } catch (error) {
    logger.error('Failed to process broadcast through Sail infrastructure', error)
    throw error
  }
}

async function notifyContextListeners(channelId: string, context: Context): Promise<void> {
  const channelListeners = Array.from(contextListeners.values()).filter(listener => {
    const channelMatch = !listener.channelId || listener.channelId === channelId
    const typeMatch = !listener.contextType || listener.contextType === context.type
    return channelMatch && typeMatch
  })

  logger.debug(`Notifying ${channelListeners.length} context listeners`, {
    channelId,
    contextType: context.type
  })

  const notifications = channelListeners.map(async (listener) => {
    try {
      const contextEvent = createDACPEvent('contextEvent', {
        channelId,
        context
      })

      listener.messagePort.postMessage(contextEvent)

      logger.debug('Context event sent to listener', {
        listenerId: listener.listenerId,
        channelId,
        contextType: context.type
      })

    } catch (error) {
      logger.error('Failed to notify context listener', {
        listenerId: listener.listenerId,
        error
      })
    }
  })

  await Promise.allSettled(notifications)
}

function getInstanceIdFromContext(): string {
  return 'current-app-instance-id'
}

async function registerWithSailContextManager(
  listener: ContextListener
): Promise<void> {
  try {
    logger.debug('Registering context listener with Sail context manager', {
      listenerId: listener.listenerId,
      channelId: listener.channelId,
      contextType: listener.contextType
    })

  } catch (error) {
    logger.error('Failed to register with Sail context manager', error)
    throw error
  }
}

async function unregisterFromSailContextManager(
  listenerId: string
): Promise<void> {
  try {
    logger.debug('Unregistering context listener from Sail context manager', {
      listenerId
    })

  } catch (error) {
    logger.error('Failed to unregister from Sail context manager', error)
    throw error
  }
}

export function cleanupContextListeners(instanceId: string): void {
  const listenersToRemove = Array.from(contextListeners.entries())
    .filter(([_, listener]) => listener.instanceId === instanceId)
    .map(([listenerId, _]) => listenerId)

  listenersToRemove.forEach(listenerId => {
    contextListeners.delete(listenerId)
    logger.debug('Cleaned up context listener', { listenerId, instanceId })
  })
}
