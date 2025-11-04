import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
} from "../validation/dacp-validator"
import {
  BroadcastrequestSchema,
  AddcontextlistenerrequestSchema,
  ContextSchema,
  ContextlistenerunsubscriberequestSchema,
} from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"
import type { Context } from "@finos/fdc3"

/**
 * Handles broadcast requests to send context to a channel
 * Implements DACP broadcastRequest message handling
 */
export async function handleBroadcastRequest(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId } = context

  try {
    const request = validateDACPMessage(message, BroadcastrequestSchema)

    logger.info("DACP: Processing broadcast request", {
      channelId: request.payload.channelId,
      contextType: request.payload.context.type,
      requestUuid: request.meta.requestUuid,
    })

    const validatedContext = validateDACPMessage(request.payload.context, ContextSchema)

    // In a real implementation, this would update the channel's context in a central store.
    // For now, we just notify listeners.

    await notifyContextListeners(request.payload.channelId, validatedContext, context)

    const response = createDACPSuccessResponse(request, "broadcastResponse")

    transport.send(instanceId, response)

    logger.debug("DACP: Broadcast request completed successfully", {
      requestUuid: request.meta.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Broadcast request failed", error)

    const errorResponse = createDACPErrorResponse(
      {
        meta: {
          requestUuid: (message as { meta?: { requestUuid?: string } })?.meta?.requestUuid || "",
        },
      },
      DACP_ERROR_TYPES.BROADCAST_ERROR,
      "broadcastResponse",
      error instanceof Error ? error.message : "Unknown broadcast error"
    )

    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles add context listener requests
 * Implements DACP addContextListenerRequest message handling
 */
export function handleAddContextListener(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, AddcontextlistenerrequestSchema)
    const contextType = request.payload.contextType ?? "*" // Default to all contexts if not specified

    logger.info("DACP: Adding context listener", {
      instanceId,
      contextType,
      requestUuid: request.meta.requestUuid,
    })

    appInstanceRegistry.addContextListener(instanceId, contextType)

    // The listenerId is the contextType itself for simplicity in unsubscribing.
    const listenerId = contextType

    const response = createDACPSuccessResponse(request, "addContextListenerResponse", {
      listenerId,
    })

    transport.send(instanceId, response)

    logger.debug("DACP: Context listener added successfully", {
      listenerId,
      instanceId,
      requestUuid: request.meta.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Add context listener failed", error)

    const errorResponse = createDACPErrorResponse(
      {
        meta: {
          requestUuid: (message as { meta?: { requestUuid?: string } })?.meta?.requestUuid || "",
        },
      },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "addContextListenerResponse",
      error instanceof Error ? error.message : "Failed to add context listener"
    )

    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles context listener unsubscribe requests
 * Implements DACP contextListenerUnsubscribeRequest message handling
 */
export function handleContextListenerUnsubscribe(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, ContextlistenerunsubscriberequestSchema)
    const listenerId = (request.payload as any).listenerId

    logger.info("DACP: Unsubscribing context listener", {
      listenerId,
      instanceId,
      requestUuid: request.meta?.requestUuid,
    })

    const removed = appInstanceRegistry.removeContextListener(instanceId, listenerId)

    if (!removed) {
      throw new Error(`Context listener ${listenerId} not found for instance ${instanceId}`)
    }

    const response = createDACPSuccessResponse(request, "contextListenerUnsubscribeResponse")

    transport.send(instanceId, response)

    logger.debug("DACP: Context listener unsubscribed successfully", {
      listenerId,
      instanceId,
      requestUuid: request.meta?.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Context listener unsubscribe failed", error)

    const errorResponse = createDACPErrorResponse(
      {
        meta: {
          requestUuid: (message as { meta?: { requestUuid?: string } })?.meta?.requestUuid || "",
        },
      },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "contextListenerUnsubscribeResponse",
      error instanceof Error ? error.message : "Failed to unsubscribe context listener"
    )

    transport.send(instanceId, errorResponse)
  }
}

function notifyContextListeners(
  channelId: string,
  context: Context,
  handlerContext: DACPHandlerContext
): void {
  // Find instances on the same channel
  const instancesOnChannel = handlerContext.appInstanceRegistry.getInstancesOnChannel(channelId)

  const notifications = instancesOnChannel.map(instance => {
    // Check if the instance is listening for this context type
    const listensForType =
      instance.contextListeners.has(context.type) || instance.contextListeners.has("*")

    if (listensForType && instance.transport) {
      try {
        const contextEvent = createDACPEvent("contextEvent", {
          channelId,
          context,
        })

        // Send to the LISTENER's transport, not the sender's!
        instance.transport.send(instance.instanceId, contextEvent)

        logger.debug("Context event sent to listener", {
          instanceId: instance.instanceId,
          channelId,
          contextType: context.type,
        })
      } catch (error) {
        logger.error("Failed to notify context listener", {
          instanceId: instance.instanceId,
          error,
        })
      }
    }
  })

  Promise.allSettled(notifications)
}
