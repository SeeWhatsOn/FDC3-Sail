import {
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
  generateEventUuid,
} from "../../protocol/dacp-utilities"
import { type DACPHandlerContext, type DACPMessage } from "../types"
import { sendDACPResponse, sendDACPErrorResponse } from "./utils/dacp-response-utils"
import { getInstance, getPrivateChannel } from "../../state/selectors"
import {
  createPrivateChannel,
  disconnectInstanceFromPrivateChannel,
  addPrivateChannelContextListener,
} from "../../state/transforms"

/**
 * Handles createPrivateChannelRequest
 * Creates a new private channel for peer-to-peer communication between apps
 */
export function handleCreatePrivateChannelRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const instance = getInstance(getState(), instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for creating private channel`)
    }

    // Generate channel ID
    const channelId = `private-${crypto.randomUUID()}`

    // Create the private channel using state transform
    setState(state => createPrivateChannel(state, channelId, instance.appId, instanceId))

    logger.info("DACP: Private channel created", {
      channelId,
      creatorAppId: instance.appId,
      creatorInstanceId: instanceId,
    })

    // Return channel information to the creator
    const response = createDACPSuccessResponse(message, "createPrivateChannelResponse", {
      channel: {
        id: channelId,
        type: "private",
      },
    })

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Create private channel failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.CHANNEL_ERROR,
      errorMessage: error instanceof Error ? error.message : "Failed to create private channel",
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
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const payload = message.payload as { channelId: string }
    const channelId = payload.channelId

    const state = getState()
    const channel = getPrivateChannel(state, channelId)
    if (!channel) {
      throw new Error(`Private channel ${channelId} not found`)
    }

    // Verify the instance is connected to this channel
    if (!channel.connectedInstances.includes(instanceId)) {
      throw new Error(`Instance ${instanceId} is not connected to channel ${channelId}`)
    }

    // Notify all disconnect listeners before disconnecting
    const disconnectListeners = Object.values(channel.disconnectListeners)
    disconnectListeners.forEach(listener => {
      if (listener.instanceId !== instanceId) {
        const disconnectEvent = createDACPEvent("privateChannelDisconnectEvent", {
          channelId,
          instanceId, // The instance that is disconnecting
        })
        // Add routing metadata
        const disconnectEventWithRouting = {
          ...disconnectEvent,
          meta: {
            ...disconnectEvent.meta,
            destination: { instanceId: listener.instanceId },
          },
        }

        transport.send(disconnectEventWithRouting)
      }
    })

    // Unsubscribe all context listeners for this instance
    const contextListenersToRemove = Object.values(channel.contextListeners).filter(
      listener => listener.instanceId === instanceId
    )

    contextListenersToRemove.forEach(listener => {
      // Notify other apps about unsubscribe
      const unsubscribeEvent = createDACPEvent("privateChannelUnsubscribeEvent", {
        channelId,
        contextType: listener.contextType,
      })

      channel.connectedInstances.forEach(connectedInstanceId => {
        if (connectedInstanceId !== instanceId) {
          // Add routing metadata
          const unsubscribeEventWithRouting = {
            ...unsubscribeEvent,
            meta: {
              ...unsubscribeEvent.meta,
              destination: { instanceId: connectedInstanceId },
            },
          }

          transport.send(unsubscribeEventWithRouting)
        }
      })
    })

    // Disconnect the instance using state transform
    setState(state => disconnectInstanceFromPrivateChannel(state, channelId, instanceId))

    logger.info("DACP: Instance disconnected from private channel", {
      channelId,
      instanceId,
      notifiedListeners: disconnectListeners.length,
    })

    // Send success response
    const response = createDACPSuccessResponse(message, "privateChannelDisconnectResponse")
    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Private channel disconnect failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.CHANNEL_ERROR,
      errorMessage: error instanceof Error ? error.message : "Failed to disconnect from private channel",
      instanceId,
      transport,
    })
  }
}

/**
 * Handles privateChannelAddContextListenerRequest
 * TODO: Implement this when the schema is available
 */
export function handlePrivateChannelAddContextListenerRequest(
  message: DACPMessage,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, getState, setState, logger } = context

  try {
    const { channelId, contextType } = message.payload as { channelId: string; contextType?: string }

    const state = getState()
    const channel = getPrivateChannel(state, channelId)
    if (!channel) {
      throw new Error(`Private channel ${channelId} not found`)
    }

    if (!channel.connectedInstances.includes(instanceId)) {
      throw new Error(`Instance ${instanceId} is not connected to channel ${channelId}`)
    }

    const listenerId = generateEventUuid()

    // Add the listener using state transform
    setState(state =>
      addPrivateChannelContextListener(state, channelId, listenerId, instanceId, contextType || null)
    )

    logger.info("DACP: Context listener added to private channel", {
      channelId,
      instanceId,
      contextType,
      listenerId,
    })

    // Notify other connected apps about the new listener
    const addListenerEvent = createDACPEvent("privateChannelAddContextListenerEvent", {
      channelId,
      contextType: contextType || null,
    })

    channel.connectedInstances.forEach(connectedInstanceId => {
      if (connectedInstanceId !== instanceId) {
        // Add routing metadata
        const addListenerEventWithRouting = {
          ...addListenerEvent,
          meta: {
            ...addListenerEvent.meta,
            destination: { instanceId: connectedInstanceId },
          },
        }

        transport.send(addListenerEventWithRouting)
      }
    })

    // Send success response
    const response = createDACPSuccessResponse(
      message,
      "privateChannelAddContextListenerResponse",
      {
        listenerId,
      }
    )

    sendDACPResponse({ response, instanceId, transport })
  } catch (error) {
    logger.error("DACP: Private channel add context listener failed", error)
    sendDACPErrorResponse({
      message,
      errorType: DACP_ERROR_TYPES.LISTENER_ERROR,
      errorMessage: error instanceof Error ? error.message : "Failed to add context listener to private channel",
      instanceId,
      transport,
    })
  }
}

/**
 * Remove all private channels for an instance (called on disconnect)
 */
export function removeInstancePrivateChannels(
  instanceId: string,
  getState: () => import("../../state/types").AgentState,
  setState: (fn: (state: import("../../state/types").AgentState) => import("../../state/types").AgentState) => void
): number {
  const state = getState()
  const privateChannels = Object.values(state.channels.private)
  const channelsToRemove = privateChannels.filter(channel =>
    channel.connectedInstances.includes(instanceId)
  )

  channelsToRemove.forEach(channel => {
    setState(state => disconnectInstanceFromPrivateChannel(state, channel.id, instanceId))
  })

  return channelsToRemove.length
}
