import {
  validateDACPMessage,
  createDACPErrorResponse,
  createDACPSuccessResponse,
  createDACPEvent,
  DACP_ERROR_TYPES,
  generateEventUuid,
} from "../validation/dacp-validator"
import {
  CreateprivatechannelrequestSchema,
  PrivatechanneldisconnectrequestSchema,
} from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"
import { PrivateChannelRegistry } from "../../state/PrivateChannelRegistry"

// Singleton registry instance
const privateChannelRegistry = new PrivateChannelRegistry()

/**
 * Handles createPrivateChannelRequest
 * Creates a new private channel for peer-to-peer communication between apps
 */
export function handleCreatePrivateChannelRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId, appInstanceRegistry } = context

  try {
    const request = validateDACPMessage(message, CreateprivatechannelrequestSchema)
    const instance = appInstanceRegistry.getInstance(instanceId)

    if (!instance) {
      throw new Error(`Instance ${instanceId} not found for creating private channel`)
    }

    // Create the private channel
    const channel = privateChannelRegistry.createChannel(instance.appId, instanceId)

    logger.info("DACP: Private channel created", {
      channelId: channel.id,
      creatorAppId: instance.appId,
      creatorInstanceId: instanceId,
    })

    // Return channel information to the creator
    const response = createDACPSuccessResponse(request, "createPrivateChannelResponse", {
      channel: {
        id: channel.id,
        type: "private",
      },
    })

    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: Create private channel failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      "createPrivateChannelResponse",
      error instanceof Error ? error.message : "Failed to create private channel"
    )
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles privateChannelDisconnectRequest
 * Disconnects an instance from a private channel
 */
export function handlePrivateChannelDisconnectRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId } = context

  try {
    const request = validateDACPMessage(message, PrivatechanneldisconnectrequestSchema)
    const payload = request.payload as { channelId: string }
    const channelId = payload.channelId

    const channel = privateChannelRegistry.getChannel(channelId)
    if (!channel) {
      throw new Error(`Private channel ${channelId} not found`)
    }

    // Verify the instance is connected to this channel
    if (!channel.connectedInstances.has(instanceId)) {
      throw new Error(`Instance ${instanceId} is not connected to channel ${channelId}`)
    }

    // Notify all disconnect listeners before disconnecting
    const disconnectListeners = Array.from(channel.disconnectListeners.values())
    disconnectListeners.forEach(listener => {
      if (listener.instanceId !== instanceId) {
        const disconnectEvent = createDACPEvent("privateChannelDisconnectEvent", {
          channelId,
          instanceId, // The instance that is disconnecting
        })
        transport.send(listener.instanceId, disconnectEvent)
      }
    })

    // Unsubscribe all context listeners for this instance
    const contextListenersToRemove = Array.from(channel.contextListeners.values()).filter(
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
          transport.send(connectedInstanceId, unsubscribeEvent)
        }
      })
    })

    // Disconnect the instance
    privateChannelRegistry.disconnectInstance(channelId, instanceId)

    logger.info("DACP: Instance disconnected from private channel", {
      channelId,
      instanceId,
      notifiedListeners: disconnectListeners.length,
    })

    // Send success response
    const response = createDACPSuccessResponse(request, "privateChannelDisconnectResponse")
    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: Private channel disconnect failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.CHANNEL_ERROR,
      "privateChannelDisconnectResponse",
      error instanceof Error ? error.message : "Failed to disconnect from private channel"
    )
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Handles privateChannelAddContextListenerRequest
 * TODO: Implement this when the schema is available
 */
export function handlePrivateChannelAddContextListenerRequest(
  message: unknown,
  context: DACPHandlerContext
): void {
  const { transport, instanceId } = context

  try {
    // TODO: Validate with proper schema when available
    const request = message as { meta: { requestUuid: string }; payload: { channelId: string; contextType?: string } }
    const { channelId, contextType } = request.payload

    const channel = privateChannelRegistry.getChannel(channelId)
    if (!channel) {
      throw new Error(`Private channel ${channelId} not found`)
    }

    if (!channel.connectedInstances.has(instanceId)) {
      throw new Error(`Instance ${instanceId} is not connected to channel ${channelId}`)
    }

    const listenerId = generateEventUuid()

    // Add the listener
    privateChannelRegistry.addContextListener(channelId, listenerId, instanceId, contextType || null)

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
        transport.send(connectedInstanceId, addListenerEvent)
      }
    })

    // Send success response
    const response = createDACPSuccessResponse(request, "privateChannelAddContextListenerResponse", {
      listenerId,
    })

    transport.send(instanceId, response)
  } catch (error) {
    logger.error("DACP: Private channel add context listener failed", error)
    const errorResponse = createDACPErrorResponse(
      message as { meta: { requestUuid: string } },
      DACP_ERROR_TYPES.LISTENER_ERROR,
      "privateChannelAddContextListenerResponse",
      error instanceof Error ? error.message : "Failed to add context listener to private channel"
    )
    transport.send(instanceId, errorResponse)
  }
}

/**
 * Get the private channel registry (for use by other handlers)
 */
export function getPrivateChannelRegistry(): PrivateChannelRegistry {
  return privateChannelRegistry
}

/**
 * Remove all private channels for an instance (called on disconnect)
 */
export function removeInstancePrivateChannels(instanceId: string): number {
  return privateChannelRegistry.removeInstanceChannels(instanceId)
}

/**
 * Clear all private channels (for testing)
 */
export function clearPrivateChannels(): void {
  privateChannelRegistry.clear()
}
