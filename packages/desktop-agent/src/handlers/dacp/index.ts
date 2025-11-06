import {
  validateDACPMessage,
  withDACPTimeout,
  DACP_TIMEOUTS,
  logDACPMessage,
} from "../validation/dacp-validator"
import { BaseDACPMessageSchema } from "../validation/dacp-schemas"
import { type DACPHandler, type DACPHandlerContext, logger } from "../types"

// Import all DACP handlers
import * as contextHandlers from "./context.handlers"
import * as intentHandlers from "./intent.handlers"
import * as channelHandlers from "./channel.handlers"
import * as eventHandlers from "./event.handlers"
import * as appHandlers from "./app-management/app.handlers"
import * as wcpHandlers from "./wcp.handlers"
import * as privateChannelHandlers from "./private-channel.handlers"

/**
 * Routes DACP messages to appropriate handlers
 */
export async function routeDACPMessage(message: unknown, context: DACPHandlerContext): Promise<void> {
  try {
    // Log incoming message (with sensitive data filtering)
    logDACPMessage("incoming", message, "DACP Router")

    // Validate base message structure
    const baseMessage = validateDACPMessage(message, BaseDACPMessageSchema)

    // Get appropriate timeout for message type
    const timeout = getTimeoutForMessageType(baseMessage.type)

    // Route to handler with timeout
    await withDACPTimeout(
      handleDACPMessage(baseMessage.type, message, context),
      timeout,
      `DACP ${baseMessage.type} handling`
    )
  } catch (error) {
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
  // Get handler function for message type
  const handler = getHandlerForMessageType(messageType)

  if (!handler) {
    logger.warn(`No handler found for DACP message type: ${messageType}`)
    return
  }

  // Execute handler
  await handler(message, context)
}

/**
 * Handler registry - maps message types to handler functions
 */
function getHandlerForMessageType(messageType: string): DACPHandler | null {
  const handlerMap: Record<string, DACPHandler> = {
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
    privateChannelAddContextListenerRequest: privateChannelHandlers.handlePrivateChannelAddContextListenerRequest,

    // WCP handlers
    'WCP4ValidateAppIdentity': wcpHandlers.handleWCP4ValidateAppIdentity,

    // TODO: Heartbeat handlers (to be implemented)
    // 'heartbeatAcknowledgmentRequest': heartbeatHandlers.handleHeartbeatAcknowledgmentRequest,
  }

  return handlerMap[messageType] || null
}

/**
 * Get appropriate timeout for message type
 */
function getTimeoutForMessageType(messageType: string): number {
  // App launch operations get longer timeout
  const appLaunchMessages = ["openRequest", "raiseIntentRequest", "raiseIntentForContextRequest", "findInstancesRequest"]

  if (appLaunchMessages.includes(messageType)) {
    return DACP_TIMEOUTS.APP_LAUNCH
  }

  // Default timeout for other operations
  return DACP_TIMEOUTS.DEFAULT
}

/**
 * Cleanup function to be called when a DACP connection is closed.
 * Removes instance from registries.
 */
export function cleanupDACPHandlers(context: DACPHandlerContext): void {
  const { instanceId, appInstanceRegistry, intentRegistry } = context

  logger.info("Cleaning up DACP handlers for instance", { instanceId })

  // Cancel any pending intents involving this instance
  const cancelledIntents = intentRegistry.cancelPendingIntentsForInstance(instanceId)
  if (cancelledIntents > 0) {
    logger.info(`Cancelled ${cancelledIntents} pending intents for disconnected instance`, { instanceId })
  }

  // Remove event listeners
  const removedEventListeners = eventHandlers.removeInstanceEventListeners(instanceId)
  if (removedEventListeners > 0) {
    logger.info(`Removed ${removedEventListeners} event listeners for disconnected instance`, { instanceId })
  }

  // Remove private channels
  const removedPrivateChannels = privateChannelHandlers.removeInstancePrivateChannels(instanceId)
  if (removedPrivateChannels > 0) {
    logger.info(`Removed ${removedPrivateChannels} private channels for disconnected instance`, { instanceId })
  }

  // Remove instance from registries
  appInstanceRegistry.removeInstance(instanceId)
  intentRegistry.removeInstanceListeners(instanceId)

  logger.debug("DACP handlers cleanup completed", { instanceId })
}

/**
 * Get statistics about registered listeners and handlers
 */
export function getDACPHandlerStats(): {
  supportedMessageTypes: string[]
  totalHandlers: number
} {
  const handlerMap = {
    // Context handlers
    broadcastRequest: true,
    addContextListenerRequest: true,
    contextListenerUnsubscribeRequest: true,

    // Intent handlers
    raiseIntentRequest: true,
    raiseIntentForContextRequest: true,
    addIntentListenerRequest: true,
    intentListenerUnsubscribeRequest: true,
    findIntentRequest: true,
    findIntentsByContextRequest: true,
    intentResultRequest: true,

    // Channel handlers
    getCurrentChannelRequest: true,
    getCurrentContextRequest: true,
    joinUserChannelRequest: true,
    leaveCurrentChannelRequest: true,
    getUserChannelsRequest: true,
    getOrCreateChannelRequest: true,

    // App management handlers
    getInfoRequest: true,
    openRequest: true,
    findInstancesRequest: true,
    getAppMetadataRequest: true,

    // Event handlers
    addEventListenerRequest: true,
    eventListenerUnsubscribeRequest: true,

    // Private channel handlers
    createPrivateChannelRequest: true,
    privateChannelDisconnectRequest: true,
    privateChannelAddContextListenerRequest: true,

    // WCP handlers
    WCP4ValidateAppIdentity: true,
  }

  return {
    supportedMessageTypes: Object.keys(handlerMap),
    totalHandlers: Object.keys(handlerMap).length,
  }
}

/**
 * Health check function for DACP handlers
 */
export function checkDACPHandlerHealth(): {
  status: "healthy" | "degraded" | "unhealthy"
  details: string[]
} {
  const details: string[] = []
  let status: "healthy" | "degraded" | "unhealthy" = "healthy"

  try {
    // Check if handler functions are available
    const stats = getDACPHandlerStats()
    details.push(`${stats.totalHandlers} DACP handlers registered`)

    // Check for required handlers
    const requiredHandlers = [
      "broadcastRequest",
      "addContextListenerRequest",
      "raiseIntentRequest",
      "getCurrentChannelRequest",
      "joinUserChannelRequest",
      "WCP4ValidateAppIdentity",
    ]

    const missingHandlers = requiredHandlers.filter(
      handler => !stats.supportedMessageTypes.includes(handler)
    )

    if (missingHandlers.length > 0) {
      status = "unhealthy"
      details.push(`Missing required handlers: ${missingHandlers.join(", ")}`)
    }

    if (status === "healthy") {
      details.push("All DACP handlers operational")
    }
  } catch (error) {
    status = "unhealthy"
    details.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  return { status, details }
}

// Re-export handlers for testing and direct access
export { contextHandlers, intentHandlers, channelHandlers, eventHandlers, appHandlers, wcpHandlers, privateChannelHandlers }
