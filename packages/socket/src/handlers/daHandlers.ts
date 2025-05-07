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
import { SailFDC3Server } from "./desktop-agent/SailFDC3Server"
import { SailDirectory } from "./desktop-agent/SailDirectory"
import { SailServerContext } from "./desktop-agent/SailServerContext"
import { ConnectionState } from "./types"
import { SocketType, getFdc3ServerInstance, emitCurrentAppState } from "./utils"
import { State } from "@finos/fdc3-web-impl"
import { v4 as uuid } from "uuid"

export async function handleDaHello(
  state: ConnectionState,
  props: DesktopAgentConnectionArgs,
  callback: (success: boolean, err?: string) => void,
): Promise<void> {
  console.log("SAIL DA HELLO handled:" + JSON.stringify(props))

  state.type = SocketType.DESKTOP_AGENT
  state.userSessionId = props.userSessionId
  console.log("SAIL Desktop Agent Connecting", state.userSessionId)
  let fdc3Server = state.sessions.get(state.userSessionId)

  if (fdc3Server) {
    // Reconfiguring current session
    console.log(`Reconfiguring existing DA session: ${state.userSessionId}`)
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
      fdc3Server = new SailFDC3Server(existingContext, props)
      existingContext.setFDC3Server(fdc3Server) // Ensure context links back to the new server instance
      state.sessions.set(state.userSessionId, fdc3Server)
      console.log(
        "SAIL updated desktop agent channels and directories",
        state.sessions.size,
        props.userSessionId,
      )
    } catch (error) {
      console.error(
        `Error reconfiguring DA session ${state.userSessionId}:`,
        error,
      )
      return callback(
        false,
        `Error reconfiguring session: ${(error as Error).message}`,
      )
    }
  } else {
    // Starting new session
    console.log(`Starting new DA session: ${state.userSessionId}`)
    try {
      const serverContext = new SailServerContext(
        new SailDirectory(),
        state.socket,
      )
      fdc3Server = new SailFDC3Server(serverContext, props)
      serverContext.setFDC3Server(fdc3Server)
      state.sessions.set(state.userSessionId, fdc3Server)
      console.log(
        "SAIL created agent session. Running sessions:",
        state.sessions.size,
        props.userSessionId,
      )
    } catch (error) {
      console.error(
        `Error starting new DA session ${state.userSessionId}:`,
        error,
      )
      return callback(
        false,
        `Error starting session: ${(error as Error).message}`,
      )
    }
  }

  state.fdc3ServerInstance = fdc3Server // Update connection state
  callback(true)
}

export async function handleDaDirectoryListing(
  state: ConnectionState,
  props: DesktopAgentDirectoryListingArgs,
  callback: (success: unknown, err?: string) => void,
): Promise<void> {
  console.log(
    `Handling DA_DIRECTORY_LISTING for session: ${props.userSessionId}`,
  )
  const userSessionId = props.userSessionId
  try {
    // Use getFdc3ServerInstance from utils which checks periodically
    const session = await getFdc3ServerInstance(state.sessions, userSessionId)
    callback(session.getDirectory().allApps)
  } catch (error) {
    console.error(
      `Session not found for Directory Listing ${userSessionId}:`,
      error,
    )
    callback(null, (error as Error).message || "Session not found")
  }
}

export async function handleDaRegisterAppLaunch(
  state: ConnectionState,
  props: DesktopAgentRegisterAppLaunchArgs,
  callback: (success: string | null, err?: string) => void, // Correct callback type
): Promise<void> {
  console.log("Handling DA_REGISTER_APP_LAUNCH: " + JSON.stringify(props))

  const { appId, userSessionId } = props
  try {
    const session = await getFdc3ServerInstance(state.sessions, userSessionId)
    const instanceId = "sail-app-" + uuid()
    // Ensure hosting, channel, instanceTitle are handled correctly
    session.serverContext.setInstanceDetails(instanceId, {
      instanceId: instanceId,
      state: State.Pending,
      appId,
      hosting: props.hosting ?? AppHosting.Frame, // Provide default if necessary
      channel: props.channel ?? null, // Provide default if necessary
      instanceTitle: props.instanceTitle ?? appId, // Provide default if necessary
      channelSockets: [],
      // Note: Socket and URL are set during APP_HELLO
    })
    console.log(
      `SAIL Registered app ${appId} with instanceId ${instanceId} for session ${userSessionId}`,
    )
    callback(instanceId)
    // Emit the current app state after successful registration
    await emitCurrentAppState(session)
  } catch (error) {
    console.error(
      `SAIL Session not found for App Launch Registration ${userSessionId}:`,
      error,
    )
    callback(null, (error as Error).message || "Session not found")
  }
}

/**
 * Registers event listeners related to Desktop Agent interactions.
 */
export function registerDaHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  // DA_HELLO Listener
  socket.on(DA_HELLO, (props: DesktopAgentConnectionArgs, callback) => {
    handleDaHello(connectionState, props, callback).catch((err: Error) => {
      console.error(`Error handling DA_HELLO for socket ${socket.id}:`, err)
      callback(false, err.message || "Internal server error during DA_HELLO")
    })
  })

  // DA_DIRECTORY_LISTING Listener
  socket.on(
    DA_DIRECTORY_LISTING,
    (props: DesktopAgentDirectoryListingArgs, callback) => {
      handleDaDirectoryListing(connectionState, props, callback).catch(
        (err: Error) => {
          console.error(
            `Error handling DA_DIRECTORY_LISTING for socket ${socket.id}:`,
            err,
          )
          callback(
            null,
            err.message || "Internal server error during DA_DIRECTORY_LISTING",
          )
        },
      )
    },
  )

  // DA_REGISTER_APP_LAUNCH Listener
  socket.on(
    DA_REGISTER_APP_LAUNCH,
    (props: DesktopAgentRegisterAppLaunchArgs, callback) => {
      handleDaRegisterAppLaunch(connectionState, props, callback).catch(
        (err: Error) => {
          console.error(
            `Error handling DA_REGISTER_APP_LAUNCH for socket ${socket.id}:`,
            err,
          )
          callback(
            null,
            err.message ||
              "Internal server error during DA_REGISTER_APP_LAUNCH",
          )
        },
      )
    },
  )
}
