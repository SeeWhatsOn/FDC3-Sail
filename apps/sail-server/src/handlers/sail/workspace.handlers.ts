import { v4 as uuid } from "uuid"
import { 
    SailMessages,
    AppHosting,
    State,
    WebAppDetails,
    AppHelloArgs
} from "@finos/sail-api"
import { SailData } from "../../sailAppInstanceManager"
import {
  ChannelMessages,
  IntentMessages,
  SailChannelChangeArgs,
  ChannelReceiverHelloRequest,
  ChannelReceiverUpdate,
  SailIntentResolveOpenChannelArgs,
} from "@finos/fdc3-web-impl"
import { BrowserTypes } from "@finos/fdc3"
import {
  SocketIOCallback,
  HandlerContext,
  SocketType,
  CONFIG,
  DirectoryAppEntry,
  handleCallbackError,
  LogLevel,
  AuthenticatedSocket,
  AppInstance,
} from "../types"
import { Socket } from "socket.io"

// Combined logger from both original files
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

// --- From appManagement.handlers.ts ---

interface SailHostManifest {
    forceNewWindow?: boolean;
}

let debugReconnectionNumber = 0

function getNextDebugReconnectionNumber(): number {
  return ++debugReconnectionNumber
}

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

function handleAppHello(
  appHelloArgs: AppHelloArgs,
  callback: SocketIOCallback<AppHosting>,
  { socket, connectionState }: HandlerContext
): void {
  logger.info("SAIL APP HELLO", appHelloArgs)
  const authenticatedSocket = socket as AuthenticatedSocket
  const userId = authenticatedSocket.userId

  if (!userId) {
    logger.error("No authenticated userId found on socket")
    return handleCallbackError(callback as SocketIOCallback<unknown>, "Authentication required")
  }

  connectionState.appInstanceId = appHelloArgs.instanceId
  connectionState.socketType = SocketType.APP

  try {
    const fdc3Server = authenticatedSocket.desktopAgent
    if (!fdc3Server) {
      logger.error("App tried connecting to non-existent DA instance", { userId, instanceId: appHelloArgs.instanceId })
      handleCallbackError(callback as SocketIOCallback<unknown>, "App tried connecting to non-existent DA instance")
      return
    }

    logger.info("SAIL App connected", { userId, instanceId: appHelloArgs.instanceId })
    const serverContext = fdc3Server.getServerContext()
    const existingInstance = serverContext.getInstanceDetails(appHelloArgs.instanceId)
    const directoryAppList = serverContext.directory.retrieveAppsById(appHelloArgs.appId)

    if (existingInstance?.state === State.Pending) {
      const updatedInstance: SailData = {
        ...existingInstance,
        socket,
        url: directoryAppList.length > 0 ? (directoryAppList[0].details as WebAppDetails).url : existingInstance.url,
      }
      connectionState.fdc3ServerInstance = fdc3Server
      serverContext.setInstanceDetails(appHelloArgs.instanceId, updatedInstance)
      callback(updatedInstance.hosting)
      return
    }

    if (CONFIG.DEBUG_MODE && directoryAppList.length > 0) {
      logger.warn("App tried to connect with invalid instance ID, allowing connection in debug mode", { instanceId: appHelloArgs.instanceId })
      const recoveryInstance = createRecoveryInstance(appHelloArgs, directoryAppList, socket)
      serverContext.setInstanceDetails(appHelloArgs.instanceId, recoveryInstance)
      connectionState.fdc3ServerInstance = fdc3Server
      callback(recoveryInstance.hosting)
      return
    }

    logger.error("App tried to connect with invalid instance ID", { instanceId: appHelloArgs.instanceId })
    handleCallbackError(callback, "Invalid instance id")
  } catch (error) {
    logger.error("Error handling app hello", error)
    handleCallbackError(callback, "Connection error")
  }
}

// --- From channelManagement.handlers.ts ---

function addChannelSocketToInstance(appInstance: AppInstance, socket: Socket): AppInstance {
  return {
    ...appInstance,
    channelSockets: [...appInstance.channelSockets, socket],
  }
}

async function handleChannelChange(
  channelChangeArgs: SailChannelChangeArgs,
  callback: SocketIOCallback<boolean>,
  { socket }: HandlerContext
): Promise<void> {
  console.log(`SAIL CHANNEL CHANGE: ${JSON.stringify(channelChangeArgs)}`)
  try {
    const authenticatedSocket = socket as AuthenticatedSocket
    const userId = authenticatedSocket.userId
    const fdc3Server = authenticatedSocket.desktopAgent

    if (!userId) {
      console.error("No authenticated userId found on socket")
      return handleCallbackError(callback, "Authentication required")
    }

    if (!fdc3Server) {
      console.error("No desktop agent found for user:", userId)
      return handleCallbackError(callback, "Desktop agent not initialized")
    }

    const joinChannelRequest: BrowserTypes.JoinUserChannelRequest = {
      type: "joinUserChannelRequest",
      payload: { channelId: channelChangeArgs.channel || "" },
      meta: { requestUuid: uuid(), timestamp: new Date() },
    }

    await fdc3Server.receive(joinChannelRequest, channelChangeArgs.instanceId)
    await fdc3Server.serverContext.notifyUserChannelsChanged(channelChangeArgs.instanceId, channelChangeArgs.channel)
    callback(true)
  } catch (error) {
    console.error("SAIL Channel change failed:", error)
    handleCallbackError(callback, "Channel change failed")
  }
}

function handleChannelReceiverHello(
  receiverHelloRequest: ChannelReceiverHelloRequest,
  callback: SocketIOCallback<ChannelReceiverUpdate>,
  { socket, connectionState }: HandlerContext
): void {
  connectionState.appInstanceId = receiverHelloRequest.instanceId
  connectionState.socketType = SocketType.CHANNEL

  try {
    const authenticatedSocket = socket as AuthenticatedSocket
    const userId = authenticatedSocket.userId
    const fdc3Server = authenticatedSocket.desktopAgent

    if (!userId) {
      console.error("No authenticated userId found on socket")
      return handleCallbackError(callback, "Authentication required")
    }

    if (!fdc3Server) {
      console.error("No desktop agent found for user:", userId)
      return handleCallbackError(callback, "Desktop agent not initialized")
    }
    const serverContext = fdc3Server.getServerContext()
    const appInstance = serverContext.getInstanceDetails(receiverHelloRequest.instanceId)

    if (!appInstance) {
      handleCallbackError(callback, "No app found")
      return
    }

    const mutableAppInstance = { ...appInstance, channelSockets: [...appInstance.channelSockets] }
    const updatedInstance = addChannelSocketToInstance(mutableAppInstance, socket)
    serverContext.setInstanceDetails(receiverHelloRequest.instanceId, { ...appInstance, ...updatedInstance })
    connectionState.fdc3ServerInstance = fdc3Server

    const channelUpdate: ChannelReceiverUpdate = { tabs: serverContext.getTabs() }
    callback(channelUpdate)
  } catch (error) {
    console.error("Error handling channel receiver hello:", error)
    handleCallbackError(callback, "Server error")
  }
}

async function handleIntentResolveOnChannel(
  intentResolveArgs: SailIntentResolveOpenChannelArgs,
  callback: SocketIOCallback<void>,
  { connectionState }: HandlerContext
): Promise<void> {
  console.log(`SAIL INTENT RESOLVE ON CHANNEL: ${JSON.stringify(intentResolveArgs)}`)
  const { fdc3ServerInstance } = connectionState
  if (!fdc3ServerInstance) {
    handleCallbackError(callback, "No server instance available")
    return
  }

  await fdc3ServerInstance.serverContext.openOnChannel(intentResolveArgs.appId, intentResolveArgs.channel)
  callback(undefined as unknown as void)
}

/**
 * Registers all workspace-related socket handlers
 */
export function registerWorkspaceHandlers(context: HandlerContext): void {
  const { socket } = context

  // From appManagement
  socket.on(
    SailMessages.APP_HELLO,
    (appHelloArgs: AppHelloArgs, callback: SocketIOCallback<AppHosting>) => {
      handleAppHello(appHelloArgs, callback, context)
    }
  )

  // From channelManagement
  socket.on(
    ChannelMessages.SAIL_CHANNEL_CHANGE,
    async (channelChangeArgs: SailChannelChangeArgs, callback: SocketIOCallback<boolean>) => {
      await handleChannelChange(channelChangeArgs, callback, context)
    }
  )

  socket.on(
    ChannelMessages.CHANNEL_RECEIVER_HELLO,
    (receiverHelloRequest: ChannelReceiverHelloRequest, callback: SocketIOCallback<ChannelReceiverUpdate>) => {
      handleChannelReceiverHello(receiverHelloRequest, callback, context)
    }
  )

  socket.on(
    IntentMessages.SAIL_INTENT_RESOLVE_ON_CHANNEL,
    async (intentResolveArgs: SailIntentResolveOpenChannelArgs, callback: SocketIOCallback<void>) => {
      await handleIntentResolveOnChannel(intentResolveArgs, callback, context)
    }
  )
}
