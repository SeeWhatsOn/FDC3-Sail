import { createDACPSuccessResponse, createDACPEvent } from "../../dacp-protocol/dacp-message-creators"
import { generateEventUuid } from "../../dacp-protocol/dacp-utils"
import { type DACPHandlerContext } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import type { BrowserTypes } from "@finos/fdc3"
import { ChannelError } from "@finos/fdc3"
import { FDC3ChannelError, ChannelCreationFailedError } from "../../errors/fdc3-errors"
import { getInstance, getPrivateChannel } from "../../state/selectors"
import {
  createPrivateChannel,
  connectInstanceToPrivateChannel,
  disconnectInstanceFromPrivateChannel,
  addPrivateChannelAddContextListenerListener,
  addPrivateChannelDisconnectListener,
  addPrivateChannelUnsubscribeListener,
  removePrivateChannelAddContextListenerListener,
  removePrivateChannelDisconnectListener,
  removePrivateChannelUnsubscribeListener,
} from "../../state/mutators"

/**
 * Handles createPrivateChannelRequest
 * Creates a new private channel for peer-to-peer communication between apps
 */
export function handleCreatePrivateChannelRequest(
  message: BrowserTypes.CreatePrivateChannelRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const instance = getInstance(getState(), instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for creating private channel`)
    }

    // Generate channel ID
    const channelId = generateEventUuid()

    // Create the private channel using state transform
    setState(state => createPrivateChannel(state, channelId, instance.appId, instanceId))

    logger.info("DACP: Private channel created", {
      channelId,
      creatorAppId: instance.appId,
      creatorInstanceId: instanceId,
    })

    // Return channel information to the creator
    const response = createDACPSuccessResponse(message, "createPrivateChannelResponse", {
      privateChannel: {
        id: channelId,
        type: "private",
      },
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Create private channel failed", error)
    
    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.CreationFailed
    const errorMessage = error instanceof Error ? error.message : "Failed to create private channel"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (error instanceof ChannelCreationFailedError) {
      errorType = error.errorType
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
 * Handles privateChannelDisconnectRequest
 * Disconnects an instance from a private channel
 */
export function handlePrivateChannelDisconnectRequest(
  message: BrowserTypes.PrivateChannelDisconnectRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { channelId } = message.payload

    const state = getState()
    const channel = getPrivateChannel(state, channelId)
    if (!channel) {
      throw new Error(`Private channel ${channelId} not found`)
    }

    // Verify the instance is connected to this channel
    if (!channel.connectedInstances.includes(instanceId)) {
      setState(state => connectInstanceToPrivateChannel(state, channelId, instanceId))
    }

    // Unsubscribe all context listeners for this instance
    const contextListenersToRemove = Object.values(channel.contextListeners).filter(
      listener => listener.instanceId === instanceId
    )

    notifyPrivateChannelUnsubscribeInternal(
      channel,
      contextListenersToRemove,
      instanceId,
      transport
    )

    notifyPrivateChannelDisconnectInternal(channel, instanceId, transport)

    // Disconnect the instance using state transform
    setState(state => disconnectInstanceFromPrivateChannel(state, channelId, instanceId))

    logger.info("DACP: Instance disconnected from private channel", {
      channelId,
      instanceId,
      notifiedListeners: Object.values(channel.disconnectListeners).length,
    })

    // Send success response
    const response = createDACPSuccessResponse(message, "privateChannelDisconnectResponse")
    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Private channel disconnect failed", error)
    
    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to disconnect from private channel"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
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
 * Handles privateChannelAddEventListenerRequest
 */
export function handlePrivateChannelAddContextListenerRequest(
  message: BrowserTypes.PrivateChannelAddEventListenerRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { privateChannelId, listenerType } = message.payload
    const channelId = privateChannelId

    const state = getState()
    const channel = getPrivateChannel(state, channelId)
    if (!channel) {
      throw new Error(`Private channel ${channelId} not found`)
    }

    if (!channel.connectedInstances.includes(instanceId)) {
      setState(state => connectInstanceToPrivateChannel(state, channelId, instanceId))
    }

    const listenerId = generateEventUuid()
    const resolvedListenerType = listenerType ?? "addContextListener"

    if (resolvedListenerType === "addContextListener") {
      setState(state =>
        addPrivateChannelAddContextListenerListener(state, channelId, listenerId, instanceId)
      )
    } else if (resolvedListenerType === "disconnect") {
      setState(state => addPrivateChannelDisconnectListener(state, channelId, listenerId, instanceId))
    } else if (resolvedListenerType === "unsubscribe") {
      setState(state => addPrivateChannelUnsubscribeListener(state, channelId, listenerId, instanceId))
    } else {
      throw new Error(`Unsupported private channel listener type: ${resolvedListenerType}`)
    }

    logger.info("DACP: Private channel event listener added", {
      channelId,
      instanceId,
      listenerType: resolvedListenerType,
      listenerId,
    })

    // Send success response
    const response = createDACPSuccessResponse(
      message,
      "privateChannelAddEventListenerResponse",
      {
        listenerUUID: listenerId,
      }
    )

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Private channel add context listener failed", error)
    
    // Extract FDC3 error type from error instance
    let errorType: ChannelError = ChannelError.ApiTimeout
    const errorMessage = error instanceof Error ? error.message : "Failed to add context listener to private channel"
    
    if (error instanceof FDC3ChannelError) {
      errorType = error.errorType
    } else if (errorMessage.includes("Access denied") || errorMessage.includes("denied")) {
      errorType = ChannelError.AccessDenied
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

export function handlePrivateChannelUnsubscribeEventListenerRequest(
  message: BrowserTypes.PrivateChannelUnsubscribeEventListenerRequest,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { listenerUUID } = message.payload
    const state = getState()
    const privateChannels = Object.values(state.channels.private)
    const channel = privateChannels.find(candidate =>
      candidate.addContextListenerListeners[listenerUUID] ||
      candidate.unsubscribeListeners[listenerUUID] ||
      candidate.disconnectListeners[listenerUUID]
    )

    if (!channel) {
      throw new Error(`Private channel listener ${listenerUUID} not found`)
    }

    const isOwnedByInstance =
      channel.addContextListenerListeners[listenerUUID]?.instanceId === instanceId ||
      channel.unsubscribeListeners[listenerUUID]?.instanceId === instanceId ||
      channel.disconnectListeners[listenerUUID]?.instanceId === instanceId

    if (!isOwnedByInstance) {
      throw new Error(`Private channel listener ${listenerUUID} not found for instance ${instanceId}`)
    }

    if (channel.addContextListenerListeners[listenerUUID]) {
      setState(state =>
        removePrivateChannelAddContextListenerListener(state, channel.id, listenerUUID)
      )
    } else if (channel.unsubscribeListeners[listenerUUID]) {
      setState(state => removePrivateChannelUnsubscribeListener(state, channel.id, listenerUUID))
    } else if (channel.disconnectListeners[listenerUUID]) {
      setState(state => removePrivateChannelDisconnectListener(state, channel.id, listenerUUID))
    }

    const response = createDACPSuccessResponse(
      message,
      "privateChannelUnsubscribeEventListenerResponse"
    )

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Private channel unsubscribe event listener failed", error)
    sendDACPErrorResponse({
      message,
      errorType: ChannelError.ApiTimeout,
      errorMessage: error instanceof Error ? error.message : "Failed to unsubscribe private channel listener",
      instanceId,
      transport,
    })
  }
}

/**
 * Remove all private channels for an instance (called on disconnect)
 */
export function removeInstancePrivateChannels(
  context: DACPHandlerContext
): number {
  const { instanceId, getState, setState, transport } = context
  const state = getState()
  const privateChannels = Object.values(state.channels.private)
  const channelsToRemove = privateChannels.filter(channel =>
    channel.connectedInstances.includes(instanceId)
  )

  channelsToRemove.forEach(channel => {
    const contextListenersToRemove = Object.values(channel.contextListeners).filter(
      listener => listener.instanceId === instanceId
    )

    notifyPrivateChannelUnsubscribeInternal(
      channel,
      contextListenersToRemove,
      instanceId,
      transport
    )

    notifyPrivateChannelDisconnectInternal(channel, instanceId, transport)
    setState(state => disconnectInstanceFromPrivateChannel(state, channel.id, instanceId))
  })

  return channelsToRemove.length
}

export function notifyPrivateChannelAddContextListener(
  channelId: string,
  sourceInstanceId: string,
  contextType: string | null,
  context: DACPHandlerContext
): void {
  const { getState, transport } = context
  const channel = getPrivateChannel(getState(), channelId)
  if (!channel) {
    return
  }

  const addListenerEvent = createDACPEvent("privateChannelOnAddContextListenerEvent", {
    privateChannelId: channelId,
    contextType,
  })

  Object.values(channel.addContextListenerListeners).forEach(listener => {
    if (listener.instanceId === sourceInstanceId) {
      return
    }

    const addListenerEventWithRouting = {
      ...addListenerEvent,
      meta: {
        ...addListenerEvent.meta,
        destination: { instanceId: listener.instanceId },
      },
    }

    transport.send(addListenerEventWithRouting)
  })
}

export function notifyPrivateChannelUnsubscribe(
  channelId: string,
  listenerId: string,
  contextType: string | null,
  sourceInstanceId: string,
  context: DACPHandlerContext
): void {
  const { getState, transport } = context
  const channel = getPrivateChannel(getState(), channelId)
  if (!channel) {
    return
  }

  notifyPrivateChannelUnsubscribeInternal(
    channel,
    [
      {
        listenerId,
        instanceId: sourceInstanceId,
        contextType,
      },
    ],
    sourceInstanceId,
    transport
  )
}

function notifyPrivateChannelUnsubscribeInternal(
  channel: NonNullable<ReturnType<typeof getPrivateChannel>>,
  contextListenersToRemove: Array<{ listenerId: string; instanceId: string; contextType: string | null }>,
  sourceInstanceId: string,
  transport: DACPHandlerContext["transport"]
): void {
  if (contextListenersToRemove.length === 0) {
    return
  }

  const unsubscribeListeners = Object.values(channel.unsubscribeListeners)

  contextListenersToRemove.forEach(listener => {
    const unsubscribeEvent = createDACPEvent("privateChannelOnUnsubscribeEvent", {
      privateChannelId: channel.id,
      contextType: listener.contextType ?? null,
    })

    unsubscribeListeners.forEach(unsubscribeListener => {
      if (unsubscribeListener.instanceId === sourceInstanceId) {
        return
      }

      const unsubscribeEventWithRouting = {
        ...unsubscribeEvent,
        meta: {
          ...unsubscribeEvent.meta,
          destination: { instanceId: unsubscribeListener.instanceId },
        },
      }

      transport.send(unsubscribeEventWithRouting)
    })
  })
}

function notifyPrivateChannelDisconnectInternal(
  channel: NonNullable<ReturnType<typeof getPrivateChannel>>,
  sourceInstanceId: string,
  transport: DACPHandlerContext["transport"]
): void {
  const disconnectListeners = Object.values(channel.disconnectListeners)

  disconnectListeners.forEach(listener => {
    if (listener.instanceId === sourceInstanceId) {
      return
    }

    const disconnectEvent = createDACPEvent("privateChannelOnDisconnectEvent", {
      privateChannelId: channel.id,
      contextType: null,
      instanceId: sourceInstanceId,
    })

    const disconnectEventWithRouting = {
      ...disconnectEvent,
      meta: {
        ...disconnectEvent.meta,
        destination: { instanceId: listener.instanceId },
      },
    }

    transport.send(disconnectEventWithRouting)
  })
}
