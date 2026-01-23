import { createDACPSuccessResponse, createDACPEvent } from "../../dacp-protocol/dacp-message-creators"
import { DACP_ERROR_TYPES } from "../../dacp-protocol/dacp-constants"
import { type DACPHandlerContext, type DACPMessage } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import { getEventListeners } from "./event-handlers"
import { getInstance, getUserChannel, getAppChannel, getAllUserChannels, getChannelContext } from "../../state/selectors"
import { joinChannel, createAppChannel } from "../../state/mutators"
import { ChannelError } from "@finos/fdc3"
import { NoChannelFoundError, ChannelAccessDeniedError, ChannelCreationFailedError, FDC3ChannelError } from "../../errors/fdc3-errors"

/**
 * Handles get current channel requests
 */
export function handleGetCurrentChannelRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, logger } = context

  try {
    const instance = getInstance(getState(), instanceId)
    const channelId = instance?.currentChannel ?? null

    // If no channel, return null
    if (!channelId) {
      const response = createDACPSuccessResponse(message, "getCurrentChannelResponse", {
        channel: null,
      })
      sendDACPResponse({ response, instanceId, transport })
      return
    }

    // Look up the channel object from state
    // Try user channels first, then app channels
    const state = getState()
    let channel = getUserChannel(state, channelId) ?? getAppChannel(state, channelId)

    // If channel not found in state, create a minimal channel object
    // This shouldn't happen in normal operation, but provides a fallback
    if (!channel) {
      logger.warn("Channel not found in state, creating minimal channel object", {
        channelId,
        instanceId,
      })
      channel = {
        id: channelId,
        type: "user", // Default to user channel if unknown
      }
    }

    const response = createDACPSuccessResponse(message, "getCurrentChannelResponse", {
      channel,
    })
    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    const messageWithUuid: DACPMessage = {
      ...message,
      meta: {
        ...message.meta,
        requestUuid: message.meta?.requestUuid || "",
      },
    }

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to get current channel"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
      errorType = ChannelError.NoChannelFound
    }

    sendDACPErrorResponse({
      message: messageWithUuid,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

/**
 * Handles join user channel requests
 */
export function handleJoinUserChannelRequest(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState, setState } = context

  try {
    const { channelId } = message.payload as { channelId: string }

    // Validate channel exists in user channels
    const state = getState()
    if (!getUserChannel(state, channelId)) {
      throw new Error(`Channel ${channelId} does not exist`)
    }

    setState(state => joinChannel(state, instanceId, channelId))

    const response = createDACPSuccessResponse(message, "joinUserChannelResponse")
    sendDACPResponse({ response, instanceId, transport })

    notifyChannelChanged(instanceId, channelId, context)
  } catch (error) {
    const messageWithUuid: DACPMessage = {
      ...message,
      meta: {
        ...message.meta,
        requestUuid: message.meta?.requestUuid || "",
      },
    }

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to join user channel"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("does not exist") || errorMessage.includes("not found")) {
      errorType = ChannelError.NoChannelFound
    }

    sendDACPErrorResponse({
      message: messageWithUuid,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

/**
 * Handles leave current channel requests
 */
export function handleLeaveCurrentChannelRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, setState } = context

  try {
    setState(state => joinChannel(state, instanceId, null))

    const response = createDACPSuccessResponse(message, "leaveCurrentChannelResponse")
    sendDACPResponse({ response, instanceId, transport })

    notifyChannelChanged(instanceId, null, context)
  } catch (error) {
    const messageWithUuid: DACPMessage = {
      ...message,
      meta: {
        ...message.meta,
        requestUuid: message.meta?.requestUuid || "",
      },
    }

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to leave current channel"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    }

    sendDACPErrorResponse({
      message: messageWithUuid,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

/**
 * Handles get user channels requests
 */
export function handleGetUserChannelsRequest(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, getState } = context

  try {
    const userChannels = getAllUserChannels(getState())

    const response = createDACPSuccessResponse(message, "getUserChannelsResponse", {
      userChannels,
    })
    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    const messageWithUuid: DACPMessage = {
      ...message,
      meta: {
        ...message.meta,
        requestUuid: message.meta?.requestUuid || "",
      },
    }

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to get user channels"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    }

    sendDACPErrorResponse({
      message: messageWithUuid,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

/**
 * Handles get current context requests
 */
export function handleGetCurrentContextRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, logger } = context

  try {
    const payload = message.payload as { channelId?: string; contextType?: string }

    const instance = getInstance(getState(), instanceId)
    const channelId = payload.channelId || instance?.currentChannel

    if (!channelId) {
      throw new Error("No channel specified and app is not on a channel")
    }

    // Get the last broadcast context for the channel
    const storedContext = getChannelContext(getState(), channelId, payload.contextType)

    logger.debug("DACP: getCurrentContext", {
      channelId,
      contextType: payload.contextType,
      hasContext: !!storedContext,
    })

    const response = createDACPSuccessResponse(message, "getCurrentContextResponse", {
      context: storedContext,
    })
    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    const messageWithUuid: DACPMessage = {
      ...message,
      meta: {
        ...message.meta,
        requestUuid: message.meta?.requestUuid || "",
      },
    }

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to get current context"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
      errorType = ChannelError.NoChannelFound
    }

    sendDACPErrorResponse({
      message: messageWithUuid,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

/**
 * Handles get or create channel requests
 * Creates an app channel if it doesn't exist, or returns existing one
 */
export function handleGetOrCreateChannelRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { channelId } = message.payload as { channelId: string }

    // Get or create the app channel
    const state = getState()
    let channel = getAppChannel(state, channelId)
    const existed = !!channel

    if (!channel) {
      setState(state => createAppChannel(state, channelId))
      const newState = getState()
      channel = getAppChannel(newState, channelId)
    }

    logger.debug("DACP: getOrCreateChannel", {
      channelId,
      existed,
    })

    const response = createDACPSuccessResponse(message, "getOrCreateChannelResponse", {
      channel,
    })
    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    const messageWithUuid: DACPMessage = {
      ...message,
      meta: {
        ...message.meta,
        requestUuid: message.meta?.requestUuid || "",
      },
    }

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.CreationFailed
    const errorMessage = error instanceof Error ? error.message : "Failed to get or create channel"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
      errorType = ChannelError.NoChannelFound
    } else if (errorMessage.includes("denied") || errorMessage.includes("access")) {
      errorType = ChannelError.AccessDenied
    }

    sendDACPErrorResponse({
      message: messageWithUuid,
      errorType,
      errorMessage,
      instanceId,
      transport,
    })
  }
}

function notifyChannelChanged(
  instanceId: string,
  channelId: string | null,
  context: DACPHandlerContext
): void {
  const { transport, logger, getState } = context
  const instance = getInstance(getState(), instanceId)
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
  transport.send(channelChangedEventWithRouting)

  // Also broadcast to all apps subscribed to channelChanged events
  const subscribers = getEventListeners("channelChanged", context.getState)

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

      transport.send(channelChangedEventWithRouting)
    }
  })

  logger.debug("Channel changed event broadcast", {
    instanceId,
    channelId,
    subscribers: subscribers.length,
  })
}
