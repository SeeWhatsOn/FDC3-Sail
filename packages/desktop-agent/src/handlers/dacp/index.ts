import {
  validateDACPMessage,
  withDACPTimeout,
  DACP_TIMEOUTS,
  logDACPMessage,
} from "../validation/dacp-validator"
import { BaseDACPMessageSchema } from "../validation/dacp-schemas"
import { type DACPHandlerContext, logger } from "../types"

// Import all DACP handlers
import * as contextHandlers from "./context.handlers"
import * as intentHandlers from "./intent.handlers"
import * as channelHandlers from "./channel.handlers"
import * as appHandlers from "./app-management/app.handlers"
import * as wcpHandlers from "./wcp.handlers"

// Handler registry type
type DACPHandlerFunction = (message: unknown, context: DACPHandlerContext) => Promise<void>

import { appInstanceRegistry } from "../../state/AppInstanceRegistry"
import { intentRegistry } from "../../state/IntentRegistry"

/**
 * Processes a single DACP message in a transport-agnostic way.
 * @param message The incoming DACP message.
 * @param context The handler context, excluding the transport-specific messagePort.
 * @param reply A function to send a reply back to the client.
 */
export async function processDACPMessage(
  message: unknown,
  context: Omit<DACPHandlerContext, "messagePort">,
  reply: (response: any) => void
) {
  // Create a mock messagePort for the handlers to use
  const messagePort = {
    postMessage: reply,
  } as MessagePort

  const fullContext: DACPHandlerContext = {
    ...context,
    messagePort,
  }

  await routeDACPMessage(message, fullContext)
}

/**
 * Main DACP message router for MessagePort
 * Routes incoming DACP messages to appropriate handlers with validation and timeout management
 */
export function registerDACPHandlers(
  messagePort: MessagePort,
  serverContext: any,
  fdc3Server: any,
  instanceId: string
): void {
  logger.info("Registering DACP message handlers for instance", { instanceId })

  const context: Omit<DACPHandlerContext, "messagePort"> = {
    serverContext,
    fdc3Server,
    instanceId,
    appInstanceRegistry,
    intentRegistry,
  }

  messagePort.onmessage = async event => {
    await processDACPMessage(event.data, context, response => {
      messagePort.postMessage(response)
    })
  }

  messagePort.onmessageerror = event => {
    logger.error("DACP MessagePort error:", event)
  }

  logger.info("DACP handlers registered successfully for instance", { instanceId })
}

/**
 * Routes DACP messages to appropriate handlers
 */
async function routeDACPMessage(message: unknown, context: DACPHandlerContext): Promise<void> {
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
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      messageType:
        typeof message === "object" && message !== null && "type" in message
          ? (message as any).type
          : "unknown",
      messageData: message,
    })

    // Note: Individual handlers are responsible for sending error responses
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
function getHandlerForMessageType(messageType: string): DACPHandlerFunction | null {
  const handlerMap: Record<string, DACPHandlerFunction> = {
    // Context handlers
    broadcastRequest: contextHandlers.handleBroadcastRequest,
    addContextListenerRequest: contextHandlers.handleAddContextListener,
    contextListenerUnsubscribeRequest: contextHandlers.handleContextListenerUnsubscribe,

    // Intent handlers
    raiseIntentRequest: intentHandlers.handleRaiseIntentRequest,
    addIntentListenerRequest: intentHandlers.handleAddIntentListener,
    intentListenerUnsubscribeRequest: intentHandlers.handleIntentListenerUnsubscribe,
    findIntentRequest: intentHandlers.handleFindIntentRequest,

    // Channel handlers
    getCurrentChannelRequest: channelHandlers.handleGetCurrentChannelRequest,
    joinUserChannelRequest: channelHandlers.handleJoinUserChannelRequest,
    leaveCurrentChannelRequest: channelHandlers.handleLeaveCurrentChannelRequest,
    getUserChannelsRequest: channelHandlers.handleGetUserChannelsRequest,

    // App management handlers (to be implemented in Phase 3)
    'getInfoRequest': appHandlers.handleGetInfoRequest,
    // 'findInstancesRequest': appHandlers.handleFindInstancesRequest,
    // 'openRequest': appHandlers.handleOpenRequest,

    // WCP handlers
    'WCP4ValidateAppIdentity': wcpHandlers.handleWCP4ValidateAppIdentity,

    // Private channel handlers (to be implemented in Phase 3)
    // 'createPrivateChannelRequest': privateChannelHandlers.handleCreatePrivateChannelRequest,
    // 'privateChannelDisconnectRequest': privateChannelHandlers.handlePrivateChannelDisconnectRequest,

    // Heartbeat handlers (to be implemented in Phase 3)
    // 'heartbeatAcknowledgmentRequest': heartbeatHandlers.handleHeartbeatAcknowledgmentRequest,
  }

  return handlerMap[messageType] || null
}

/**
 * Get appropriate timeout for message type
 */
function getTimeoutForMessageType(messageType: string): number {
  // App launch operations get longer timeout
  const appLaunchMessages = ["openRequest", "raiseIntentRequest", "findInstancesRequest"]

  if (appLaunchMessages.includes(messageType)) {
    return DACP_TIMEOUTS.APP_LAUNCH
  }

  // Default timeout for other operations
  return DACP_TIMEOUTS.DEFAULT
}

/**
 * Cleanup function to be called when a DACP connection is closed.
 * This now delegates cleanup to the central registries.
 */
export function cleanupDACPHandlers(instanceId: string): void {
  logger.info("Cleaning up DACP handlers for instance", { instanceId })

  // The new model is that registries are responsible for their own cleanup
  // when an instance is fully removed. This function can be used to trigger that.
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
    addIntentListenerRequest: true,
    intentListenerUnsubscribeRequest: true,
    findIntentRequest: true,

    // Channel handlers
    getCurrentChannelRequest: true,
    joinUserChannelRequest: true,
    leaveCurrentChannelRequest: true,
    getUserChannelsRequest: true,
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
    ]

    const missingHandlers = requiredHandlers.filter(
      handler => !stats.supportedMessageTypes.includes(handler)
    )

    if (missingHandlers.length > 0) {
      status = "unhealthy"
      details.push(`Missing required handlers: ${missingHandlers.join(", ")}`)
    }

    // Additional health checks could be added here
    // - Check if schemas are loaded
    // - Check if validation is working
    // - Check if timeouts are configured correctly

    if (status === "healthy") {
      details.push("All DACP handlers operational")
    }
  } catch (error) {
    status = "unhealthy"
    details.push(`Health check failed: ${error}`)
  }

  return { status, details }
}

// Re-export handlers for testing and direct access
export { contextHandlers, intentHandlers, channelHandlers }
