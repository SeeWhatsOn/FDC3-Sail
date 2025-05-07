import {
  AppHelloArgs,
  AppHosting,
  SailHostManifest,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "../../types"
import { SailFDC3Server } from "../../model/fdc3/SailFDC3Server"
import {
  SocketType,
  DEBUG_MODE,
  getOrAwaitFdc3Server,
  getNextDebugReconnectionId,
  emitCurrentAppState,
} from "../utils"
import {
  State,
  WebAppDetails,
  AppRegistration,
  DirectoryApp,
} from "@finos/fdc3-web-impl"
import { Socket } from "socket.io"
import { APP_HELLO } from "@finos/fdc3-sail-common"
import { SailData } from "../../model/fdc3/SailServerContext"

// Helper function for valid pending connections
/**
 * Handles connection requests for applications that are already known to the server
 * and are in a 'Pending' state, waiting for the actual socket connection.
 */
function handleValidPendingConnection(
  appInstance: SailData,
  directoryItems: DirectoryApp[],
  fdc3Server: SailFDC3Server,
  connectionState: ConnectionState,
): AppHosting | null {
  appInstance.socket = connectionState.socket // Assign the socket
  // Ensure URL is set if available from directory
  if (directoryItems.length > 0) {
    const directoryItemDetails = directoryItems[0]?.details
    if (
      directoryItemDetails &&
      typeof (directoryItemDetails as WebAppDetails).url === "string"
    ) {
      appInstance.url = (directoryItemDetails as WebAppDetails).url
    }
  }
  connectionState.fdc3ServerInstance = fdc3Server // Associate server instance with this socket connection
  // Update state to Connected
  appInstance.state = State.Connected
  fdc3Server.serverContext.setAppInstanceDetails(
    connectionState.appInstanceId!,
    appInstance,
  )
  console.log(
    `SAIL App ${appInstance.appId} (${connectionState.appInstanceId}) connected successfully and set to Connected.`,
  )
  return appInstance.hosting
}

// Helper function for debug mode connections
/**
 * Handles connection requests when DEBUG_MODE is enabled.
 * This allows applications defined in the directory to connect even if they were not pre-registered
 * or if their instance state is not 'Pending'. A new instance registration is created.
 */
function handleDebugModeConnection(
  helloArgs: AppHelloArgs,
  directoryItems: DirectoryApp[],
  fdc3Server: SailFDC3Server,
  connectionState: ConnectionState,
): AppHosting | null {
  console.warn(
    `SAIL App ${helloArgs.appId} (${connectionState.appInstanceId!}) connecting with invalid/missing instance registration (DEBUG_MODE). Creating new registration.`,
  )

  const directoryItem = directoryItems[0]
  const sailManifestRaw = directoryItem?.hostManifests?.sail
  let sailHostManifest: SailHostManifest | undefined = undefined

  if (typeof sailManifestRaw === "object" && sailManifestRaw !== null) {
    const manifestAsRecord = sailManifestRaw as Record<string, unknown>
    if (
      "forceNewWindow" in manifestAsRecord &&
      typeof manifestAsRecord.forceNewWindow === "boolean"
    ) {
      sailHostManifest = manifestAsRecord as unknown as SailHostManifest
    } else {
      console.warn(
        `SAIL host manifest for ${helloArgs.appId} is an object but lacks 'forceNewWindow' or has incorrect type:`,
        sailManifestRaw,
      )
    }
  } else if (typeof sailManifestRaw === "string") {
    console.warn(
      `SAIL host manifest for ${helloArgs.appId} is a string, which is not supported for 'forceNewWindow' logic. Manifest: ${sailManifestRaw}`,
    )
  }

  const currentDebugNumber = getNextDebugReconnectionId()

  const debugDirectoryItemDetails = directoryItem.details
  let debugAppUrl: string | undefined = undefined
  if (
    debugDirectoryItemDetails &&
    typeof (debugDirectoryItemDetails as WebAppDetails).url === "string"
  ) {
    debugAppUrl = (debugDirectoryItemDetails as WebAppDetails).url
  } else if (debugDirectoryItemDetails) {
    console.warn(
      `DEBUG_MODE: Directory item ${directoryItem.appId} details incomplete or type is not WebAppDetails, cannot determine URL.`,
    )
  }

  const instanceDetails: SailData = {
    appId: helloArgs.appId,
    instanceId: connectionState.appInstanceId!,
    state: State.Connected,
    ...(undefined as AppRegistration | undefined),
    socket: connectionState.socket,
    url: debugAppUrl,
    hosting: sailHostManifest?.forceNewWindow
      ? AppHosting.Tab
      : AppHosting.Frame,
    channel: null,
    instanceTitle: `${directoryItem.title} - RECOVERED ${currentDebugNumber}`,
    channelSockets: [],
  }

  fdc3Server.serverContext.setAppInstanceDetails(
    connectionState.appInstanceId!,
    instanceDetails,
  )
  connectionState.fdc3ServerInstance = fdc3Server // Associate server instance
  console.log(
    `SAIL App ${helloArgs.appId} (${connectionState.appInstanceId!}) connected in DEBUG_MODE.`,
  )
  return instanceDetails.hosting
}

function handleApplicationConnect(
  connectionState: ConnectionState,
  socket: Socket,
): void {
  socket.on(
    APP_HELLO,
    async (
      helloArgs: AppHelloArgs,
      callback: (success: AppHosting | null, err?: string) => void,
    ) => {
      try {
        console.log("Handling APP_HELLO: " + JSON.stringify(helloArgs))

        connectionState.appInstanceId = helloArgs.instanceId
        connectionState.userSessionId = helloArgs.userSessionId
        connectionState.type = SocketType.APP

        const fdc3Server = await getOrAwaitFdc3Server(
          connectionState.sessions,
          connectionState.userSessionId,
        )

        console.log(
          `SAIL App attempting connection: AppID=${helloArgs.appId}, InstanceID=${connectionState.appInstanceId!}, SessionID=${connectionState.userSessionId!}`,
        )
        const appInstance = fdc3Server
          .getServerContext()
          .getAppInstanceDetails(connectionState.appInstanceId!) as SailData // Cast here for type safety
        const directoryItems = fdc3Server
          .getServerContext()
          .directory.retrieveAppsById(helloArgs.appId)

        let appHostingToReturn: AppHosting | null = null

        if (appInstance && appInstance.state === State.Pending) {
          appHostingToReturn = handleValidPendingConnection(
            appInstance,
            directoryItems,
            fdc3Server,
            connectionState,
          )
        } else if (DEBUG_MODE && directoryItems.length > 0) {
          appHostingToReturn = handleDebugModeConnection(
            helloArgs,
            directoryItems,
            fdc3Server,
            connectionState,
          )
        } else {
          // Reject connection: Instance ID not found, not pending, or app definition missing
          const reason = !appInstance
            ? "Instance ID not found or not pre-registered."
            : appInstance.state !== State.Pending
              ? `Instance state is ${appInstance.state}, expected Pending.`
              : "App definition not found in directory."
          console.error(
            `SAIL App ${helloArgs.appId} (${connectionState.appInstanceId!}) connection rejected: ${reason}`,
          )
          return callback(null, `Connection rejected: ${reason}`)
        }

        // If we reached here, connection was successful one way or another
        await emitCurrentAppState(fdc3Server)
        callback(appHostingToReturn)
      } catch (error) {
        // Error finding DA session or other unexpected error
        console.error(
          `SAIL App ${helloArgs.appId} (${connectionState.appInstanceId!}) connection failed: ${(error as Error).message}`,
          error,
        )
        callback(null, (error as Error).message || "Failed to connect app.")
      }
    },
  )
}

/**
 * Registers event listeners related to App interactions.
 */
export function registerAppHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  handleApplicationConnect(connectionState, socket)
  // TODO: Register listener for FDC3_APP_EVENT if moving processAppMessage registration here later
  // socket.on(FDC3_APP_EVENT, (data: any, from: string) => { ... });
}
