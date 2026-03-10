import {
  createDACPSuccessResponse,
  createDACPEvent,
} from "../../dacp-protocol/dacp-message-creators"
import { type DACPHandlerContext } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { ChannelError } from "@finos/fdc3"
import { FDC3ChannelError, NoChannelFoundError } from "../../errors/fdc3-errors"
import {
  getAppChannel,
  getChannelContext,
  getInstance,
  getInstancesOnChannel,
  getPrivateChannel,
  getStoredContext,
  getUserChannel,
} from "../../state/selectors"
import {
  storeContext,
  addContextListener,
  joinChannel,
  removeContextListener,
  addPrivateChannelContextListener,
  removePrivateChannelContextListener,
  setPrivateChannelLastContext,
  connectInstanceToPrivateChannel,
} from "../../state/mutators"
import { generateEventUuid } from "../../dacp-protocol/dacp-utils"
import {
  notifyPrivateChannelAddContextListener,
  notifyPrivateChannelUnsubscribe,
} from "./private-channel-handlers"
import { notifyContextListenerAdded } from "./utils/open-with-context"
import { isValidContext } from "./utils/context-validation"

/**
 * Handles broadcast requests to send context to a channel
 * Implements DACP broadcastRequest message handling
 *
 * Note: Message validation happens at router level before this handler is called
 */
export async function handleBroadcastRequest(
  message: BrowserTypes.BroadcastRequest,
  context: DACPHandlerContext
): Promise<void> {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { channelId: payloadChannelId, context: broadcastContext } = message.payload

    if (!isValidContext(broadcastContext)) {
      sendDACPErrorResponse({
        message,
        errorType: ChannelError.MalformedContext,
        errorMessage: "Invalid context: context must be an object with a string type property",
        instanceId,
        transport,
      })
      return
    }

    // Validate that the instance is a member of the channel they're broadcasting to
    const state = getState()
    const instance = getInstance(state, instanceId)
    if (!instance) {
      throw new Error("Instance not found")
    }

    const channelId = payloadChannelId ?? instance.currentChannel
    if (!channelId) {
      // No channel specified and app not joined - no-op per spec
      const response = createDACPSuccessResponse(message, "broadcastResponse")
      sendDACPResponse({ response, instanceId, transport })
      return
    }

    const userChannel = getUserChannel(state, channelId)
    const appChannel = getAppChannel(state, channelId)
    const privateChannel = getPrivateChannel(state, channelId)
    if (!userChannel && !appChannel && !privateChannel) {
      throw new NoChannelFoundError(`Channel ${channelId} does not exist`)
    }

    if (userChannel && instance.currentChannel !== channelId && !payloadChannelId) {
      // No-op for DesktopAgent.broadcast when not joined to a user channel.
      const response = createDACPSuccessResponse(message, "broadcastResponse")
      sendDACPResponse({ response, instanceId, transport })
      return
    }

    logger.info("DACP: Processing broadcast request", {
      channelId,
      contextType: broadcastContext.type,
      requestUuid: message.meta.requestUuid,
    })

    // Store context using state transform (skip for private channels)
    if (!privateChannel) {
      setState(state => storeContext(state, channelId, broadcastContext, instanceId))
    }

    if (privateChannel) {
      if (!privateChannel.connectedInstances.includes(instanceId)) {
        throw new Error(`Instance ${instanceId} is not connected to private channel ${channelId}`)
      }

      setState(state =>
        setPrivateChannelLastContext(state, channelId, broadcastContext.type, broadcastContext)
      )
      await notifyPrivateChannelContextListeners(channelId, broadcastContext, context)
    } else {
      await notifyContextListeners(channelId, broadcastContext, context)
    }

    const response = createDACPSuccessResponse(message, "broadcastResponse")

    sendDACPResponse({ response, instanceId, transport })

    logger.debug("DACP: Broadcast request completed successfully", {
      requestUuid: message.meta.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Broadcast request failed", error)

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
      message,
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
export function handleAddContextListener(
  message: BrowserTypes.AddContextListenerRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { channelId, contextType: payloadContextType } = message.payload
    const contextType = payloadContextType ?? "*" // Default to all contexts if not specified

    if (channelId) {
      const state = getState()
      const userChannel = getUserChannel(state, channelId)
      const appChannel = getAppChannel(state, channelId)
      const privateChannel = getPrivateChannel(state, channelId)

      if (!userChannel && !appChannel && !privateChannel) {
        throw new NoChannelFoundError(`Channel ${channelId} does not exist`)
      }

      if (appChannel) {
        setState(state => joinChannel(state, instanceId, channelId))
      }

      if (userChannel) {
        setState(state => joinChannel(state, instanceId, channelId))
      }

      if (privateChannel) {
        const privateContextType = payloadContextType ?? null
        const listenerId = generateEventUuid()
        const resolvedContextType = privateContextType === "*" ? null : privateContextType

        if (!privateChannel.connectedInstances.includes(instanceId)) {
          setState(state => connectInstanceToPrivateChannel(state, channelId, instanceId))
        }

        setState(state =>
          addPrivateChannelContextListener(
            state,
            channelId,
            listenerId,
            instanceId,
            resolvedContextType
          )
        )

        notifyPrivateChannelAddContextListener(channelId, instanceId, resolvedContextType, context)

        const response = createDACPSuccessResponse(message, "addContextListenerResponse", {
          listenerUUID: listenerId,
        })

        sendDACPResponse({ response, instanceId, transport })
        return
      }
    }

    logger.info("DACP: Adding context listener", {
      instanceId,
      contextType,
      requestUuid: message.meta.requestUuid,
    })

    const listenerId = message.meta.requestUuid

    // Add context listener using state transform
    setState(state => addContextListener(state, instanceId, listenerId, contextType))

    notifyContextListenerAdded(instanceId, contextType, context)

    logger.info("DACP: Context listener registration result", {
      instanceId,
      contextType,
      listenerId,
      added: true,
      requestUuid: message.meta.requestUuid,
    })

    const response = createDACPSuccessResponse(message, "addContextListenerResponse", {
      listenerUUID: listenerId,
    })

    sendDACPResponse({ response, instanceId, transport })

    logger.debug("DACP: Context listener added successfully", {
      listenerUUID: listenerId,
      instanceId,
      requestUuid: message.meta.requestUuid,
    })

    const stateAfterListener = getState()
    const instanceAfterListener = getInstance(stateAfterListener, instanceId)
    const joinedChannelId = instanceAfterListener?.currentChannel
    if (joinedChannelId && getUserChannel(stateAfterListener, joinedChannelId)) {
      deliverCurrentContextToListener(instanceId, joinedChannelId, contextType, context)
    }
  } catch (error) {
    logger.error("DACP: Add context listener failed", error)

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to add context listener"

    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("Access denied") || errorMessage.includes("denied")) {
      errorType = ChannelError.AccessDenied
    } else if (errorMessage.toLowerCase().includes("listener")) {
      errorType = "ListenerNotFound" as ChannelError
    } else if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
      errorType = ChannelError.NoChannelFound
    }

    sendDACPErrorResponse({
      message,
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
  message: BrowserTypes.ContextListenerUnsubscribeRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { listenerUUID } = message.payload

    logger.info("DACP: Unsubscribing context listener", {
      listenerUUID,
      instanceId,
      requestUuid: message.meta?.requestUuid,
    })

    const state = getState()
    const instance = getInstance(state, instanceId)
    const hasInstanceListener = !!instance && !!instance.contextListeners[listenerUUID]

    if (hasInstanceListener) {
      setState(state => removeContextListener(state, instanceId, listenerUUID))
    } else {
      const privateChannels = Object.values(state.channels.private)
      const privateChannelWithListener = privateChannels.find(
        channel => channel.contextListeners[listenerUUID]
      )

      if (!privateChannelWithListener) {
        throw new Error(`Context listener ${listenerUUID} not found for instance ${instanceId}`)
      }

      const privateListener = privateChannelWithListener.contextListeners[listenerUUID]
      if (privateListener.instanceId !== instanceId) {
        throw new Error(`Context listener ${listenerUUID} not found for instance ${instanceId}`)
      }

      setState(state =>
        removePrivateChannelContextListener(state, privateChannelWithListener.id, listenerUUID)
      )
      notifyPrivateChannelUnsubscribe(
        privateChannelWithListener.id,
        listenerUUID,
        privateListener.contextType,
        instanceId,
        context
      )
    }

    const response = createDACPSuccessResponse(message, "contextListenerUnsubscribeResponse")

    sendDACPResponse({ response, instanceId, transport })

    logger.debug("DACP: Context listener unsubscribed successfully", {
      listenerUUID,
      instanceId,
      requestUuid: message.meta?.requestUuid,
    })
  } catch (error) {
    logger.error("DACP: Context listener unsubscribe failed", error)

    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage =
      error instanceof Error ? error.message : "Failed to unsubscribe context listener"

    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("Access denied") || errorMessage.includes("denied")) {
      errorType = ChannelError.AccessDenied
    } else if (errorMessage.toLowerCase().includes("listener")) {
      errorType = "ListenerNotFound" as ChannelError
    } else if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
      errorType = ChannelError.NoChannelFound
    }

    sendDACPErrorResponse({
      message,
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
      const listensForType = Object.values(instance.contextListeners).some(
        listenerContextType => listenerContextType === context.type || listenerContextType === "*"
      )

      if (!listensForType) {
        logger.info("Instance not listening for context type", {
          instanceId: instance.instanceId,
          contextType: context.type,
          registeredListeners: Object.values(instance.contextListeners),
        })
      } else {
        logger.info("Instance IS listening for context type", {
          instanceId: instance.instanceId,
          contextType: context.type,
          registeredListeners: Object.values(instance.contextListeners),
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

        const broadcastPayload = (broadcastEvent as BrowserTypes.BroadcastEvent).payload
        logger.debug("DACP: Broadcast event message structure", {
          type: broadcastEventWithRouting.type,
          hasPayload: !!broadcastPayload,
          hasContext: !!broadcastPayload?.context,
          contextType: broadcastPayload?.context?.type,
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

function deliverCurrentContextToListener(
  instanceId: string,
  channelId: string,
  contextType: string,
  handlerContext: DACPHandlerContext
): void {
  const state = handlerContext.getState()
  const contextToDeliver =
    contextType === "*"
      ? getChannelContext(state, channelId)
      : getChannelContext(state, channelId, contextType)

  if (!contextToDeliver) {
    return
  }

  const storedContext = getStoredContext(state, channelId, contextToDeliver.type)
  const sourceInstanceId = storedContext?.sourceInstanceId
  const sourceInstance = sourceInstanceId ? getInstance(state, sourceInstanceId) : undefined

  const broadcastEvent = createDACPEvent("broadcastEvent", {
    channelId,
    context: contextToDeliver,
    originatingApp: {
      appId: sourceInstance?.appId ?? "unknown",
      instanceId: sourceInstanceId ?? "unknown",
    },
  })

  const broadcastEventWithRouting = {
    ...broadcastEvent,
    meta: {
      ...broadcastEvent.meta,
      destination: { instanceId },
    },
  }

  handlerContext.transport.send(broadcastEventWithRouting)
}

async function notifyPrivateChannelContextListeners(
  channelId: string,
  context: Context,
  handlerContext: DACPHandlerContext
): Promise<void> {
  const { getState, logger } = handlerContext
  const privateChannel = getPrivateChannel(getState(), channelId)

  if (!privateChannel) {
    return
  }

  const contextListeners = Object.values(privateChannel.contextListeners)

  const notifications = contextListeners
    .filter(listener => {
      if (listener.instanceId === handlerContext.instanceId) {
        return false
      }

      return listener.contextType === null || listener.contextType === context.type
    })
    .map(listener => {
      const senderInstance = getInstance(getState(), handlerContext.instanceId)
      const broadcastEvent = createDACPEvent("broadcastEvent", {
        channelId,
        context,
        originatingApp: {
          appId: senderInstance?.appId || "unknown",
          instanceId: handlerContext.instanceId,
        },
      })

      const broadcastEventWithRouting = {
        ...broadcastEvent,
        meta: {
          ...broadcastEvent.meta,
          destination: { instanceId: listener.instanceId },
        },
      }

      logger.info("DACP: Sending private channel broadcast event", {
        targetInstanceId: listener.instanceId,
        channelId,
        contextType: context.type,
      })

      handlerContext.transport.send(broadcastEventWithRouting)
    })

  await Promise.allSettled(notifications)
}
