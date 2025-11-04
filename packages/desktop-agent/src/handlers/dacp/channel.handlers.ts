import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
} from "../validation/dacp-validator"
import {
  GetcurrentchannelrequestSchema,
  JoinuserchannelrequestSchema,
  LeavecurrentchannelrequestSchema,
  GetuserchannelsrequestSchema,
} from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"

/**
 * Handles get current channel requests
 */
export function handleGetCurrentChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, GetcurrentchannelrequestSchema)
    const instance = appInstanceRegistry.getInstance(instanceId)
    const currentChannel = instance?.currentChannel ?? null

    const response = createDACPSuccessResponse(request, "getCurrentChannelResponse", {
      channel: currentChannel,
    })
    transport.send(instanceId, response)
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
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles join user channel requests
 */
export function handleJoinUserChannelRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, JoinuserchannelrequestSchema)
    const { channelId } = request.payload

    const channelExists = validateChannelExists(channelId)
    if (!channelExists) {
      throw new Error(`Channel ${channelId} does not exist`)
    }

    appInstanceRegistry.setInstanceChannel(instanceId, channelId)

    const response = createDACPSuccessResponse(request, "joinUserChannelResponse")
    transport.send(instanceId, response)

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
    transport.send(instanceId, errorResponse)
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
    const request = validateDACPMessage(message, LeavecurrentchannelrequestSchema)
    appInstanceRegistry.setInstanceChannel(instanceId, null)

    const response = createDACPSuccessResponse(request, "leaveCurrentChannelResponse")
    transport.send(instanceId, response)

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
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles get user channels requests
 */
export function handleGetUserChannelsRequest(message: unknown, context: DACPHandlerContext): void {
  const { transport, instanceId } = context

  try {
    const request = validateDACPMessage(message, GetuserchannelsrequestSchema)
    const userChannels = getUserChannelsFromContext()

    const response = createDACPSuccessResponse(request, "getUserChannelsResponse", {
      userChannels: userChannels,
    })
    transport.send(instanceId, response)
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
    transport.send(instanceId, errorResponse)
  }
}

// Mock/Helper functions (to be replaced with real service calls)
function validateChannelExists(channelId: string): boolean {
  const validChannels = ["red", "blue", "green", "yellow", "orange", "purple"]
  return validChannels.includes(channelId)
}

function getUserChannelsFromContext(): unknown[] {
  return [
    { id: "red", type: "user", displayMetadata: { name: "Red" } },
    { id: "blue", type: "user", displayMetadata: { name: "Blue" } },
    { id: "green", type: "user", displayMetadata: { name: "Green" } },
  ]
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

  context.transport.send(instanceId, channelChangedEvent)
}