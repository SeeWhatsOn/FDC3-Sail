import { BridgingError, type BrowserTypes } from "@finos/fdc3"

import { DACP_TIMEOUTS } from "../dacp/dacp-constants"
import { DACPProcessingError, DACPTimeoutError } from "../dacp/dacp-errors"
import { applyInboundValidationPolicy } from "../dacp/validate-dacp-message"
import type { Logger, LogPayloadDetail } from "../logging/logger"
import { type DACPHandlerContext } from "./types"
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
    logIncomingDacpMessage(message, logger, resolvedLogPayloadDetail)
    logger.info("DACP: Routing message", extractDACPMessageLogMetadata(message))

    // Extract message type for routing
    const messageType = (message as { type?: string })?.type

    // Messages reaching this DACP edge may already have been raw-validated and enriched by
    // BrowserAppConnection.enrichMessageWithSource (see wcp-message-routing.ts), which stamps a
    // schema-illegal meta.messageOrigin. This is also the only validation gate for edges that
    // skip BrowserAppConnection entirely (e.g. the DACP test harness), where messages stay raw
    // and never carry messageOrigin — so stripping it here is a no-op there and a correction here.
    if (
      applyInboundValidationPolicy(stripMessageOriginForValidation(message), {
        logger,
        validation,
      }) === "rejected"
    ) {
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
 * Strips `meta.messageOrigin` before validation. `BrowserAppConnection.enrichMessageWithSource`
 * stamps this field onto DACP messages after they were already validated raw (see
 * wcp-message-routing.ts); it is not part of the DACP wire schema (`additionalProperties: false`
 * on `meta`), so re-validating an enriched message here would fail every request from a
 * fully-connected app. Only this field is stripped — `meta.source`, also added by enrichment, is
 * schema-legal and stays.
 */
function stripMessageOriginForValidation(message: unknown): unknown {
  if (typeof message !== "object" || message === null) {
    return message
  }

  const meta = (message as { meta?: unknown }).meta
  if (typeof meta !== "object" || meta === null || !("messageOrigin" in meta)) {
    return message
  }

  const { messageOrigin: _messageOrigin, ...restMeta } = meta as Record<string, unknown>
  return { ...(message as Record<string, unknown>), meta: restMeta }
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
 * Message types this router accepts beyond the FDC3 2.2 `AppRequestMessage` schema union.
 *
 * `closeRequest` is an FDC3 3.0 forward-port (see `open/handlers.ts`'s `CloseRequestMessage` and
 * `handleCloseRequest`, which gates it behind `fdc3Version >= "3.0"`). It has no generated 2.2
 * schema validator, so it is also absent from `INBOUND_VALIDATORS` in
 * `dacp/validate-dacp-message.ts` and goes unvalidated even in `strict` mode. Listed here by name
 * so that gap is a documented, visible decision rather than a silent fall-through.
 */
type ExtensionRequestMessage = appHandlers.CloseRequestMessage

/** Every message type this router can dispatch: the 2.2 union plus the extensions above. */
type RoutableRequestMessage = BrowserTypes.AppRequestMessage | ExtensionRequestMessage
type RoutableMessageType = RoutableRequestMessage["type"]

/** Handler for one specific message type, narrowed to that type's own request shape. */
type HandlerFor<K extends RoutableMessageType> = (
  message: Extract<RoutableRequestMessage, { type: K }>,
  context: DACPHandlerContext,
) => void | Promise<void>

/**
 * Erased handler shape used once a handler has been looked up by a runtime (not statically known)
 * message type. `HANDLER_MAP` itself stays precisely typed per key via `HandlerFor`.
 */
type RoutedHandler = (message: unknown, context: DACPHandlerContext) => void | Promise<void>

/**
 * Handler registry - maps message types to handler functions.
 * Module-level so the map is not reallocated on every DACP message.
 *
 * Typed as `{ [K in RoutableMessageType]: HandlerFor<K> }`: every member of
 * `RoutableMessageType` must have an entry (a required handler removed from this object is a
 * compile error), and every key must be a member of `RoutableMessageType` (a typo'd or invented
 * key is a compile error too).
 */
const HANDLER_MAP: { [K in RoutableMessageType]: HandlerFor<K> } = {
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

/** Type guard so a runtime `string` can be used to index `HANDLER_MAP`. */
function isRoutableMessageType(messageType: string): messageType is RoutableMessageType {
  return Object.prototype.hasOwnProperty.call(HANDLER_MAP, messageType)
}

function getHandlerForMessageType(messageType: string): RoutedHandler | null {
  if (!isRoutableMessageType(messageType)) {
    return null
  }

  // HANDLER_MAP[messageType] is HandlerFor<K> for the specific K matched above; erasing to the
  // general RoutedHandler shape is exactly the point where a runtime-selected handler meets a
  // runtime (not statically typed) message — see the RoutedHandler doc comment.
  return HANDLER_MAP[messageType] as RoutedHandler
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

/**
 * Wraps a promise with a timeout, rejecting with DACPTimeoutError if exceeded.
 */
function withDACPTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DACP_TIMEOUTS.DEFAULT,
  operation: string = "DACP operation",
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new DACPTimeoutError(`${operation} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle)
    }
  })
}

/**
 * Build metadata-only fields for structured DACP logs (no sensitive context values).
 */
function extractDACPMessageLogMetadata(message: unknown): Record<string, unknown> {
  if (typeof message !== "object" || message === null) {
    return { messageFormat: typeof message }
  }

  const msg = message as Record<string, unknown>
  const meta = msg.meta as Record<string, unknown> | undefined
  const payload = msg.payload as Record<string, unknown> | undefined
  const context = payload?.context as Record<string, unknown> | undefined

  const metadata: Record<string, unknown> = {
    type: msg.type,
    requestUuid: meta?.requestUuid,
    eventUuid: meta?.eventUuid,
  }

  if (payload?.channelId !== undefined) {
    metadata.channelId = payload.channelId
  }

  if (context) {
    metadata.contextType = context.type
    metadata.contextKeys = Object.keys(context)
  }

  return metadata
}

/**
 * Metadata-only at info/warn/error; full payloads only on {@link Logger.debug}
 * when `logPayloadDetail` is `'full'`.
 */
function logIncomingDacpMessage(
  message: unknown,
  logger: Logger,
  logPayloadDetail: LogPayloadDetail,
): void {
  try {
    if (typeof message === "object" && message !== null) {
      const metadata = extractDACPMessageLogMetadata(message)
      logger.debug("[DACP INCOMING]", { ...metadata, source: "DACP Router" })

      if (logPayloadDetail === "full") {
        logger.debug("[DACP INCOMING full payload]", {
          source: "DACP Router",
          fullMessage: JSON.stringify(message),
        })
      }
    } else {
      logger.warn("[DACP INVALID INCOMING]", {
        message: "Invalid message format",
        source: "DACP Router",
      })
    }
  } catch (error) {
    logger.error(`[DACP LOG ERROR]`, error)
  }
}
