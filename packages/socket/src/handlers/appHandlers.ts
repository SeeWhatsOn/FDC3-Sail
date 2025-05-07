import {
  AppHelloArgs,
  AppHosting,
  SailHostManifest,
} from "@finos/fdc3-sail-common"
import { SailData } from "./desktop-agent/SailServerContext"
import { ConnectionState } from "./types"
import {
  SocketType,
  DEBUG_MODE,
  getFdc3ServerInstance,
  getIncrementedDebugReconnectionNumber,
  emitCurrentAppState,
} from "./utils"
import { State, WebAppDetails } from "@finos/fdc3-web-impl"
import { Socket } from "socket.io"
import { APP_HELLO } from "@finos/fdc3-sail-common"

// Import and manage debugReconnectionNumber if needed within this file or pass via state
// import { debugReconnectionNumber as globalDebugReconnectionNumber } from "./utils"

export async function handleAppHello(
  state: ConnectionState,
  props: AppHelloArgs,
  callback: (success: AppHosting | null, err?: string) => void, // Correct callback type
): Promise<void> {
  console.log("Handling APP_HELLO: " + JSON.stringify(props))

  state.appInstanceId = props.instanceId
  state.userSessionId = props.userSessionId
  state.type = SocketType.APP

  try {
    const fdc3Server = await getFdc3ServerInstance(
      state.sessions,
      state.userSessionId,
    )

    console.log(
      `SAIL App attempting connection: AppID=${props.appId}, InstanceID=${state.appInstanceId}, SessionID=${state.userSessionId}`,
    )
    const appInstance = fdc3Server
      .getServerContext()
      .getInstanceDetails(state.appInstanceId)
    const directoryItems = fdc3Server
      .getServerContext()
      .directory.retrieveAppsById(props.appId)

    let appHostingToReturn: AppHosting | null = null

    if (appInstance && appInstance.state === State.Pending) {
      // Valid connection for a pre-registered app
      appInstance.socket = state.socket // Assign the socket
      // Ensure URL is set if available from directory
      if (directoryItems.length > 0) {
        appInstance.url = (directoryItems[0].details as WebAppDetails)?.url
      }
      state.fdc3ServerInstance = fdc3Server // Associate server instance with this socket connection
      // Update state to Connected
      appInstance.state = State.Connected
      fdc3Server.serverContext.setInstanceDetails(
        state.appInstanceId,
        appInstance,
      )
      console.log(
        `SAIL App ${props.appId} (${state.appInstanceId}) connected successfully and set to Connected.`,
      )
      appHostingToReturn = appInstance.hosting
    } else if (DEBUG_MODE && directoryItems.length > 0) {
      // Debug mode: Allow connection even if not pre-registered or state mismatch
      console.warn(
        `SAIL App ${props.appId} (${state.appInstanceId}) connecting with invalid/missing instance registration (DEBUG_MODE). Creating new registration.`,
      )

      const directoryItem = directoryItems[0]
      const shm: SailHostManifest | undefined = directoryItem?.hostManifests
        ?.sail as any

      // Use local variable for incrementing debug number
      let currentDebugNumber = getIncrementedDebugReconnectionNumber()

      const instanceDetails: SailData = {
        appId: props.appId,
        instanceId: state.appInstanceId,
        state: State.Connected, // Use State.Connected
        socket: state.socket,
        url: (directoryItem.details as WebAppDetails)?.url,
        hosting: shm?.forceNewWindow ? AppHosting.Tab : AppHosting.Frame, // Reverted to Tab
        channel: null, // App starts on no channel unless specified otherwise
        instanceTitle: `${directoryItem.title} - RECOVERED ${currentDebugNumber}`,
        channelSockets: [],
      }

      fdc3Server.serverContext.setInstanceDetails(
        state.appInstanceId,
        instanceDetails,
      )
      state.fdc3ServerInstance = fdc3Server // Associate server instance
      console.log(
        `SAIL App ${props.appId} (${state.appInstanceId}) connected in DEBUG_MODE.`,
      )
      appHostingToReturn = instanceDetails.hosting
    } else {
      // Reject connection: Instance ID not found, not pending, or app definition missing
      const reason = !appInstance
        ? "Instance ID not found or not pre-registered."
        : appInstance.state !== State.Pending
          ? `Instance state is ${appInstance.state}, expected Pending.`
          : "App definition not found in directory."
      console.error(
        `SAIL App ${props.appId} (${state.appInstanceId}) connection rejected: ${reason}`,
      )
      return callback(null, `Connection rejected: ${reason}`)
    }

    // If we reached here, connection was successful one way or another
    await emitCurrentAppState(fdc3Server)
    callback(appHostingToReturn)
  } catch (error) {
    // Error finding DA session or other unexpected error
    console.error(
      `SAIL App ${props.appId} (${state.appInstanceId}) connection failed: ${(error as Error).message}`,
      error,
    )
    callback(null, (error as Error).message || "Failed to connect app.")
  }
}

/**
 * Registers event listeners related to App interactions.
 */
export function registerAppHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(APP_HELLO, (props: AppHelloArgs, callback) => {
    handleAppHello(connectionState, props, callback).catch((err: Error) => {
      console.error(`Error handling APP_HELLO for socket ${socket.id}:`, err)
      callback(null, err.message || "Internal server error during APP_HELLO")
    })
  })

  // TODO: Register listener for FDC3_APP_EVENT if moving handleFdc3AppEvent registration here later
  // socket.on(FDC3_APP_EVENT, (data: any, from: string) => { ... });
}

// Placeholder for handleFdc3AppEvent if you move it here later
// export function handleFdc3AppEvent(state: ConnectionState, data: any, from: string): void { ... }
