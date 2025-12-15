import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
} from "../validation/dacp-validator"
import {
  GetCurrentChannelRequestSchema,
  GetCurrentContextRequestSchema,
  JoinUserChannelRequestSchema,
  LeaveCurrentChannelRequestSchema,
  GetUserChannelsRequestSchema,
  GetOrCreateChannelRequestSchema,
} from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"
import { getEventListeners } from "./event-handlers"

/**
 * Handles get current channel requests
 */
export function handleGetCurrentChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, appInstanceRegistry, userChannelRegistry, appChannelRegistry } = context

  try {
    const request = validateDACPMessage(message, GetCurrentChannelRequestSchema)
    const instance = appInstanceRegistry.getInstance(instanceId)
    const channelId = instance?.currentChannel ?? null

    // If no channel, return null
    if (!channelId) {
      const response = createDACPSuccessResponse(request, "getCurrentChannelResponse", {
        channel: null,
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
      return
    }

    // Look up the channel object from the appropriate registry
    // Try user channels first, then app channels
    let channel = userChannelRegistry.get(channelId) ?? appChannelRegistry.get(channelId)

    // If channel not found in registries, create a minimal channel object
    // This shouldn't happen in normal operation, but provides a fallback
    if (!channel) {
      logger.warn("Channel not found in registries, creating minimal channel object", {
        channelId,
        instanceId,
      })
      channel = {
        id: channelId,
        type: "user", // Default to user channel if unknown
      }
    }

    const response = createDACPSuccessResponse(request, "getCurrentChannelResponse", {
      channel,
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
  } catch (error) {
    const errorResponse = createDACPErrorResponse(
      {
        meta: {
          requestUuid: (message as { meta?: { requestUuid?: string } })?.meta?.requestUuid || "",
        },
      },
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      "getCurrentChannelResponse",
      error instanceof Error ? error.message : "Failed to get current channel"
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
 * Handles join user channel requests
 */
export function handleJoinUserChannelRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry, userChannelRegistry } = context

  try {
    const request = validateDACPMessage(message, JoinUserChannelRequestSchema)
    const { channelId } = request.payload

    // Validate channel exists in user channel registry
    if (!userChannelRegistry.has(channelId)) {
      throw new Error(`Channel ${channelId} does not exist`)
    }

    appInstanceRegistry.setInstanceChannel(instanceId, channelId)

    const response = createDACPSuccessResponse(request, "joinUserChannelResponse")
    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)

    notifyChannelChanged(instanceId, channelId, context)
  } catch (error) {
    const errorResponse = createDACPErrorResponse(
      {
        meta: {
          requestUuid: (message as { meta?: { requestUuid?: string } })?.meta?.requestUuid || "",
        },
      },
      error instanceof Error && error.message.includes("does not exist")
        ? DACP_ERROR_TYPES.NO_CHANNEL_FOUND
        : DACP_ERROR_TYPES.CHANNEL_ERROR,
      "joinUserChannelResponse",
      error instanceof Error ? error.message : "Failed to join user channel"
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
 * Handles leave current channel requests
 */
export function handleLeaveCurrentChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, LeaveCurrentChannelRequestSchema)
    appInstanceRegistry.setInstanceChannel(instanceId, null)

    const response = createDACPSuccessResponse(request, "leaveCurrentChannelResponse")
    // Add routing metadata
    const responseWithRouting = {
      ...response,
      meta: {
        ...response.meta,
        destination: { instanceId },
      },
    }

    transport.send(responseWithRouting)

    notifyChannelChanged(instanceId, null, context)
  } catch (error) {
    const errorResponse = createDACPErrorResponse(
      {
        meta: {
          requestUuid: (message as { meta?: { requestUuid?: string } })?.meta?.requestUuid || "",
        },
      },
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      "leaveCurrentChannelResponse",
      error instanceof Error ? error.message : "Failed to leave current channel"
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
 * Handles get user channels requests
 */
export function handleGetUserChannelsRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, userChannelRegistry } = context

  try {
    const request = validateDACPMessage(message, GetUserChannelsRequestSchema)
    const userChannels = userChannelRegistry.getAll()

    const response = createDACPSuccessResponse(request, "getUserChannelsResponse", {
      userChannels,
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
  } catch (error) {
    const errorResponse = createDACPErrorResponse(
      {
        meta: {
          requestUuid: (message as { meta?: { requestUuid?: string } })?.meta?.requestUuid || "",
        },
      },
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      "getUserChannelsResponse",
      error instanceof Error ? error.message : "Failed to get user channels"
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
 * Handles get current context requests
 */
export function handleGetCurrentContextRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, appInstanceRegistry, channelContextRegistry } = context

  try {
    const request = validateDACPMessage(message, GetCurrentContextRequestSchema)
    const payload = request.payload as { channelId?: string; contextType?: string }

    const instance = appInstanceRegistry.getInstance(instanceId)
    const channelId = payload.channelId || instance?.currentChannel

    if (!channelId) {
      throw new Error("No channel specified and app is not on a channel")
    }

    // Get the last broadcast context for the channel
    const storedContext = channelContextRegistry.getContext(channelId, payload.contextType)

    logger.debug("DACP: getCurrentContext", {
      channelId,
      contextType: payload.contextType,
      hasContext: !!storedContext,
    })

    const response = createDACPSuccessResponse(request, "getCurrentContextResponse", {
      context: storedContext,
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
  } catch (error) {
    const errorResponse = createDACPErrorResponse(
      {
        meta: {
          requestUuid: (message as { meta?: { requestUuid?: string } })?.meta?.requestUuid || "",
        },
      },
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      "getCurrentContextResponse",
      error instanceof Error ? error.message : "Failed to get current context"
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
 * Handles get or create channel requests
 * Creates an app channel if it doesn't exist, or returns existing one
 */
export function handleGetOrCreateChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, appChannelRegistry } = context

  try {
    const request = validateDACPMessage(message, GetOrCreateChannelRequestSchema)
    const { channelId } = request.payload

    // Get or create the app channel
    const channel = appChannelRegistry.getOrCreate(channelId)

    logger.debug("DACP: getOrCreateChannel", {
      channelId,
      existed: appChannelRegistry.has(channelId),
    })

    const response = createDACPSuccessResponse(request, "getOrCreateChannelResponse", {
      channel,
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
  } catch (error) {
    const errorResponse = createDACPErrorResponse(
      {
        meta: {
          requestUuid: (message as { meta?: { requestUuid?: string } })?.meta?.requestUuid || "",
        },
      },
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      "getOrCreateChannelResponse",
      error instanceof Error ? error.message : "Failed to get or create channel"
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

function notifyChannelChanged(
  instanceId: string,
  channelId: string | null,
  context: DACPHandlerContext
): void {
  const instance = context.appInstanceRegistry.getInstance(instanceId)
  if (!instance) {
    logger.warn("No instance found for channel change notification", { instanceId })
    return
  }

  const channelChangedEvent = createDACPEvent("channelChangedEvent", {
    channelId,
    identity: {
      appId: instance.appId,
      instanceId: instance.instanceId,
    },
  })

  // Add routing metadata
  const channelChangedEventWithRouting = {
    ...channelChangedEvent,
    meta: {
      ...channelChangedEvent.meta,
      destination: { instanceId },
    },
  }

  // Send to the app that changed channels
  context.transport.send(channelChangedEventWithRouting)

  // Also broadcast to all apps subscribed to channelChanged events
  const subscribers = getEventListeners("channelChanged")

  subscribers.forEach((subscriberId: string) => {
    // Don't send duplicate to the app that changed
    if (subscriberId !== instanceId) {
      // Add routing metadata
      const channelChangedEventWithRouting = {
        ...channelChangedEvent,
        meta: {
          ...channelChangedEvent.meta,
          destination: { instanceId: subscriberId },
        },
      }

      context.transport.send(channelChangedEventWithRouting)
    }
  })

  logger.debug("Channel changed event broadcast", {
    instanceId,
    channelId,
    subscribers: subscribers.size,
  })
}
