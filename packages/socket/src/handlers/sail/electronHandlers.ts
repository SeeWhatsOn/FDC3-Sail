import {
  ElectronHelloArgs,
  ElectronAppResponse,
  ElectronDAResponse,
  AppHosting as SailAppHosting,
  SailHostManifest,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "./types"
import { SocketType, getSailUrl } from "./utils"
import { v4 as uuid } from "uuid"
import { State as Fdc3State, WebAppDetails } from "@finos/fdc3-web-impl"
import { Socket } from "socket.io"
import { ELECTRON_HELLO } from "@finos/fdc3-sail-common"

export async function handleElectronConnection(
  state: ConnectionState,
  electronConnectionArgs: ElectronHelloArgs,
  callback: (
    success: ElectronAppResponse | ElectronDAResponse | null,
    err?: string,
  ) => void,
): Promise<void> {
  console.log(
    `[ElectronHandler] Electron Hello: URL=${electronConnectionArgs.url}, SessionID=${electronConnectionArgs.userSessionId}, SocketID=${state.socket.id}`,
  )
  const fdc3Server = state.sessions.get(electronConnectionArgs.userSessionId)

  if (fdc3Server) {
    state.userSessionId = electronConnectionArgs.userSessionId // Ensure session ID is on the connection state
    state.fdc3ServerInstance = fdc3Server // Associate existing server instance

    const allApps = fdc3Server
      .getAppDirectory()
      .retrieveAppsByUrl(electronConnectionArgs.url)
    if (allApps.length > 0) {
      const app = allApps[0]
      const instanceId = "sail-electron-app-" + uuid()
      state.type = SocketType.ELECTRON_APP
      state.appInstanceId = instanceId

      const appDetails = app.details as WebAppDetails
      const sailManifest = app.hostManifests?.sail as
        | SailHostManifest
        | undefined

      // Optional: Pre-register the app instance in the server context
      // This ensures the server is aware of the instance before it might send further messages.
      // Adjust payload as needed for a pending Electron app.
      fdc3Server.serverContext.setAppInstanceDetails(instanceId, {
        instanceId: instanceId,
        appId: app.appId,
        state: Fdc3State.Pending,
        hosting: sailManifest?.forceNewWindow
          ? SailAppHosting.Tab
          : SailAppHosting.Frame,
        channel: null, // Default channel
        instanceTitle: app.title || app.name || `Electron App ${instanceId}`,
        channelSockets: [],
        url: appDetails.url,
        socket: state.socket, // Associate this socket
      })

      console.log(
        `  Electron App: ${app.appId} (URL: ${appDetails.url}), new instanceId: ${instanceId}. State set to Pending.`,
      )
      callback({
        type: "app",
        userSessionId: state.userSessionId,
        appId: app.appId,
        instanceId,
        intentResolver: null,
        channelSelector: null,
      })
    } else {
      console.warn(
        `  Electron connection for existing session ${electronConnectionArgs.userSessionId}, but no app found for URL: ${electronConnectionArgs.url}`,
      )
      callback(null, "App not found for URL in existing session.")
    }
  } else if (electronConnectionArgs.url === getSailUrl()) {
    state.userSessionId = electronConnectionArgs.userSessionId
    state.type = SocketType.ELECTRON_DA
    console.log(
      `  Electron DA: URL matches SAIL_URL. Session: ${electronConnectionArgs.userSessionId}. Waiting for DA_HELLO.`,
    )
    // DA_HELLO handler is responsible for creating and setting the SailFDC3Server instance in state.sessions
    // and then on state.fdc3ServerInstance.
    callback({ type: "da" })
  } else {
    console.error(
      `  Electron Hello: No session ${electronConnectionArgs.userSessionId} & URL ${electronConnectionArgs.url} doesn't match SAIL_URL.`,
    )
    callback(null, "Session not found and URL is not for a new Desktop Agent.")
  }
}

/**
 * Registers event listeners related to Electron interactions.
 */
export function registerElectronHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(ELECTRON_HELLO, (props: ElectronHelloArgs, callback) => {
    console.log(
      `[ElectronHandler Register] Received ELECTRON_HELLO from ${props.url} for session ${props.userSessionId}`,
    )
    handleElectronConnection(connectionState, props, callback).catch((err) => {
      console.error(
        `Error in ELECTRON_HELLO handler for socket ${socket.id}:`,
        err,
      )
      callback(null, "Internal server error handling ELECTRON_HELLO")
    })
  })
}
