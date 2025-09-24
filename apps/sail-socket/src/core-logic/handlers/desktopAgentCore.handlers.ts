import { v4 as uuid } from "uuid"
import { SailMessages, SailMessage } from "../../protocol/sail-messages"
import {
  DesktopAgentHelloPayload,
  DesktopAgentDirectoryListingPayload,
  DesktopAgentRegisterAppLaunchPayload,
  SailClientStatePayload,
  ChannelReceiverUpdatePayload,
  TabDetail,
} from "../../protocol/sail-messages"
import { State } from "../../types/sail-types"
import { SailAppInstanceManager } from "../sailAppInstanceManager"
import { AppDirectoryManager } from "@finos/fdc3-sail-desktop-agent"
import { SailFDC3Server } from "../SailFDC3Server"
import { SailData } from "../sailAppInstanceManager"
import {
  SocketIOCallback,
  HandlerContext,
  SocketType,
  CONFIG,
  PanelData,
  handleCallbackError,
  AuthenticatedSocket,
} from "./types"

/**
 * Handles Desktop Agent hello messages for session setup and management
 * @param desktopAgentHelloArgs - Desktop agent hello arguments with session configuration
 * @param callback - Socket callback to confirm session creation
 * @param context - Handler context with socket, connection state, and sessions
 */
async function handleDesktopAgentHello(
  desktopAgentHelloArgs: DesktopAgentHelloPayload,
  callback: SocketIOCallback<boolean>,
  { socket, connectionState }: HandlerContext
): Promise<void> {
  console.log(`SAIL DA HELLO: ${JSON.stringify(desktopAgentHelloArgs)}`)

  // Get authenticated userId from socket
  const authenticatedSocket = socket as unknown as AuthenticatedSocket
  const userId = authenticatedSocket.userId

  if (!userId) {
    console.error("No authenticated userId found on socket")
    return callback(false, "Authentication required")
  }

  connectionState.socketType = SocketType.DESKTOP_AGENT
  console.log("SAIL Desktop Agent Connecting for user:", userId)

  let fdc3Server: SailFDC3Server

  if (authenticatedSocket.desktopAgent) {
    // Reconfigure existing desktop agent
    fdc3Server = authenticatedSocket.desktopAgent
    await fdc3Server.loadDirectories(desktopAgentHelloArgs.directories)
    console.log("SAIL updated desktop agent channels and directories for user:", userId)
  } else {
    // Create new desktop agent
    const serverContext = new SailAppInstanceManager(new AppDirectoryManager(), socket)
    fdc3Server = new SailFDC3Server(serverContext, desktopAgentHelloArgs)
    serverContext.setFDC3Server(fdc3Server)
    await fdc3Server.loadDirectories(desktopAgentHelloArgs.directories)

    // Store on socket (Socket.IO session!)
    authenticatedSocket.desktopAgent = fdc3Server
    console.log("SAIL created agent session for user:", userId)
  }

  connectionState.fdc3ServerInstance = fdc3Server
  callback(true)
}

/**
 * Handles directory listing requests to retrieve available applications
 * @param directoryListingArgs - Directory listing arguments with user session ID
 * @param callback - Socket callback to return directory apps or error
 * @param context - Handler context with sessions map
 */
function handleDirectoryListing(
  _directoryListingArgs: DesktopAgentDirectoryListingPayload,
  callback: SocketIOCallback<unknown>,
  { socket }: HandlerContext
): void {
  // Get authenticated socket with desktop agent
  const authenticatedSocket = socket as unknown as AuthenticatedSocket
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

  try {
    const directoryAppList = fdc3Server.getDirectory().allApps
    callback(directoryAppList)
  } catch (error) {
    console.error("Error getting directory for user:", userId, error)
    return handleCallbackError(callback, "Failed to get directory")
  }
}

/**
 * Handles app launch registration requests to prepare app instances
 * @param appLaunchArgs - App launch registration arguments with app and hosting info
 * @param callback - Socket callback to return instance ID or error
 * @param context - Handler context with sessions map
 */
function handleRegisterAppLaunch(
  appLaunchArgs: DesktopAgentRegisterAppLaunchPayload,
  callback: SocketIOCallback<string>,
  { socket }: HandlerContext
): void {
  console.log(`SAIL DA REGISTER APP LAUNCH: ${JSON.stringify(appLaunchArgs)}`)

  // Get authenticated socket with desktop agent
  const authenticatedSocket = socket as unknown as AuthenticatedSocket
  const userId = authenticatedSocket.userId
  const fdc3Server = authenticatedSocket.desktopAgent

  if (!userId) {
    console.error("No authenticated userId found on socket")
    return handleCallbackError(callback as SocketIOCallback<unknown>, "Authentication required")
  }

  if (!fdc3Server) {
    console.error("No desktop agent found for user:", userId)
    return handleCallbackError(
      callback as SocketIOCallback<unknown>,
      "Desktop agent not initialized"
    )
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

    fdc3Server.serverContext.setInstanceDetails(instanceId, instanceDetails)
    console.log("SAIL Registered app for user:", userId, "appId:", appId, "instanceId:", instanceId)
    callback(instanceId)
  } catch (error) {
    console.error("SAIL Failed to register app for user:", userId, error)
    handleCallbackError(callback as SocketIOCallback<unknown>, "Failed to register app")
  }
}

/**
 * Updates panel channel assignments and notifies of changes
 * @param serverContext - Server context for managing instance details
 * @param panelList - List of panels with their channel assignments
 */
function updatePanelChannels(serverContext: SailAppInstanceManager, panelList: PanelData[]): void {
  panelList.forEach(({ panelId, tabId: newChannel, title }) => {
    const instanceDetails = serverContext.getInstanceDetails(panelId)
    if (!instanceDetails) return

    const existingChannel = instanceDetails.channel

    // Update instance title
    const updatedDetails: SailData = {
      ...instanceDetails,
      instanceTitle: title,
    }
    serverContext.setInstanceDetails(panelId, updatedDetails)

    // Notify of channel change if different
    if (newChannel !== existingChannel) {
      serverContext.notifyUserChannelsChanged(panelId, newChannel).catch(error => {
        console.error("Error notifying user channels changed:", error)
      })
    }
  })
}

/**
 * Updates channel data for all connected apps by broadcasting channel updates
 * @param serverContext - Server context for managing app connections
 * @param channelList - List of available channels/tabs
 */
async function updateConnectedAppsChannels(
  serverContext: SailAppInstanceManager,
  channelList: TabDetail[]
): Promise<void> {
  const connectedApps = await serverContext.getConnectedApps()

  connectedApps.forEach(app => {
    const instanceDetails = serverContext.getInstanceDetails(app.instanceId)
    if (!instanceDetails) return

    const channelUpdate: ChannelReceiverUpdate = {
      tabs: channelList,
    }

    instanceDetails.channelSockets.forEach(channelSocket => {
      channelSocket.emit(ChannelMessages.CHANNEL_RECEIVER_UPDATE, channelUpdate)
    })
  })
}

/**
 * Handles client state updates including directories, channels, and panels
 * @param clientStateArgs - Client state arguments with updated configuration
 * @param callback - Socket callback to confirm update success
 * @param context - Handler context with sessions map
 */
async function handleClientState(
  clientStateArgs: SailClientStatePayload,
  callback: SocketIOCallback<boolean>,
  { socket }: HandlerContext
): Promise<void> {
  console.log(`SAIL CLIENT STATE: ${JSON.stringify(clientStateArgs)}`)

  // Get authenticated userId from socket
  const authenticatedSocket = socket as unknown as AuthenticatedSocket
  const userId = authenticatedSocket.userId

  if (!userId) {
    console.error("No authenticated userId found on socket")
    return handleCallbackError(callback as SocketIOCallback<unknown>, "Authentication required")
  }

  try {
    // Get desktop agent from socket
    const fdc3Server = authenticatedSocket.desktopAgent

    if (!fdc3Server) {
      throw new Error(`No desktop agent session found for user: ${userId}`)
    }
    const { serverContext } = fdc3Server

    // Update directories and channels
    await serverContext.reloadAppDirectories(
      clientStateArgs.directories,
      clientStateArgs.customApps
    )
    serverContext.updateChannelData(clientStateArgs.channels)
    // Update panel channels
    updatePanelChannels(serverContext, clientStateArgs.panels as PanelData[])

    // Update channel data for connected apps
    await updateConnectedAppsChannels(serverContext, clientStateArgs.channels)

    callback(true)
  } catch (error) {
    console.error("SAIL Client state update failed:", error)
    handleCallbackError(callback as SocketIOCallback<unknown>, "Session not found")
  }
}

/**
 * Registers desktop agent socket handlers
 */
export function registerDesktopAgentHandlers(context: HandlerContext): void {
  const { socket } = context

  // Register single sail_event handler for all Sail platform messages
  socket.on(SailMessages.SAIL_EVENT, async (sailMessage: SailMessage, callback?: SocketIOCallback<any>) => {
    await routeSailMessage(sailMessage, callback, context)
  })
}

/**
 * Routes Sail platform messages to appropriate handlers based on message type
 * @param sailMessage - The Sail message to route
 * @param callback - Socket callback for responses
 * @param context - Handler context with connection state
 */
async function routeSailMessage(
  sailMessage: SailMessage,
  callback: SocketIOCallback<any> | undefined,
  context: HandlerContext
): Promise<void> {
  try {
    console.log(`SAIL Message Router: ${sailMessage.type}`, sailMessage)

    // Route based on Sail message type
    switch (sailMessage.type) {
      case 'daHello':
        if (callback) {
          await handleDesktopAgentHello(
            sailMessage.payload as DesktopAgentHelloPayload,
            callback as SocketIOCallback<boolean>,
            context
          )
        }
        break

      case 'daDirectoryListing':
        if (callback) {
          handleDirectoryListing(
            sailMessage.payload as DesktopAgentDirectoryListingPayload,
            callback,
            context
          )
        }
        break

      case 'daRegisterAppLaunch':
        if (callback) {
          handleRegisterAppLaunch(
            sailMessage.payload as DesktopAgentRegisterAppLaunchPayload,
            callback as SocketIOCallback<string>,
            context
          )
        }
        break

      case 'sailClientState':
        if (callback) {
          await handleClientState(
            sailMessage.payload as SailClientStatePayload,
            callback as SocketIOCallback<boolean>,
            context
          )
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
