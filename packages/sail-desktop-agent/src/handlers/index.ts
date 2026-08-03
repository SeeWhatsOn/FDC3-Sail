import { BridgingError } from "@finos/fdc3"

import { DACP_TIMEOUTS } from "../dacp/dacp-constants"
import { DACPProcessingError, DACPTimeoutError } from "../dacp/dacp-errors"
import { withDACPTimeout, logDACPMessage, extractDACPMessageLogMetadata } from "../dacp/dacp-utils"
import { applyInboundValidationPolicy } from "../dacp/validate-dacp-message"
import { type DACPHandlerContext, type MessageType } from "./types"
import { sendDACPErrorResponse } from "./utils/dacp-response-utils"

// Import all DACP handlers
import * as contextHandlers from "./broadcast/handlers"
import * as intentHandlers from "./intents"
import * as channelHandlers from "./channels/handlers"
import * as eventHandlers from "./events/handlers"
import * as appHandlers from "./open/handlers"
import * as privateChannelHandlers from "./private-channels/handlers"
import * as heartbeatHandlers from "./heartbeat/handlers"

/**
 * Routes DACP messages to appropriate handlers
 */
export async function routeDACPMessage(
  message: unknown,
  context: DACPHandlerContext,
): Promise<void> {
  const { logger, validation, logPayloadDetail } = context
  const resolvedLogPayloadDetail = logPayloadDetail ?? "metadata"
  try {
    logDACPMessage("incoming", message, "DACP Router", {
      logger,
      logPayloadDetail: resolvedLogPayloadDetail,
    })
    logger.info("DACP: Routing message", extractDACPMessageLogMetadata(message))

    // Extract message type for routing
    const messageType = (message as { type?: MessageType })?.type

    if (applyInboundValidationPolicy(message, { logger, validation }) === "rejected") {
      sendErrorResponseIfRequestLike(
        message,
        context,
        BridgingError.MalformedMessage,
        "Invalid message structure",
      )
      return
    }

    // Get appropriate timeout for message type
    const resolvedMessageType = messageType ?? "unknown"
    const timeout = getTimeoutForMessageType(resolvedMessageType)

    // Route to handler with timeout
    await withDACPTimeout(
      handleDACPMessage(resolvedMessageType, message, context),
      timeout,
      `DACP ${resolvedMessageType} handling`,
    )
  } catch (error) {
    const err =
      error instanceof DACPTimeoutError
        ? error
        : new DACPProcessingError("DACP processing failed", { cause: error })
    logger.error("DACP message routing failed:", {
      error: err.message,
      stack: err.stack,
      cause: err.cause,
      messageType:
        typeof message === "object" && message !== null && "type" in message
          ? (message as { type: string }).type
          : "unknown",
      messageData: extractDACPMessageLogMetadata(message),
    })
    if (err instanceof DACPTimeoutError) {
      sendErrorResponseIfRequestLike(
        message,
        context,
        BridgingError.ResponseTimedOut,
        "Request timed out",
      )
    } else {
      sendErrorResponseIfRequestLike(
        message,
        context,
        BridgingError.MalformedMessage,
        "Message processing failed",
      )
    }
  }
}

/**
 * Sends a DACP error response when the message has a request-like shape (type + meta.requestUuid).
 * Used for validation failures, timeouts, and unexpected processing errors.
 */
function sendErrorResponseIfRequestLike(
  message: unknown,
  context: DACPHandlerContext,
  errorType: (typeof BridgingError)[keyof typeof BridgingError],
  errorMessage: string,
): void {
  const req = message as { type?: string; meta?: { requestUuid?: string } }
  if (req?.type && req.meta?.requestUuid) {
    sendDACPErrorResponse({
      message: { type: req.type, meta: { requestUuid: req.meta.requestUuid } },
      errorType,
      errorMessage,
      instanceId: context.instanceId,
      responses: context.responses,
    })
  }
}

/**
 * Routes messages to specific handlers based on message type
 */
async function handleDACPMessage(
  messageType: string,
  message: unknown,
  context: DACPHandlerContext,
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
 * Handler registry - maps message types to handler functions.
 * Module-level so the map is not reallocated on every DACP message.
 */
type RoutedHandler = (message: unknown, context: DACPHandlerContext) => void | Promise<void>

const HANDLER_MAP = {
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
  closeRequest: appHandlers.handleCloseRequest,
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

  // Heartbeat handlers
  heartbeatAcknowledgementRequest: heartbeatHandlers.handleHeartbeatAcknowledgmentRequest,
}

function getHandlerForMessageType(messageType: string): RoutedHandler | null {
  return (HANDLER_MAP as Record<string, RoutedHandler>)[messageType] || null
}

export { cleanupDACPHandlers } from "./cleanup"

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
