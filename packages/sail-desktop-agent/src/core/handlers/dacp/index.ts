import { withDACPTimeout, logDACPMessage } from "../../dacp-protocol/dacp-utils"
import { DACP_TIMEOUTS } from "../../dacp-protocol/dacp-constants"
import { type DACPHandlerContext, type MessageType } from "../types"
import {
  resolvePendingIntent,
  removeListenersForInstance,
  removeInstance,
} from "../../state/mutators"

// Import all DACP handlers
import * as contextHandlers from "./context-handlers"
import * as intentHandlers from "./intent-handlers"
import * as channelHandlers from "./channel-handlers"
import * as eventHandlers from "./event-handlers"
import * as appHandlers from "./app-handlers"
import * as wcpHandlers from "./wcp-handlers"
import * as privateChannelHandlers from "./private-channel-handlers"
import * as heartbeatHandlers from "./heartbeat-handlers"

/**
 * Routes DACP messages to appropriate handlers
 */
export async function routeDACPMessage(
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { logger, validator } = context
  try {
    // Log incoming message (with sensitive data filtering)
    logDACPMessage("incoming", message, "DACP Router")
    logger.info("DACP: Routing message", { message })

    // Extract message type for routing
    const messageType = (message as { type?: MessageType })?.type

    // If an injected validator is provided, use it for validation
    if (validator && messageType) {
      const validationResult = validator.validate(messageType, message)
      if (!validationResult.valid) {
        logger.error("DACP message validation failed:", {
          messageType,
          errors: validationResult.errors,
        })
        // TODO: Let the handler deal with the invalid message - it will send appropriate error response or should this be handled here?
        // We need to add some basic checking here or use a default validator to check things like a uuid is present etc
        return
      }
    }

    // Get appropriate timeout for message type
    const resolvedMessageType = messageType ?? "unknown"
    const timeout = getTimeoutForMessageType(resolvedMessageType)

    // Route to handler with timeout
    await withDACPTimeout(
      handleDACPMessage(resolvedMessageType, message, context),
      timeout,
      `DACP ${resolvedMessageType} handling`
    )
  } catch (error) {
    // Use console.error as fallback since we don't have context here
    logger.error("DACP message routing failed:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      messageType:
        typeof message === "object" && message !== null && "type" in message
          ? (message as { type: string }).type
          : "unknown",
      messageData: message,
    })

    // Note: Individual handlers are responsible for sending error responses to the client
    // The router doesn't send responses directly to avoid conflicts
  }
}

/**
 * Routes messages to specific handlers based on message type
 */
async function handleDACPMessage(
  messageType: string,
  message: unknown,
  context: DACPHandlerContext
): Promise<void> {
  const { logger } = context
  // Get handler function for message type
  const handler = getHandlerForMessageType(messageType)

  if (!handler) {
    logger.warn(`No handler found for DACP message type: ${messageType}`)
    return
  }

  // Pass message to handler - validation is handled by injected validator at router level
  await handler(message, context)
}

/**
 * Handler registry - maps message types to handler functions
 */
type RoutedHandler = (message: unknown, context: DACPHandlerContext) => void | Promise<void>

function getHandlerForMessageType(messageType: string): RoutedHandler | null {
  const handlerMap = {
    // Context handlers
    broadcastRequest: contextHandlers.handleBroadcastRequest,
    addContextListenerRequest: contextHandlers.handleAddContextListener,
    contextListenerUnsubscribeRequest: contextHandlers.handleContextListenerUnsubscribe,

    // Intent handlers
    raiseIntentRequest: intentHandlers.handleRaiseIntentRequest,
    raiseIntentForContextRequest: intentHandlers.handleRaiseIntentForContextRequest,
    addIntentListenerRequest: intentHandlers.handleAddIntentListener,
    intentListenerUnsubscribeRequest: intentHandlers.handleIntentListenerUnsubscribe,
    findIntentRequest: intentHandlers.handleFindIntentRequest,
    findIntentsByContextRequest: intentHandlers.handleFindIntentsByContextRequest,
    intentResultRequest: intentHandlers.handleIntentResultRequest,

    // Channel handlers
    getCurrentChannelRequest: channelHandlers.handleGetCurrentChannelRequest,
    getCurrentContextRequest: channelHandlers.handleGetCurrentContextRequest,
    joinUserChannelRequest: channelHandlers.handleJoinUserChannelRequest,
    leaveCurrentChannelRequest: channelHandlers.handleLeaveCurrentChannelRequest,
    getUserChannelsRequest: channelHandlers.handleGetUserChannelsRequest,
    getOrCreateChannelRequest: channelHandlers.handleGetOrCreateChannelRequest,

    // App management handlers
    getInfoRequest: appHandlers.handleGetInfoRequest,
    openRequest: appHandlers.handleOpenRequest,
    findInstancesRequest: appHandlers.handleFindInstancesRequest,
    getAppMetadataRequest: appHandlers.handleGetAppMetadataRequest,

    // Event handlers
    addEventListenerRequest: eventHandlers.handleAddEventListenerRequest,
    eventListenerUnsubscribeRequest: eventHandlers.handleEventListenerUnsubscribeRequest,

    // Private channel handlers
    createPrivateChannelRequest: privateChannelHandlers.handleCreatePrivateChannelRequest,
    privateChannelDisconnectRequest: privateChannelHandlers.handlePrivateChannelDisconnectRequest,
    privateChannelAddEventListenerRequest:
      privateChannelHandlers.handlePrivateChannelAddContextListenerRequest,
    privateChannelUnsubscribeEventListenerRequest:
      privateChannelHandlers.handlePrivateChannelUnsubscribeEventListenerRequest,

    // WCP handlers
    WCP4ValidateAppIdentity: wcpHandlers.handleWcp4ValidateAppIdentity,
    WCP6Goodbye: wcpHandlers.handleWCP6Goodbye,

    // Heartbeat handlers
    heartbeatAcknowledgementRequest: heartbeatHandlers.handleHeartbeatAcknowledgmentRequest,
  }

  return (handlerMap as Record<string, RoutedHandler>)[messageType] || null
}

/**
 * Get appropriate timeout for message type
 */
function getTimeoutForMessageType(messageType: string): number {
  // App launch operations get longer timeout
  const appLaunchMessages = [
    "openRequest",
    "raiseIntentRequest",
    "raiseIntentForContextRequest",
    "findInstancesRequest",
  ]

  if (appLaunchMessages.includes(messageType)) {
    return DACP_TIMEOUTS.APP_LAUNCH
  }

  // Default timeout for other operations
  return DACP_TIMEOUTS.DEFAULT
}

/**
 * Cleanup function to be called when a DACP connection is closed.
 * Removes instance from state.
 */
export function cleanupDACPHandlers(context: DACPHandlerContext): void {
  const { instanceId, getState, setState, logger } = context

  logger.info("Cleaning up DACP handlers for instance", { instanceId })

  // Cancel any pending intents involving this instance
  const state = getState()
  const pendingIntents = Object.values(state.intents.pending).filter(
    p => p.targetInstanceId === instanceId
  )
  pendingIntents.forEach(pending => {
    // Reject promise if it exists (from intent-helpers Map)
    const promiseData = context.pendingIntentPromises.get(pending.requestId)
    if (promiseData) {
      if (promiseData.timeoutHandle) {
        clearTimeout(promiseData.timeoutHandle)
      }
      if (promiseData.deliveryTimeoutHandle) {
        clearTimeout(promiseData.deliveryTimeoutHandle)
      }
      promiseData.reject(new Error("Intent cancelled - target instance disconnected"))
      context.pendingIntentPromises.delete(pending.requestId)
    }
    setState(state => resolvePendingIntent(state, pending.requestId))
  })
  if (pendingIntents.length > 0) {
    logger.info(`Cancelled ${pendingIntents.length} pending intents for disconnected instance`, {
      instanceId,
    })
  }

  // Remove event listeners
  eventHandlers.removeInstanceEventListeners(instanceId, setState)
  logger.info("Removed event listeners for disconnected instance", { instanceId })

  // Remove private channels
  const removedPrivateChannels = privateChannelHandlers.removeInstancePrivateChannels(context)
  if (removedPrivateChannels > 0) {
    logger.info(`Removed ${removedPrivateChannels} private channels for disconnected instance`, {
      instanceId,
    })
  }

  // Stop heartbeat
  heartbeatHandlers.stopHeartbeat(instanceId, setState)

  // Remove intent listeners
  setState(state => removeListenersForInstance(state, instanceId))

  // Remove instance from state
  setState(state => removeInstance(state, instanceId))

  logger.info("DACP handlers cleanup completed", { instanceId })
}
