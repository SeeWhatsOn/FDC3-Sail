import { ConnectionState } from "./types"
import { SocketType, emitCurrentAppState } from "./utils"
import { State } from "@finos/fdc3-web-impl"
import { Socket } from "socket.io"

/**
 * Handles the logic when a socket connection is disconnected.
 *
 * @param state The connection state associated with the disconnected socket.
 * @param reason The reason for disconnection provided by socket.io.
 */
export async function handleDisconnect(
  state: ConnectionState,
  reason: string,
): Promise<void> {
  const { sessions } = state // Destructure sessions for use
  const fdcInstance = state.fdc3ServerInstance
  const connType = state.type
  const connAppInstanceId = state.appInstanceId
  const connUserSessionId = state.userSessionId
  const socketId = state.socket.id

  console.log(
    `[LifecycleHandler] Disconnect: SocketID=${socketId}, Type=${connType}, AppInstance=${connAppInstanceId}, UserSession=${connUserSessionId}, Reason=${reason}`,
  )

  if (fdcInstance) {
    try {
      if (connType === SocketType.APP && connAppInstanceId) {
        console.log(`  App disconnect detected: ${connAppInstanceId}`)
        await fdcInstance.serverContext.updateAppInstanceState(
          connAppInstanceId,
          State.Terminated,
        )
        // Assuming cleanupAppInstance is handled by updateAppInstanceState(Terminated) or not required
        console.log(`  App ${connAppInstanceId} marked as terminated.`)
        await emitCurrentAppState(fdcInstance)
      } else if (connType === SocketType.ELECTRON_APP && connAppInstanceId) {
        console.log(`  Electron App disconnect detected: ${connAppInstanceId}`)
        await fdcInstance.serverContext.updateAppInstanceState(
          connAppInstanceId,
          State.Terminated,
        )
        console.log(`  Electron App ${connAppInstanceId} marked as terminated.`)
        await emitCurrentAppState(fdcInstance)
      } else if (connType === SocketType.CHANNEL && connAppInstanceId) {
        console.log(
          `  Channel Selector disconnect detected for app ${connAppInstanceId} on socket ${socketId}`,
        )
        const details =
          fdcInstance.serverContext.getAppInstanceDetails(connAppInstanceId)
        if (details && details.channelSockets) {
          const initialLength = details.channelSockets.length
          details.channelSockets = details.channelSockets.filter(
            (s) => s.id !== socketId,
          )
          if (details.channelSockets.length < initialLength) {
            fdcInstance.serverContext.setAppInstanceDetails(
              connAppInstanceId,
              details,
            )
            console.log(
              `  Removed channel socket ${socketId} from ${connAppInstanceId}.`,
            )
          }
        } else {
          console.warn(
            `  Channel disconnect for ${connAppInstanceId}, but no details or channelSockets found.`,
          )
        }
      } else if (
        (connType === SocketType.DESKTOP_AGENT ||
          connType === SocketType.ELECTRON_DA) &&
        connUserSessionId
      ) {
        console.log(
          `  DA/ElectronDA for session ${connUserSessionId} on socket ${socketId} disconnected.`,
        )
        // Check if the disconnecting socket is the primary socket for this FDC3 server instance.
        if (
          fdcInstance.serverContext.getDesktopAgentSocket() &&
          fdcInstance.serverContext.getDesktopAgentSocket().id === socketId
        ) {
          console.log(
            `  Disconnecting socket ${socketId} is the primary DA socket for session ${connUserSessionId}. Shutting down session.`,
          )
          fdcInstance.shutdown()
          sessions.delete(connUserSessionId)
          console.log(
            `  Session ${connUserSessionId} shut down and removed from active sessions.`,
          )
        } else if (
          connType === SocketType.ELECTRON_DA &&
          !fdcInstance.serverContext.getDesktopAgentSocket()
        ) {
          // Case where Electron DA connected, maybe set up an FDC instance placeholder,
          // but then it disconnects before DA_HELLO fully established the primary socket link.
          console.warn(
            `  Electron DA Session ${connUserSessionId} disconnecting (socket ${socketId}), but primary socket was not set. Attempting shutdown.`,
          )
          fdcInstance.shutdown() // Attempt shutdown of the instance
          sessions.delete(connUserSessionId) // Remove session if it exists
          console.log(
            `  Electron DA Session ${connUserSessionId} (no primary socket assigned) attempted shutdown and removal.`,
          )
        } else {
          // This socket is DA-typed but not the primary one controlling the session instance.
          console.log(
            `  Socket ${socketId} (DA type) disconnected for session ${connUserSessionId}, but it was not the primary controlling socket. No session shutdown initiated by this disconnect.`,
          )
        }
      } else {
        // Includes cases like SocketType undefined, or types without specific instance IDs needed for cleanup
        console.log(
          `  Disconnect for socket ${socketId} with type ${connType ?? "unknown"}. No specific app/DA action taken based on type/id combination.`,
        )
      }
    } catch (err) {
      console.error(
        `  Error during disconnect handling for socket ${socketId} (Session: ${connUserSessionId}, App: ${connAppInstanceId}):`,
        err,
      )
    }
  } else {
    // No fdc3Instance was associated with this connection state.
    console.log(
      `  No FDC3 server instance associated with disconnecting socket ${socketId} (UserSession: ${connUserSessionId}). Session might have already been cleaned up.`,
    )
    // Check if there's a lingering session entry for a DA that never fully connected
    if (
      (connType === SocketType.DESKTOP_AGENT ||
        connType === SocketType.ELECTRON_DA) &&
      connUserSessionId &&
      sessions.has(connUserSessionId)
    ) {
      console.warn(
        `  Found lingering session ${connUserSessionId} for disconnected DA socket ${socketId} without associated server instance in connectionState. Removing.`,
      )
      sessions.delete(connUserSessionId) // Cleanup potentially orphaned session map entry
    }
  }

  // Final cleanup: remove all listeners added to this specific socket instance
  // Note: This uses the socket reference from the state object passed in.
  state.socket.removeAllListeners()
  console.log(`  Removed all listeners for socket ${socketId}.`)
}

/**
 * Registers event listeners related to socket lifecycle events (e.g., disconnect).
 */
export function registerLifecycleHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on("disconnect", (reason: string) => {
    console.log(
      `[LifecycleHandler Register] Socket ${socket.id} disconnected. Reason: ${reason}`,
    )
    handleDisconnect(connectionState, reason).catch((err: Error) => {
      // Log error during disconnect handling, but typically cannot respond to client
      console.error(
        `Error during disconnect handling for socket ${socket.id}:`,
        err,
      )
    })
  })

  // Add other lifecycle listeners here if needed (e.g., 'connect_error')
}
