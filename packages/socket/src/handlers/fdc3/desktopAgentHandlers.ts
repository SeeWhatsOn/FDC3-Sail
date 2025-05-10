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

import { State } from "@finos/fdc3-web-impl"
import { v4 as uuid } from "uuid"
import { handleOperationError } from "../../utils/errorHandling"
import { LogCategory } from "../../utils/logs"
import { logHandlerEvent } from "../../utils/logs"
import {
  SocketType,
  getOrAwaitFdc3Server,
  emitCurrentAppState,
} from "../../utils"

function handleDesktopAgentConnect(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(DA_HELLO, (data: DesktopAgentConnectionArgs, callback) => {
    logHandlerEvent({
      category: LogCategory.DESKTOP_AGENT,
      event: "SAIL DA HELLO handled",
      context: {
        data: data,
      },
    })

    connectionState.type = SocketType.DESKTOP_AGENT
    connectionState.userSessionId = data.userSessionId
    logHandlerEvent({
      category: LogCategory.DESKTOP_AGENT,
      event: "SAIL Desktop Agent Connecting",
      context: {
        sessionId: connectionState.userSessionId,
      },
    })
    let fdc3Server = connectionState.sessionManager.getSession(
      connectionState.userSessionId,
    )

    if (fdc3Server) {
      // Reconfiguring current session
      logHandlerEvent({
        category: LogCategory.DESKTOP_AGENT,
        event: "Reconfiguring existing DA session",
        context: {
          sessionId: connectionState.userSessionId,
        },
      })
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

        logHandlerEvent({
          category: LogCategory.DESKTOP_AGENT,
          event: "SAIL updated desktop agent channels and directories",
          context: {
            sessionId: connectionState.userSessionId,
            connectionState: connectionState.sessionManager.getSessionCount(),
            data: data.userSessionId,
          },
        })
      } catch (error) {
        handleOperationError({
          operation: "DA_HELLO",
          contextData: {
            sessionId: connectionState.userSessionId,
          },
          fallbackMessage: "Failed to reconfigure DA session",
          callback,
          error,
        })
      }
    } else {
      // Starting new session
      logHandlerEvent({
        category: LogCategory.DESKTOP_AGENT,
        event: " new DA session",
        context: {
          sessionId: connectionState.userSessionId,
        },
      })
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
        logHandlerEvent({
          category: LogCategory.DESKTOP_AGENT,
          event: "SAIL created agent session. Running sessions:",
          context: {
            sessionId: connectionState.userSessionId,
            connectionState: connectionState.sessionManager.getSessionCount(),
            data: data.userSessionId,
          },
        })
      } catch (error) {
        handleOperationError({
          operation: "DA_HELLO",
          contextData: {
            sessionId: connectionState.userSessionId,
          },
          fallbackMessage: "Failed to start new DA session",
          callback,
          error,
        })
      }
    }

    connectionState.fdc3ServerInstance = fdc3Server // Update connection state
    callback(true)
  })
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
      logHandlerEvent({
        category: LogCategory.DESKTOP_AGENT,
        event: "DA_DIRECTORY_LISTING",
        context: {
          sessionId: data.userSessionId,
        },
      })
      const userSessionId = data.userSessionId
      try {
        const session = await getOrAwaitFdc3Server(
          connectionState.sessionManager,
          userSessionId,
        )
        callback(session.getAppDirectory().allApps, undefined)
      } catch (error) {
        handleOperationError({
          operation: "DA_DIRECTORY_LISTING",
          contextData: {
            sessionId: userSessionId,
          },
          fallbackMessage:
            "Failed to get directory listing. Session not found.",
          callback,
          error,
        })
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
      logHandlerEvent({
        category: LogCategory.DESKTOP_AGENT,
        event: "DA_REGISTER_APP_LAUNCH",
        subCategory: "pre-register",
        context: {
          appId: registrationRequest.appId,
        },
      })
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

        logHandlerEvent({
          category: LogCategory.CHANNEL,
          event: "DA_REGISTER_APP_LAUNCH",
          subCategory: "registered",
          context: {
            appId: registrationRequest.appId,
          },
        })

        await emitCurrentAppState(session)
        callback(instanceId, undefined)
      } catch (error) {
        handleOperationError({
          operation: "DA_REGISTER_APP_LAUNCH",
          contextData: {
            appId: registrationRequest.appId,
            sessionId: registrationRequest.userSessionId,
          },
          fallbackMessage: "Failed to register app launch",
          callback,
          error,
        })
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
