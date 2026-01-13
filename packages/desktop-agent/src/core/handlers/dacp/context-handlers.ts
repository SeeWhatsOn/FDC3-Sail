import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
} from "../validation/dacp-validator"
import {
  BroadcastRequestSchema,
  AddContextListenerRequestSchema,
  ContextSchema,
  ContextListenerUnsubscribeRequestSchema,
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
  const { transport, instanceId, channelContextRegistry, appInstanceRegistry } = context

  try {
    // Validate message against DACP schema - channelId is required per spec
    const request = validateDACPMessage(message, BroadcastRequestSchema)

    // Validate that the instance is a member of the channel they're broadcasting to
    const instance = appInstanceRegistry.getInstance(instanceId)
    if (!instance) {
      throw new Error("Instance not found")
    }

    if (instance.currentChannel !== request.payload.channelId) {
      throw new Error(
        `Instance is not a member of channel ${request.payload.channelId}. Current channel: ${instance.currentChannel ?? "none"}`
      )
    }

    logger.info("DACP: Processing broadcast request", {
      channelId: request.payload.channelId,
      contextType: request.payload.context.type,
      requestUuid: request.meta.requestUuid,
    })

    const validatedContext = validateDACPMessage(request.payload.context, ContextSchema)

    // Store context in channel context registry
    channelContextRegistry.storeContext(request.payload.channelId, validatedContext, instanceId)

    // Notify listeners on the channel
    await notifyContextListeners(request.payload.channelId, validatedContext, context)

    const response = createDACPSuccessResponse(request, "broadcastResponse")

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)

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

    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

/**
 * Handles add context listener requests
 * Implements DACP addContextListenerRequest message handling
 */
export function handleAddContextListener(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, AddContextListenerRequestSchema)
    const contextType = request.payload.contextType ?? "*" // Default to all contexts if not specified

    logger.info("DACP: Adding context listener", {
      instanceId,
      contextType,
      requestUuid: request.meta.requestUuid,
    })

    const added = appInstanceRegistry.addContextListener(instanceId, contextType)
    logger.info("DACP: Context listener registration result", {
      instanceId,
      contextType,
      added,
      requestUuid: request.meta.requestUuid,
    })

    // The listenerUUID is the contextType itself for simplicity in unsubscribing.
    const listenerUUID = contextType

    const response = createDACPSuccessResponse(request, "addContextListenerResponse", {
      listenerUUID,
    })

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)

    logger.debug("DACP: Context listener added successfully", {
      listenerUUID,
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

    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
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
    const request = validateDACPMessage(message, ContextListenerUnsubscribeRequestSchema)
    const listenerUUID = request.payload.listenerUUID

    logger.info("DACP: Unsubscribing context listener", {
      listenerUUID,
      instanceId,
      requestUuid: request.meta?.requestUuid,
    })

    const removed = appInstanceRegistry.removeContextListener(instanceId, listenerUUID)

    if (!removed) {
      throw new Error(`Context listener ${listenerUUID} not found for instance ${instanceId}`)
    }

    const response = createDACPSuccessResponse(request, "contextListenerUnsubscribeResponse")

    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)

    logger.debug("DACP: Context listener unsubscribed successfully", {
      listenerUUID,
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

    // Add routing metadata
    const errorResponseWithRouting = {
      ...errorResponse,
      meta: {
        ...errorResponse.meta,
        destination: { instanceId },
      },
    }

    transport.send(errorResponseWithRouting)
  }
}

async function notifyContextListeners(
  channelId: string,
  context: Context,
  handlerContext: DACPHandlerContext
): Promise<void> {
  // Find instances on the same channel
  const instancesOnChannel = handlerContext.appInstanceRegistry.getInstancesOnChannel(channelId)

  logger.info("DACP: Notifying context listeners", {
    channelId,
    contextType: context.type,
    totalInstancesOnChannel: instancesOnChannel.length,
    instanceIds: instancesOnChannel.map(i => i.instanceId),
  })

  const notifications = instancesOnChannel
    .filter(instance => {
      // Exclude the sender - they already have the context
      if (instance.instanceId === handlerContext.instanceId) {
        logger.debug("Skipping sender instance", { instanceId: instance.instanceId })
        return false
      }

      // Check if the instance is listening for this context type
      const listensForType =
        instance.contextListeners.has(context.type) || instance.contextListeners.has("*")

      if (!listensForType) {
        logger.info("Instance not listening for context type", {
          instanceId: instance.instanceId,
          contextType: context.type,
          registeredListeners: Array.from(instance.contextListeners),
        })
      } else {
        logger.info("Instance IS listening for context type", {
          instanceId: instance.instanceId,
          contextType: context.type,
          registeredListeners: Array.from(instance.contextListeners),
        })
      }

      return listensForType
    })
    .map(instance => {
      try {
        // FDC3 agent library expects broadcastEvent (not contextEvent) with originatingApp
        // Get the sender's instance info for originatingApp
        const senderInstance = handlerContext.appInstanceRegistry.getInstance(
          handlerContext.instanceId
        )

        const broadcastEvent = createDACPEvent("broadcastEvent", {
          channelId,
          context,
          originatingApp: {
            appId: senderInstance?.appId || "unknown",
            instanceId: handlerContext.instanceId,
          },
        })

        // Add routing metadata - WCPConnector will route based on destination.instanceId
        const broadcastEventWithRouting = {
          ...broadcastEvent,
          meta: {
            ...broadcastEvent.meta,
            destination: { instanceId: instance.instanceId },
          },
        }

        logger.info("DACP: Sending broadcast event to listener", {
          targetInstanceId: instance.instanceId,
          channelId,
          contextType: context.type,
          eventUuid: broadcastEvent.meta.eventUuid,
          broadcastEventPayload: JSON.stringify(broadcastEvent.payload),
        })

        // Send via the handler context's transport (routes through WCPConnector)
        // WCPConnector routes to the correct app based on meta.destination.instanceId
        handlerContext.transport.send(broadcastEventWithRouting)

        logger.debug("DACP: Broadcast event message structure", {
          type: broadcastEventWithRouting.type,
          hasPayload: !!broadcastEventWithRouting.payload,
          hasContext: !!broadcastEventWithRouting.payload?.context,
          contextType: broadcastEventWithRouting.payload?.context,
        })

        logger.debug("Broadcast event sent to listener", {
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
    })

  const results = await Promise.allSettled(notifications)
  const successful = results.filter(r => r.status === "fulfilled").length
  const failed = results.filter(r => r.status === "rejected").length

  logger.info("DACP: Context listener notification complete", {
    channelId,
    contextType: context.type,
    successful,
    failed,
    total: results.length,
  })
}
