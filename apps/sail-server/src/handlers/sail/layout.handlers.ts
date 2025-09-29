import { v4 as uuid } from "uuid"
import {
  SailMessages,
  SailMessage,
  DesktopAgentHelloPayload,
  DesktopAgentDirectoryListingPayload,
  DesktopAgentRegisterAppLaunchPayload,
  SailClientStatePayload,
  TabDetail,
  State,
} from "@finos/sail-api"
import { SailAppInstanceManager } from "../../sailAppInstanceManager"
import { AppDirectoryManager } from "@finos/fdc3-sail-desktop-agent"
import { SailData } from "../../sailAppInstanceManager"
import {
  SocketIOCallback,
  HandlerContext,
  SocketType,
  CONFIG,
  PanelData,
  handleCallbackError,
  AuthenticatedSocket,
} from "../types"

/**
 * Handles Desktop Agent hello messages for session setup and management.
 * This now only sets up the SailAppInstanceManager, as the FDC3 engine is separate.
 */
async function handleDesktopAgentHello(
  desktopAgentHelloArgs: DesktopAgentHelloPayload,
  callback: SocketIOCallback<boolean>,
  { socket, connectionState }: HandlerContext
): Promise<void> {
  console.log(`SAIL DA HELLO: ${JSON.stringify(desktopAgentHelloArgs)}`)

  const authenticatedSocket = socket as AuthenticatedSocket
  const userId = authenticatedSocket.userId

  if (!userId) {
    console.error("No authenticated userId found on socket")
    return callback(false, "Authentication required")
  }

  connectionState.socketType = SocketType.DESKTOP_AGENT
  console.log("SAIL Desktop Agent Connecting for user:", userId)

  let appInstanceManager: SailAppInstanceManager

  if (authenticatedSocket.appInstanceManager) {
    appInstanceManager = authenticatedSocket.appInstanceManager
    await appInstanceManager.reloadAppDirectories(desktopAgentHelloArgs.directories, desktopAgentHelloArgs.customApps)
    console.log("SAIL updated app instance manager for user:", userId)
  } else {
    const directory = new AppDirectoryManager()
    await directory.replace(desktopAgentHelloArgs.directories)
    desktopAgentHelloArgs.customApps.forEach(app => directory.add(app));
    appInstanceManager = new SailAppInstanceManager(directory, socket)
    authenticatedSocket.appInstanceManager = appInstanceManager
    console.log("SAIL created app instance manager for user:", userId)
  }

  connectionState.appInstanceManager = appInstanceManager
  callback(true)
}

/**
 * Handles directory listing requests to retrieve available applications
 */
function handleDirectoryListing(
  _directoryListingArgs: DesktopAgentDirectoryListingPayload,
  callback: SocketIOCallback<unknown>,
  { socket }: HandlerContext
): void {
  const authenticatedSocket = socket as AuthenticatedSocket
  const userId = authenticatedSocket.userId
  const appInstanceManager = authenticatedSocket.appInstanceManager

  if (!userId || !appInstanceManager) {
    return handleCallbackError(callback, "Authentication required or instance manager not initialized")
  }

  try {
    const directoryAppList = appInstanceManager.directory.allApps
    callback(directoryAppList)
  } catch (error) {
    console.error("Error getting directory for user:", userId, error)
    return handleCallbackError(callback, "Failed to get directory")
  }
}

/**
 * Handles app launch registration requests to prepare app instances
 */
function handleRegisterAppLaunch(
  appLaunchArgs: DesktopAgentRegisterAppLaunchPayload,
  callback: SocketIOCallback<string>,
  { socket }: HandlerContext
): void {
  console.log(`SAIL DA REGISTER APP LAUNCH: ${JSON.stringify(appLaunchArgs)}`)

  const authenticatedSocket = socket as AuthenticatedSocket
  const userId = authenticatedSocket.userId
  const appInstanceManager = authenticatedSocket.appInstanceManager

  if (!userId || !appInstanceManager) {
    return handleCallbackError(callback as SocketIOCallback<unknown>, "Authentication required or instance manager not initialized")
  }

  const { appId, hosting, channel, instanceTitle } = appLaunchArgs
  try {
    const instanceId = `${CONFIG.APP_INSTANCE_PREFIX}${uuid()}`

    const instanceDetails: SailData = {
      instanceId,
      state: State.Pending,
      appId,
      hosting,
      channel,
      instanceTitle,
      channelSockets: [],
    }

    appInstanceManager.setInstanceDetails(instanceId, instanceDetails)
    console.log("SAIL Registered app for user:", userId, "appId:", appId, "instanceId:", instanceId)
    callback(instanceId)
  } catch (error) {
    console.error("SAIL Failed to register app for user:", userId, error)
    handleCallbackError(callback as SocketIOCallback<unknown>, "Failed to register app")
  }
}

/**
 * Updates panel channel assignments and notifies of changes
 */
function updatePanelChannels(serverContext: SailAppInstanceManager, panelList: PanelData[]): void {
  panelList.forEach(({ panelId, tabId: newChannel, title }) => {
    const instanceDetails = serverContext.getInstanceDetails(panelId)
    if (!instanceDetails) return

    const existingChannel = instanceDetails.channel

    const updatedDetails: SailData = {
      ...instanceDetails,
      instanceTitle: title,
    }
    serverContext.setInstanceDetails(panelId, updatedDetails)

    if (newChannel !== existingChannel) {
      serverContext.notifyUserChannelsChanged(panelId, newChannel).catch(error => {
        console.error("Error notifying user channels changed:", error)
      })
    }
  })
}

/**
 * Updates channel data for all connected apps by broadcasting channel updates
 */
async function updateConnectedAppsChannels(
  serverContext: SailAppInstanceManager,
  channelList: TabDetail[]
): Promise<void> {
  const connectedApps = await serverContext.getConnectedApps()

  connectedApps.forEach(app => {
    const instanceDetails = serverContext.getInstanceDetails(app.instanceId)
    if (!instanceDetails) return

    const channelUpdate: any = {
      tabs: channelList,
    }

    instanceDetails.channelSockets.forEach(channelSocket => {
      channelSocket.emit('channelReceiverUpdate', channelUpdate)
    })
  })
}

/**
 * Handles client state updates including directories, channels, and panels
 */
async function handleClientState(
  clientStateArgs: SailClientStatePayload,
  callback: SocketIOCallback<boolean>,
  { socket }: HandlerContext
): Promise<void> {
  console.log(`SAIL CLIENT STATE: ${JSON.stringify(clientStateArgs)}`)

  const authenticatedSocket = socket as AuthenticatedSocket
  const userId = authenticatedSocket.userId

  if (!userId) {
    return handleCallbackError(callback as SocketIOCallback<unknown>, "Authentication required")
  }

  try {
    const appInstanceManager = authenticatedSocket.appInstanceManager

    if (!appInstanceManager) {
      throw new Error(`No app instance manager found for user: ${userId}`)
    }

    await appInstanceManager.reloadAppDirectories(
      clientStateArgs.directories,
      clientStateArgs.customApps
    )
    appInstanceManager.updateChannelData(clientStateArgs.channels)
    updatePanelChannels(appInstanceManager, clientStateArgs.panels as PanelData[])
    await updateConnectedAppsChannels(appInstanceManager, clientStateArgs.channels)

    callback(true)
  } catch (error) {
    console.error("SAIL Client state update failed:", error)
    handleCallbackError(callback as SocketIOCallback<unknown>, "Session not found")
  }
}

/**
 * Routes Sail platform messages to appropriate handlers based on message type
 */
async function routeSailMessage(
  sailMessage: SailMessage,
  callback: SocketIOCallback<any> | undefined,
  context: HandlerContext
): Promise<void> {
  try {
    console.log(`SAIL Message Router: ${sailMessage.type}`, sailMessage)

    switch (sailMessage.type) {
      case 'daHello':
        if (callback) {
          await handleDesktopAgentHello(sailMessage.payload as DesktopAgentHelloPayload, callback as SocketIOCallback<boolean>, context)
        }
        break

      case 'daDirectoryListing':
        if (callback) {
          handleDirectoryListing(sailMessage.payload as DesktopAgentDirectoryListingPayload, callback, context)
        }
        break

      case 'daRegisterAppLaunch':
        if (callback) {
          handleRegisterAppLaunch(sailMessage.payload as DesktopAgentRegisterAppLaunchPayload, callback as SocketIOCallback<string>, context)
        }
        break

      case 'sailClientState':
        if (callback) {
          await handleClientState(sailMessage.payload as SailClientStatePayload, callback as SocketIOCallback<boolean>, context)
        }
        break

      default:
        console.warn('Unknown Sail message type:', sailMessage.type)
        if (callback) {
          callback('Unknown message type', null)
        }
        break
    }
  } catch (error) {
    console.error("Error routing Sail message:", error)
    if (callback) {
      callback(error as string, null)
    }
  }
}

/**
 * Registers layout-related socket handlers, driven by the main UI shell.
 */
export function registerLayoutHandlers(context: HandlerContext): void {
  const { socket } = context

  socket.on(SailMessages.SAIL_EVENT, async (sailMessage: SailMessage, callback?: SocketIOCallback<any>) => {
    await routeSailMessage(sailMessage, callback, context)
  })
}
