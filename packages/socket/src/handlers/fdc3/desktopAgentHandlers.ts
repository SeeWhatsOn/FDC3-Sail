import { Socket } from "socket.io"
import {
  DesktopAgentConnectionArgs,
  DesktopAgentDirectoryListingArgs,
  DesktopAgentRegisterAppLaunchArgs,
  AppHosting,
  DA_HELLO,
  DA_DIRECTORY_LISTING,
  DA_REGISTER_APP_LAUNCH,
} from "@finos/fdc3-sail-common"
import { SailFDC3Server } from "../../model/fdc3/SailFDC3Server"
import { SailDirectory } from "../../model/fdc3/SailDirectory"
import { SailServerContext } from "../../model/fdc3/SailServerContext"
import { ConnectionState } from "../../types"
import { SocketType, getOrAwaitFdc3Server, emitCurrentAppState } from "../utils"
import { State } from "@finos/fdc3-web-impl"
import { v4 as uuid } from "uuid"

function handleDesktopAgentConnect(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(
    DA_HELLO,
    (
      data: DesktopAgentConnectionArgs,
      callback: (success: boolean, err?: string) => void,
    ) => {
      console.log("SAIL DA HELLO handled:" + JSON.stringify(data))

      connectionState.type = SocketType.DESKTOP_AGENT
      connectionState.userSessionId = data.userSessionId
      console.log(
        "SAIL Desktop Agent Connecting",
        connectionState.userSessionId,
      )
      let fdc3Server = connectionState.sessionManager.getSession(
        connectionState.userSessionId,
      )

      if (fdc3Server) {
        // Reconfiguring current session
        console.log(
          `Reconfiguring existing DA session: ${connectionState.userSessionId}`,
        )
        // Update the existing server context with new props rather than creating a new server instance
        // This assumes SailFDC3Server or SailServerContext has methods to update channels/directories
        try {
          // Example: Update context directly if possible
          // fdc3Server.serverContext.updateConfiguration(props);
          // Or, if recreating is the only way:
          console.warn(
            "Recreating SailFDC3Server instance on DA_HELLO reconfig. Ensure context is preserved if needed.",
          )
          const existingContext = fdc3Server.serverContext
          fdc3Server = new SailFDC3Server(existingContext, data)
          existingContext.setFDC3Server(fdc3Server) // Ensure context links back to the new server instance
          connectionState.sessionManager.createSession(
            connectionState.userSessionId,
            fdc3Server,
          )
          console.log(
            "SAIL updated desktop agent channels and directories",
            connectionState.sessionManager.getSessionCount(),
            data.userSessionId,
          )
        } catch (error) {
          console.error(
            `Error reconfiguring DA session ${connectionState.userSessionId}:`,
            error,
          )
          return callback(
            false,
            `Error reconfiguring session: ${(error as Error).message}`,
          )
        }
      } else {
        // Starting new session
        console.log(`Starting new DA session: ${connectionState.userSessionId}`)
        try {
          const serverContext = new SailServerContext(
            new SailDirectory(),
            connectionState.socket,
          )
          fdc3Server = new SailFDC3Server(serverContext, data)
          serverContext.setFDC3Server(fdc3Server)
          connectionState.sessionManager.createSession(
            connectionState.userSessionId,
            fdc3Server,
          )
          console.log(
            "SAIL created agent session. Running sessions:",
            connectionState.sessionManager.getSessionCount(),
            data.userSessionId,
          )
        } catch (error) {
          console.error(
            `Error starting new DA session ${connectionState.userSessionId}:`,
            error,
          )
          return callback(
            false,
            `Error starting session: ${(error as Error).message}`,
          )
        }
      }

      connectionState.fdc3ServerInstance = fdc3Server // Update connection state
      callback(true)
    },
  )
}

export function handleDesktopAgentDirectoryListing(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(
    DA_DIRECTORY_LISTING,
    async (
      data: DesktopAgentDirectoryListingArgs,
      callback: (data: unknown, err?: string) => void,
    ) => {
      console.log(
        `DA_DIRECTORY_LISTING received for session: ${data.userSessionId} on socket ${socket.id}`,
      )
      const userSessionId = data.userSessionId
      try {
        const session = await getOrAwaitFdc3Server(
          connectionState.sessionManager,
          userSessionId,
        )
        callback(session.getAppDirectory().allApps, undefined)
      } catch (error) {
        const errMsg =
          (error as Error).message || "Session not found for Directory Listing"
        console.error(
          `Error in DA_DIRECTORY_LISTING for session ${userSessionId}:`,
          error,
        )
        callback(null, errMsg)
      }
    },
  )
}

export function handleDesktopAgentAppRegistration(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(
    DA_REGISTER_APP_LAUNCH,
    async (
      registrationRequest: DesktopAgentRegisterAppLaunchArgs,
      callback: (instanceId: string | null, errorMessage?: string) => void,
    ) => {
      console.log(
        `DA_REGISTER_APP_LAUNCH received for ${registrationRequest.appId} on socket ${socket.id}`,
      )
      try {
        const { appId, userSessionId } = registrationRequest
        const session = await getOrAwaitFdc3Server(
          connectionState.sessionManager,
          userSessionId,
        )
        const instanceId = "sail-app-" + uuid()
        session.serverContext.setAppInstanceDetails(instanceId, {
          instanceId: instanceId,
          state: State.Pending,
          appId,
          hosting: registrationRequest.hosting ?? AppHosting.Frame,
          channel: registrationRequest.channel ?? null,
          instanceTitle: registrationRequest.instanceTitle ?? appId,
          channelSockets: [],
          // Note: Socket and URL are set during APP_HELLO
        })
        console.log(
          `SAIL Registered app ${appId} with instanceId ${instanceId} for session ${userSessionId}`,
        )

        await emitCurrentAppState(session)
        callback(instanceId, undefined)
      } catch (error) {
        const errMsg =
          (error as Error).message || "Failed to register app launch"
        console.error(
          `Error in DA_REGISTER_APP_LAUNCH for ${registrationRequest.appId}, session ${registrationRequest.userSessionId}:`,
          error,
        )
        callback(null, errMsg)
      }
    },
  )
}

/**
 * Registers event listeners related to Desktop Agent interactions.
 */
export function registerDesktopAgentHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  handleDesktopAgentConnect(socket, connectionState)
  handleDesktopAgentDirectoryListing(socket, connectionState)
  handleDesktopAgentAppRegistration(socket, connectionState)
}
