import { SailMessages } from "../../protocol/sail-messages"
import { AppHosting, State, WebAppDetails, AppHelloArgs } from "../../types/sail-types"
import {
  DACPMessage,
  BROADCAST_REQUEST,
  ADD_CONTEXT_LISTENER_REQUEST,
  RAISE_INTENT_REQUEST,
} from "@finos/fdc3-sail-desktop-agent"
import { SailData } from "../sailAppInstanceManager"
import {
  SocketIOCallback,
  HandlerContext,
  SocketType,
  CONFIG,
  DirectoryAppEntry,
  handleCallbackError,
  LogLevel,
  AuthenticatedSocket,
} from "./types"

/** Global state for debug reconnections */
let debugReconnectionNumber = 0

/**
 * Increments and returns the debug reconnection number
 */
function getNextDebugReconnectionNumber(): number {
  return ++debugReconnectionNumber
}

/**
 * Simple structured logger with configurable log levels
 */
const logger = {
  error: (message: string, ...args: unknown[]) => {
    console.error(`[${LogLevel.ERROR}] ${message}`, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[${LogLevel.WARN}] ${message}`, ...args)
  },
  info: (message: string, ...args: unknown[]) => {
    console.log(`[${LogLevel.INFO}] ${message}`, ...args)
  },
  debug: (message: string, ...args: unknown[]) => {
    if (CONFIG.DEBUG_MODE) {
      console.log(`[${LogLevel.DEBUG}] ${message}`, ...args)
    }
  },
}

/**
 * Creates a recovery instance for debug mode when an app connects with invalid instance ID
 * @param appHelloArgs - App hello arguments
 * @param directoryAppList - List of directory apps matching the app ID
 * @param socket - Socket connection
 * @returns Recovery instance data
 */
function createRecoveryInstance(
  appHelloArgs: AppHelloArgs,
  directoryAppList: DirectoryAppEntry[],
  socket: import("socket.io").Socket
): SailData {
  const [directoryApp] = directoryAppList
  const sailManifest = directoryApp.hostManifests?.sail as SailHostManifest | undefined

  return {
    appId: appHelloArgs.appId,
    instanceId: appHelloArgs.instanceId,
    state: State.Pending,
    socket,
    url: (directoryApp.details as WebAppDetails).url,
    hosting: sailManifest?.forceNewWindow ? AppHosting.Tab : AppHosting.Frame,
    channel: null,
    instanceTitle: `${directoryApp.title}${CONFIG.DEBUG_RECONNECTION_SUFFIX}${getNextDebugReconnectionNumber()}`,
    channelSockets: [],
  }
}

/**
 * Handles app hello messages for connection establishment
 * @param appHelloArgs - App hello arguments containing app and instance information
 * @param callback - Socket callback to return hosting type or error
 * @param context - Handler context with socket, connection state, and sessions
 */
function handleAppHello(
  appHelloArgs: AppHelloArgs,
  callback: SocketIOCallback<AppHosting>,
  { socket, connectionState }: HandlerContext
): void {
  logger.info("SAIL APP HELLO", appHelloArgs)

  // Get authenticated userId from socket
  const authenticatedSocket = socket as AuthenticatedSocket
  const userId = authenticatedSocket.userId

  if (!userId) {
    logger.error("No authenticated userId found on socket")
    return handleCallbackError(callback as SocketIOCallback<unknown>, "Authentication required")
  }

  connectionState.appInstanceId = appHelloArgs.instanceId
  connectionState.socketType = SocketType.APP

  try {
    // Get desktop agent from socket
    const fdc3Server = authenticatedSocket.desktopAgent

    if (!fdc3Server) {
      logger.error("App tried connecting to non-existent DA instance", {
        userId,
        instanceId: appHelloArgs.instanceId,
      })
      handleCallbackError(
        callback as SocketIOCallback<unknown>,
        "App tried connecting to non-existent DA instance"
      )
      return
    }

    logger.info("SAIL App connected", {
      userId,
      instanceId: appHelloArgs.instanceId,
    })
    const serverContext = fdc3Server.getServerContext()
    const existingInstance = serverContext.getInstanceDetails(appHelloArgs.instanceId)
    const directoryAppList = serverContext.directory.retrieveAppsById(appHelloArgs.appId)

    // Handle existing pending instance
    if (existingInstance?.state === State.Pending) {
      const updatedInstance: SailData = {
        ...existingInstance,
        socket,
        url:
          directoryAppList.length > 0
            ? (directoryAppList[0].details as WebAppDetails).url
            : existingInstance.url,
      }

      connectionState.fdc3ServerInstance = fdc3Server
      serverContext.setInstanceDetails(appHelloArgs.instanceId, updatedInstance)
      callback(updatedInstance.hosting)
      return
    }

    // Handle debug mode recovery
    if (CONFIG.DEBUG_MODE && directoryAppList.length > 0) {
      logger.warn(
        "App tried to connect with invalid instance ID, allowing connection in debug mode",
        { instanceId: appHelloArgs.instanceId }
      )

      const recoveryInstance = createRecoveryInstance(appHelloArgs, directoryAppList, socket)
      serverContext.setInstanceDetails(appHelloArgs.instanceId, recoveryInstance)
      connectionState.fdc3ServerInstance = fdc3Server
      callback(recoveryInstance.hosting)
      return
    }

    logger.error("App tried to connect with invalid instance ID", {
      instanceId: appHelloArgs.instanceId,
    })
    handleCallbackError(callback, "Invalid instance id")
  } catch (error) {
    logger.error("Error handling app hello", error)
    handleCallbackError(callback, "Connection error")
  }
}

/**
 * Routes DACP messages to appropriate handlers based on message type
 * @param dacpMessage - The DACP message to route
 * @param sourceId - Source identifier for the message
 * @param context - Handler context with connection state
 */
async function routeDACPMessage(
  dacpMessage: DACPMessage,
  sourceId: string,
  context: HandlerContext
): Promise<void> {
  if (!dacpMessage?.type?.startsWith("heartbeat")) {
    logger.debug("SAIL DACP Message", { dacpMessage, sourceId })
  }

  const { connectionState } = context
  const { fdc3ServerInstance } = connectionState

  if (!fdc3ServerInstance) {
    logger.error("No server instance available for DACP message")
    return
  }

  try {
    // Route based on DACP message type
    switch (dacpMessage.type) {
      case 'broadcastRequest':
        await handleBroadcastRequest(dacpMessage, sourceId, fdc3ServerInstance)
        break

      case 'addContextListenerRequest':
      case 'raiseIntentRequest':
      case 'getCurrentChannelRequest':
      case 'joinUserChannelRequest':
      default:
        // For now, forward all messages to the existing handler
        await handleFdc3AppEvent(dacpMessage as any, sourceId, context)
        break
    }
  } catch (error) {
    logger.error("Error routing DACP message", error)
  }
}

/**
 * Handles broadcast requests with context notification
 * @param message - The broadcast request message
 * @param sourceId - Source identifier for the message
 * @param fdc3ServerInstance - FDC3 server instance
 */
async function handleBroadcastRequest(
  message: DACPMessage,
  sourceId: string,
  fdc3ServerInstance: any
): Promise<void> {
  // Forward to FDC3 server
  await fdc3ServerInstance.receive(message, sourceId)

  // Notify broadcast context (existing logic)
  if (message.type === "broadcastRequest") {
    fdc3ServerInstance.serverContext.notifyBroadcastContext(message as any)
  }
}

/**
 * Legacy handler for FDC3 app events (will be gradually replaced)
 * @param eventData - FDC3 event data containing type and payload
 * @param sourceId - Source identifier for the event
 * @param context - Handler context containing connection state
 */
async function handleFdc3AppEvent(
  eventData:
    | AppRequestMessage
    | WebConnectionProtocol4ValidateAppIdentity
    | WebConnectionProtocol6Goodbye,
  sourceId: string,
  { connectionState }: HandlerContext
): Promise<void> {
  if (!eventData.type.startsWith("heartbeat")) {
    logger.debug("SAIL DACP Message", { eventData, sourceId })
  }

  const { fdc3ServerInstance } = connectionState
  if (!fdc3ServerInstance) {
    logger.error("No server instance available for FDC3 event")
    return
  }
  try {
    await fdc3ServerInstance.receive(eventData, sourceId)

    if (eventData.type === "broadcastRequest") {
      fdc3ServerInstance.serverContext.notifyBroadcastContext(
        eventData as unknown as BroadcastRequest
      )
    }
  } catch (error) {
    logger.error("Error processing FDC3 message", error)
  }
}

/**
 * Registers app-specific socket handlers
 */
export function registerAppHandlers(context: HandlerContext): void {
  const { socket } = context

  socket.on(
    SailMessages.APP_HELLO,
    (appHelloArgs: AppHelloArgs, callback: SocketIOCallback<AppHosting>) => {
      handleAppHello(appHelloArgs, callback, context)
    }
  )

  // Register single fdc3_event handler for all DACP messages (Socket.IO best practice)
  socket.on(SailMessages.FDC3_EVENT, async (dacpMessage: DACPMessage, sourceId: string) => {
    await routeDACPMessage(dacpMessage, sourceId, context)
  })
}
