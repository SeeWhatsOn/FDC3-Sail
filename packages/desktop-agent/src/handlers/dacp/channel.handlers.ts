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
import { appInstanceRegistry } from "../../state/AppInstanceRegistry"

/**
 * Handles get current channel requests
 */
export function handleGetCurrentChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { messagePort, instanceId } = context

  try {
    const request = validateDACPMessage(message, GetcurrentchannelrequestSchema)
    const instance = appInstanceRegistry.getInstance(instanceId)
    const currentChannel = instance?.currentChannel ?? null

    const response = createDACPSuccessResponse(request, "getCurrentChannelResponse", {
      channel: currentChannel,
    })
    messagePort.postMessage(response)
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
    messagePort.postMessage(errorResponse)
  }
}

/**
 * Handles join user channel requests
 */
export function handleJoinUserChannelRequest(message: unknown, context: DACPHandlerContext): void {
  const { messagePort, instanceId } = context

  try {
    const request = validateDACPMessage(message, JoinuserchannelrequestSchema)
    const { channelId } = request.payload

    const channelExists = validateChannelExists(channelId)
    if (!channelExists) {
      throw new Error(`Channel ${channelId} does not exist`)
    }

    appInstanceRegistry.setInstanceChannel(instanceId, channelId)

    const response = createDACPSuccessResponse(request, "joinUserChannelResponse")
    messagePort.postMessage(response)

    notifyChannelChanged(instanceId, channelId, messagePort)
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
    messagePort.postMessage(errorResponse)
  }
}

/**
 * Handles leave current channel requests
 */
export function handleLeaveCurrentChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { messagePort, instanceId } = context

  try {
    const request = validateDACPMessage(message, LeavecurrentchannelrequestSchema)
    appInstanceRegistry.setInstanceChannel(instanceId, null)

    const response = createDACPSuccessResponse(request, "leaveCurrentChannelResponse")
    messagePort.postMessage(response)

    notifyChannelChanged(instanceId, null, messagePort)
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
    messagePort.postMessage(errorResponse)
  }
}

/**
 * Handles get user channels requests
 */
export function handleGetUserChannelsRequest(message: unknown, context: DACPHandlerContext): void {
  const { messagePort } = context

  try {
    const request = validateDACPMessage(message, GetuserchannelsrequestSchema)
    const userChannels = getUserChannelsFromContext()

    const response = createDACPSuccessResponse(request, "getUserChannelsResponse", {
      userChannels: userChannels,
    })
    messagePort.postMessage(response)
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
    messagePort.postMessage(errorResponse)
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
  messagePort: MessagePort
): void {
  const instance = appInstanceRegistry.getInstance(instanceId)
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

  messagePort.postMessage(channelChangedEvent)
}
