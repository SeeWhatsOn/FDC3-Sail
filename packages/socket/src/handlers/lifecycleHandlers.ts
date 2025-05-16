import { ConnectionState } from "../types"
import { SocketType, emitCurrentAppState } from "../utils"
import { LogCategory } from "../utils/logs"
import { logHandlerEvent } from "../utils/logs"
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
  const { sessionManager } = state // Destructure sessions for use
  const fdcInstance = state.fdc3ServerInstance
  const connType = state.type
  const connAppInstanceId = state.appInstanceId
  const connUserSessionId = state.userSessionId
  const socketId = state.socket.id

  logHandlerEvent({
    category: LogCategory.LIFECYCLE,
    event: `Disconnect: SocketID=${socketId}, Type=${connType}, AppInstance=${connAppInstanceId}, UserSession=${connUserSessionId}, Reason=${reason}`,
    context: {
      socketId,
      connType,
      connAppInstanceId,
      connUserSessionId,
      reason,
    },
  })

  if (fdcInstance) {
    try {
      if (connType === SocketType.APP && connAppInstanceId) {
        logHandlerEvent({
          category: LogCategory.LIFECYCLE,
          event: `App disconnect detected: ${connAppInstanceId}`,
          context: { connAppInstanceId },
        })
        await fdcInstance.serverContext.updateAppInstanceState(
          connAppInstanceId,
          State.Terminated,
        )
        // Assuming cleanupAppInstance is handled by updateAppInstanceState(Terminated) or not required
        logHandlerEvent({
          category: LogCategory.LIFECYCLE,
          event: `App ${connAppInstanceId} marked as terminated.`,
          context: { connAppInstanceId },
        })
        await emitCurrentAppState(fdcInstance)
      } else if (connType === SocketType.ELECTRON_APP && connAppInstanceId) {
        logHandlerEvent({
          category: LogCategory.LIFECYCLE,
          event: `Electron App disconnect detected: ${connAppInstanceId}`,
          context: { connAppInstanceId },
        })
        await fdcInstance.serverContext.updateAppInstanceState(
          connAppInstanceId,
          State.Terminated,
        )
        logHandlerEvent({
          category: LogCategory.LIFECYCLE,
          event: `Electron App ${connAppInstanceId} marked as terminated.`,
          context: { connAppInstanceId },
        })
        await emitCurrentAppState(fdcInstance)
      } else if (connType === SocketType.CHANNEL && connAppInstanceId) {
        logHandlerEvent({
          category: LogCategory.LIFECYCLE,
          event: `Channel Selector disconnect detected for app ${connAppInstanceId} on socket ${socketId}`,
          context: { connAppInstanceId, socketId },
        })
        const details =
          fdcInstance.serverContext.getAppInstanceDetails(connAppInstanceId)
        if (details && details.channelSockets) {
          const initialLength = details.channelSockets.length
          details.channelSockets = details.channelSockets.filter(
            (socket: Socket) => socket.id !== socketId,
          )
          if (details.channelSockets.length < initialLength) {
            fdcInstance.serverContext.setAppInstanceDetails(
              connAppInstanceId,
              details,
            )
            logHandlerEvent({
              category: LogCategory.LIFECYCLE,
              event: `Removed channel socket ${socketId} from ${connAppInstanceId}.`,
              context: { connAppInstanceId, socketId },
            })
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
        logHandlerEvent({
          category: LogCategory.LIFECYCLE,
          event: `DA/ElectronDA for session ${connUserSessionId} on socket ${socketId} disconnected.`,
          context: { connUserSessionId, socketId },
        })
        // Check if the disconnecting socket is the primary socket for this FDC3 server instance.
        if (
          fdcInstance.serverContext.getDesktopAgentSocket() &&
          fdcInstance.serverContext.getDesktopAgentSocket().id === socketId
        ) {
          logHandlerEvent({
            category: LogCategory.LIFECYCLE,
            event: `Disconnecting socket ${socketId} is the primary DA socket for session ${connUserSessionId}. Shutting down session.`,
            context: { connUserSessionId, socketId },
          })
          fdcInstance.shutdown()
          await sessionManager.removeSession(connUserSessionId)
          logHandlerEvent({
            category: LogCategory.LIFECYCLE,
            event: `Session ${connUserSessionId} shut down and removed from active sessions.`,
            context: { connUserSessionId },
          })
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
          await sessionManager.removeSession(connUserSessionId) // Remove session if it exists
          logHandlerEvent({
            category: LogCategory.LIFECYCLE,
            event: `Electron DA Session ${connUserSessionId} (no primary socket assigned) attempted shutdown and removal.`,
            context: { connUserSessionId },
          })
        } else {
          // This socket is DA-typed but not the primary one controlling the session instance.
          logHandlerEvent({
            category: LogCategory.LIFECYCLE,
            event: `Socket ${socketId} (DA type) disconnected for session ${connUserSessionId}, but it was not the primary controlling socket. No session shutdown initiated by this disconnect.`,
            context: { connUserSessionId },
          })
        }
      } else {
        // Includes cases like SocketType undefined, or types without specific instance IDs needed for cleanup
        logHandlerEvent({
          category: LogCategory.LIFECYCLE,
          event: `Disconnect for socket ${socketId} with type ${connType ?? "unknown"}. No specific app/DA action taken based on type/id combination.`,
          context: { socketId, connType },
        })
      }
    } catch (err) {
      console.error(
        `  Error during disconnect handling for socket ${socketId} (Session: ${connUserSessionId}, App: ${connAppInstanceId}):`,
        err,
      )
    }
  } else {
    // No fdc3Instance was associated with this connection state.
    logHandlerEvent({
      category: LogCategory.LIFECYCLE,
      event: `No FDC3 server instance associated with disconnecting socket ${socketId} (UserSession: ${connUserSessionId}). Session might have already been cleaned up.`,
      context: { socketId, connUserSessionId },
    })
    // Check if there's a lingering session entry for a DA that never fully connected
    if (
      (connType === SocketType.DESKTOP_AGENT ||
        connType === SocketType.ELECTRON_DA) &&
      connUserSessionId &&
      (await sessionManager.getSession(connUserSessionId))
    ) {
      console.warn(
        `  Found lingering session ${connUserSessionId} for disconnected DA socket ${socketId} without associated server instance in connectionState. Removing.`,
      )
      await sessionManager.removeSession(connUserSessionId) // Cleanup potentially orphaned session map entry
    }
  }

  // Final cleanup: remove all listeners added to this specific socket instance
  // Note: This uses the socket reference from the state object passed in.
  state.socket.removeAllListeners()
  logHandlerEvent({
    category: LogCategory.LIFECYCLE,
    event: `Removed all listeners for socket ${socketId}.`,
    context: { socketId },
  })
}

/**
 * Registers event listeners related to socket lifecycle events (e.g., disconnect).
 */
export async function registerLifecycleHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): Promise<void> {
  try {
    socket.on("disconnect", (reason: string) => {
      logHandlerEvent({
        category: LogCategory.LIFECYCLE,
        event: `[LifecycleHandler Register] Socket ${socket.id} disconnected. Reason: ${reason}`,
        context: { socketId: socket.id, reason },
        subCategory: "Register",
      })
      handleDisconnect(connectionState, reason).catch((err: Error) => {
        // Log error during disconnect handling, but typically cannot respond to client
        console.error(
          `Error during disconnect handling for socket ${socket.id}:`,
          err,
        )
      })
    })
  } catch (error) {
    console.error("Error registering lifecycle handlers:", error)
    throw error
  }
}
