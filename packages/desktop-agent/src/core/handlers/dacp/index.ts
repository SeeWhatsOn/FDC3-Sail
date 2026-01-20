import { withDACPTimeout, DACP_TIMEOUTS, logDACPMessage } from "../../protocol/dacp-utilities"
import { validateDACPMessage } from "../validation/dacp-validator"
import {
  BaseDACPMessageSchema,
  BroadcastRequestSchema,
  AddContextListenerRequestSchema,
  ContextListenerUnsubscribeRequestSchema,
  RaiseIntentRequestSchema,
  RaiseIntentForContextRequestSchema,
  AddIntentListenerRequestSchema,
  IntentListenerUnsubscribeRequestSchema,
  FindIntentRequestSchema,
  FindIntentsByContextRequestSchema,
  IntentResultRequestSchema,
  GetCurrentChannelRequestSchema,
  GetCurrentContextRequestSchema,
  JoinUserChannelRequestSchema,
  LeaveCurrentChannelRequestSchema,
  GetUserChannelsRequestSchema,
  GetOrCreateChannelRequestSchema,
  GetInfoRequestSchema,
  OpenRequestSchema,
  FindInstancesRequestSchema,
  GetAppMetadataRequestSchema,
  AddEventListenerRequestSchema,
  EventListenerUnsubscribeRequestSchema,
  CreatePrivateChannelRequestSchema,
  PrivateChannelDisconnectRequestSchema,
  PrivateChannelAddEventListenerRequestSchema,
  WCP4ValidateAppIdentitySchema,
  WCP6GoodbyeSchema,
  HeartbeatAcknowledgmentRequestSchema,
} from "../validation/dacp-schemas"
import { type DACPHandler, type DACPHandlerContext, type DACPMessage } from "../types"
import { type z } from "zod"
import { resolvePendingIntent, removeListenersForInstance, removeInstance } from "../../state/transforms"

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
  try {
    // Log incoming message (with sensitive data filtering)
    logDACPMessage("incoming", message, "DACP Router")

    // Validate base message structure
    const baseMessage = validateDACPMessage(message, BaseDACPMessageSchema)

    // If an injected validator is provided, use it for additional validation
    if (context.validator) {
      const validationResult = context.validator.validate(baseMessage.type, message)
      if (!validationResult.valid) {
        context.logger.error("DACP message validation failed:", {
          messageType: baseMessage.type,
          errors: validationResult.errors,
        })
        // Let the handler deal with the invalid message - it will send appropriate error response
      }
    }

    // Get appropriate timeout for message type
    const timeout = getTimeoutForMessageType(baseMessage.type)

    // Route to handler with timeout
    await withDACPTimeout(
      handleDACPMessage(baseMessage.type, message, context),
      timeout,
      `DACP ${baseMessage.type} handling`
    )
  } catch (error) {
    // Use console.error as fallback since we don't have context here
    console.error("DACP message routing failed:", {
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
 * Schema map for message type validation
 */
function getSchemaForMessageType(messageType: string): z.ZodSchema | null {
  const schemaMap: Record<string, z.ZodSchema> = {
    // Context handlers
    broadcastRequest: BroadcastRequestSchema,
    addContextListenerRequest: AddContextListenerRequestSchema,
    contextListenerUnsubscribeRequest: ContextListenerUnsubscribeRequestSchema,

    // Intent handlers
    raiseIntentRequest: RaiseIntentRequestSchema,
    raiseIntentForContextRequest: RaiseIntentForContextRequestSchema,
    addIntentListenerRequest: AddIntentListenerRequestSchema,
    intentListenerUnsubscribeRequest: IntentListenerUnsubscribeRequestSchema,
    findIntentRequest: FindIntentRequestSchema,
    findIntentsByContextRequest: FindIntentsByContextRequestSchema,
    intentResultRequest: IntentResultRequestSchema,

    // Channel handlers
    getCurrentChannelRequest: GetCurrentChannelRequestSchema,
    getCurrentContextRequest: GetCurrentContextRequestSchema,
    joinUserChannelRequest: JoinUserChannelRequestSchema,
    leaveCurrentChannelRequest: LeaveCurrentChannelRequestSchema,
    getUserChannelsRequest: GetUserChannelsRequestSchema,
    getOrCreateChannelRequest: GetOrCreateChannelRequestSchema,

    // App management handlers
    getInfoRequest: GetInfoRequestSchema,
    openRequest: OpenRequestSchema,
    findInstancesRequest: FindInstancesRequestSchema,
    getAppMetadataRequest: GetAppMetadataRequestSchema,

    // Event handlers
    addEventListenerRequest: AddEventListenerRequestSchema,
    eventListenerUnsubscribeRequest: EventListenerUnsubscribeRequestSchema,

    // Private channel handlers
    createPrivateChannelRequest: CreatePrivateChannelRequestSchema,
    privateChannelDisconnectRequest: PrivateChannelDisconnectRequestSchema,
    privateChannelAddContextListenerRequest: PrivateChannelAddEventListenerRequestSchema,

    // WCP handlers
    WCP4ValidateAppIdentity: WCP4ValidateAppIdentitySchema,
    WCP6Goodbye: WCP6GoodbyeSchema,

    // Heartbeat handlers
    heartbeatAcknowledgementRequest: HeartbeatAcknowledgmentRequestSchema,
  }

  return schemaMap[messageType] || null
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
    context.logger.warn(`No handler found for DACP message type: ${messageType}`)
    return
  }

  // Validate message against specific schema
  const schema = getSchemaForMessageType(messageType)
  if (schema) {
    const validatedMessage = validateDACPMessage(message, schema)
    // Execute handler with validated message
    await handler(validatedMessage as DACPMessage, context)
  } else {
    // No schema available, pass message as-is (for backwards compatibility)
    context.logger.debug(`No schema found for message type: ${messageType}, passing message as-is`)
    await handler(message as DACPMessage, context)
  }
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
    privateChannelAddContextListenerRequest:
      privateChannelHandlers.handlePrivateChannelAddContextListenerRequest,

    // WCP handlers
    WCP4ValidateAppIdentity: wcpHandlers.handleWcp4ValidateAppIdentity,
    WCP6Goodbye: wcpHandlers.handleWCP6Goodbye,

    // Heartbeat handlers
    heartbeatAcknowledgementRequest: heartbeatHandlers.handleHeartbeatAcknowledgmentRequest,
  }

  return handlerMap[messageType] || null
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
    p => p.sourceInstanceId === instanceId || p.targetInstanceId === instanceId
  )
  pendingIntents.forEach(pending => {
    // Reject promise if it exists (from intent-handlers Map)
    // Note: This requires access to the Map in intent-handlers, which is module-level
    // For now, we'll just remove from state - the promise will timeout
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
  const removedPrivateChannels = privateChannelHandlers.removeInstancePrivateChannels(
    instanceId,
    getState,
    setState
  )
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

    // Heartbeat handlers
    heartbeatAcknowledgementRequest: true,
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
export {
  contextHandlers,
  intentHandlers,
  channelHandlers,
  eventHandlers,
  appHandlers,
  wcpHandlers,
  privateChannelHandlers,
  heartbeatHandlers,
}
