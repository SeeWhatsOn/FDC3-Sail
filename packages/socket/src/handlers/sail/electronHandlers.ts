import {
  ElectronHelloArgs,
  ElectronAppResponse,
  ElectronDAResponse,
  AppHosting as SailAppHosting,
  SailHostManifest,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "../../types"
import { v4 as uuid } from "uuid"
import { State as Fdc3State, WebAppDetails } from "@finos/fdc3-web-impl"
import { Socket } from "socket.io"
import { ELECTRON_HELLO } from "@finos/fdc3-sail-common"
import { LogCategory } from "../../utils/logs"
import { logHandlerEvent } from "../../utils/logs"
import { handleOperationError } from "../../utils/errorHandling"
import { SocketType, getServerUrl } from "../../utils"

/**
 * Registers event listeners related to Electron interactions.
 */
export async function registerElectronHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): Promise<void> {
  try {
    socket.on(
      ELECTRON_HELLO,
      async (
        data: ElectronHelloArgs,
        callback: (
          success: ElectronAppResponse | ElectronDAResponse | null,
          err?: string,
        ) => void,
      ) => {
        logHandlerEvent({
          category: LogCategory.ELECTRON,
          event: `Received ELECTRON_HELLO from ${data.url} for session ${data.userSessionId}`,
          context: { url: data.url, userSessionId: data.userSessionId },
        })
        try {
          logHandlerEvent({
            category: LogCategory.ELECTRON,
            event: `Electron Hello: URL=${data.url}, SessionID=${data.userSessionId}, SocketID=${connectionState.socket.id}`,
            context: {
              url: data.url,
              userSessionId: data.userSessionId,
              socketId: connectionState.socket.id,
            },
          })
          const fdc3Server = await connectionState.sessionManager.getSession(
            data.userSessionId,
          )

          if (fdc3Server) {
            connectionState.userSessionId = data.userSessionId // Ensure session ID is on the connection state
            connectionState.fdc3ServerInstance = fdc3Server // Associate existing server instance

            const allApps = fdc3Server
              .getAppDirectory()
              .retrieveAppsByUrl(data.url)
            if (allApps.length > 0) {
              const app = allApps[0]
              const instanceId = "sail-electron-app-" + uuid()
              connectionState.type = SocketType.ELECTRON_APP
              connectionState.appInstanceId = instanceId

              const appDetails = app.details as WebAppDetails
              const sailManifest = app.hostManifests?.sail as
                | SailHostManifest
                | undefined

              // Optional: Pre-register the app instance in the server context
              // This ensures the server is aware of the instance before it might send further messages.
              // Adjust payload as needed for a pending Electron app.
              fdc3Server.serverContext.setInstanceDetails(instanceId, {
                instanceId: instanceId,
                appId: app.appId,
                state: Fdc3State.Pending,
                hosting: sailManifest?.forceNewWindow
                  ? SailAppHosting.Tab
                  : SailAppHosting.Frame,
                channel: null, // Default channel
                instanceTitle:
                  app.title || app.name || `Electron App ${instanceId}`,
                channelSockets: [],
                url: appDetails.url,
                socket: connectionState.socket, // Associate this socket
              })

              logHandlerEvent({
                category: LogCategory.ELECTRON,
                event: `Electron App: ${app.appId} (URL: ${appDetails.url}), new instanceId: ${instanceId}. State set to Pending.`,
                context: { appId: app.appId, url: appDetails.url, instanceId },
              })

              callback({
                type: "app",
                userSessionId: connectionState.userSessionId,
                appId: app.appId,
                instanceId,
                intentResolver: null,
                channelSelector: null,
              })
            } else {
              console.warn(
                `  Electron connection for existing session ${data.userSessionId}, but no app found for URL: ${data.url}`,
              )
              callback(null, "App not found for URL in existing session.")
            }
          } else if (data.url === getServerUrl()) {
            connectionState.userSessionId = data.userSessionId
            connectionState.type = SocketType.ELECTRON_DA
            logHandlerEvent({
              category: LogCategory.ELECTRON,
              event: `Electron DA: URL matches SAIL_URL. Session: ${data.userSessionId}. Waiting for DA_HELLO.`,
              context: { userSessionId: data.userSessionId },
            })
            // DA_HELLO handler is responsible for creating and setting the SailFDC3Server instance in state.sessions
            // and then on state.fdc3ServerInstance.
            callback({ type: "da" })
          } else {
            throw new Error(
              "Session not found and URL is not for a new Desktop Agent.",
            )
          }
        } catch (err) {
          handleOperationError({
            operation: "ELECTRON_HELLO",
            contextData: { userSessionId: data.userSessionId, url: data.url },
            fallbackMessage: "Internal server error handling ELECTRON_HELLO",
            callback,
            error: err,
          })
        }
      },
    )
  } catch (error) {
    console.error("Error registering electron handlers:", error)
    throw error
  }
}
