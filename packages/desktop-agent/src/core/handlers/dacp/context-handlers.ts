import { createDACPSuccessResponse, createDACPEvent } from "../../dacp-protocol/dacp-message-creators"
import { DACP_ERROR_TYPES } from "../../dacp-protocol/dacp-constants"
import { type DACPHandlerContext, type DACPMessage } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import type { Context } from "@finos/fdc3"
import { ChannelError } from "@finos/fdc3"
import { FDC3ChannelError } from "../../errors/fdc3-errors"
import { getInstance, getInstancesOnChannel } from "../../state/selectors"
import { storeContext, addContextListener, removeContextListener } from "../../state/mutators"

/**
 * Handles broadcast requests to send context to a channel
 * Implements DACP broadcastRequest message handling
 *
 * Note: Message validation happens at router level before this handler is called
 */
export async function handleBroadcastRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const channelId = (message.payload as { channelId: string }).channelId
    const broadcastContext = (message.payload as { context: Context }).context

    // Validate that the instance is a member of the channel they're broadcasting to
    const state = getState()
    const instance = getInstance(state, instanceId)
    if (!instance) {
      throw new Error("Instance not found")
    }

    if (instance.currentChannel !== channelId) {
      throw new Error(
        `Instance is not a member of channel ${channelId}. Current channel: ${instance.currentChannel ?? "none"}`
      )
    }

    logger.info("DACP: Processing broadcast request", {
      channelId,
      contextType: broadcastContext.type,
      requestUuid: message.meta.requestUuid,
    })

    // Store context using state transform
    setState(state => storeContext(state, channelId, broadcastContext, instanceId))

    // Notify listeners on the channel
    await notifyContextListeners(channelId, broadcastContext, context)

    const response = createDACPSuccessResponse(message, "broadcastResponse")

    sendDACPResponse({ response, instanceId, transport })

    logger.debug("DACP: Broadcast request completed successfully", {
      requestUuid: message.meta.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Broadcast request failed", error)

    // Ensure message has requestUuid for error response
    const messageWithUuid: DACPMessage = {
      ...message,
      meta: {
        ...message.meta,
        requestUuid: message.meta?.requestUuid || "",
      },
    }

    // BroadcastResponse schema doesn't validate error payloads, but use ChannelError for consistency
    // Common errors: MalformedContext, ApiTimeout
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Unknown broadcast error"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("Malformed") || errorMessage.includes("invalid context")) {
      errorType = ChannelError.MalformedContext
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
 * Handles add context listener requests
 * Implements DACP addContextListenerRequest message handling
 */
export function handleAddContextListener(message: DACPMessage, context: DACPHandlerContext): void {
  const { transport, instanceId, setState, logger } = context

  try {
    const contextType = (message.payload as { contextType?: string }).contextType ?? "*" // Default to all contexts if not specified

    logger.info("DACP: Adding context listener", {
      instanceId,
      contextType,
      requestUuid: message.meta.requestUuid,
    })

    // Add context listener using state transform
    setState(state => addContextListener(state, instanceId, contextType))

    logger.info("DACP: Context listener registration result", {
      instanceId,
      contextType,
      added: true,
      requestUuid: message.meta.requestUuid,
    })

    // The listenerUUID is the contextType itself for simplicity in unsubscribing.
    const listenerUUID = contextType

    const response = createDACPSuccessResponse(message, "addContextListenerResponse", {
      listenerUUID,
    })

    sendDACPResponse({ response, instanceId, transport })

    logger.debug("DACP: Context listener added successfully", {
      listenerUUID,
      instanceId,
      requestUuid: message.meta.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Add context listener failed", error)

    const messageWithUuid: DACPMessage = {
      ...message,
      meta: {
        ...message.meta,
        requestUuid: message.meta?.requestUuid || "",
      },
    }

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to add context listener"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("Access denied") || errorMessage.includes("denied")) {
      errorType = ChannelError.AccessDenied
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
 * Handles context listener unsubscribe requests
 * Implements DACP contextListenerUnsubscribeRequest message handling
 */
export function handleContextListenerUnsubscribe(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const listenerUUID = (message.payload as { listenerUUID: string }).listenerUUID

    logger.info("DACP: Unsubscribing context listener", {
      listenerUUID,
      instanceId,
      requestUuid: message.meta?.requestUuid,
    })

    // Check if listener exists before removing
    const instance = getInstance(getState(), instanceId)
    if (!instance || !instance.contextListeners.includes(listenerUUID)) {
      throw new Error(`Context listener ${listenerUUID} not found for instance ${instanceId}`)
    }

    // Remove context listener using state transform
    setState(state => removeContextListener(state, instanceId, listenerUUID))

    const response = createDACPSuccessResponse(message, "contextListenerUnsubscribeResponse")

    sendDACPResponse({ response, instanceId, transport })

    logger.debug("DACP: Context listener unsubscribed successfully", {
      listenerUUID,
      instanceId,
      requestUuid: message.meta?.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Context listener unsubscribe failed", error)

    const messageWithUuid: DACPMessage = {
      ...message,
      meta: {
        ...message.meta,
        requestUuid: message.meta?.requestUuid || "",
      },
    }

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to unsubscribe context listener"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("Access denied") || errorMessage.includes("denied")) {
      errorType = ChannelError.AccessDenied
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

async function notifyContextListeners(
  channelId: string,
  context: Context,
  handlerContext: DACPHandlerContext
): Promise<void> {
  const { getState, logger } = handlerContext

  // Find instances on the same channel
  const instancesOnChannel = getInstancesOnChannel(getState(), channelId)

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
        instance.contextListeners.includes(context.type) || instance.contextListeners.includes("*")

      if (!listensForType) {
        logger.info("Instance not listening for context type", {
          instanceId: instance.instanceId,
          contextType: context.type,
          registeredListeners: instance.contextListeners,
        })
      } else {
        logger.info("Instance IS listening for context type", {
          instanceId: instance.instanceId,
          contextType: context.type,
          registeredListeners: instance.contextListeners,
        })
      }

      return listensForType
    })
    .map(instance => {
      try {
        // FDC3 agent library expects broadcastEvent (not contextEvent) with originatingApp
        // Get the sender's instance info for originatingApp
        const senderInstance = getInstance(getState(), handlerContext.instanceId)

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
