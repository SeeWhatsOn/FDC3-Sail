import { SAIL_APP_STATE } from "@finos/fdc3-sail-common"
import { AppRegistration } from "@finos/fdc3-web-impl"
import { SailFDC3Server } from "../model/fdc3/SailFDC3Server"

export enum SocketType {
  DESKTOP_AGENT,
  APP,
  CHANNEL,
  ELECTRON_DA, // Added type for Electron DA connection
  ELECTRON_APP, // Added type for Electron App connection
}

/**
 * Fetches the current app state for a session and emits it to the primary DA socket.
 * Should be called after any action that potentially changes the state of any app instance.
 *
 * @param fdc3ServerInstance The FDC3 server instance for the session.
 */
export async function emitCurrentAppState(
  fdc3ServerInstance: SailFDC3Server | undefined,
): Promise<void> {
  if (!fdc3ServerInstance) {
    console.warn(
      "[emitCurrentAppState] Called with undefined fdc3ServerInstance.",
    )
    return
  }

  try {
    const primaryDaSocket =
      fdc3ServerInstance.serverContext.getDesktopAgentSocket()
    if (!primaryDaSocket || !primaryDaSocket.connected) {
      console.log(
        `[emitCurrentAppState] No connected primary DA socket found for session, skipping state emit.`,
      )
      return
    }

    console.log(
      `[emitCurrentAppState] Fetching state for session via DA socket ${primaryDaSocket.id}`,
    )
    const allApps: AppRegistration[] =
      await fdc3ServerInstance.serverContext.getAllAppInstances()
    console.log(
      `[emitCurrentAppState] Emitting SAIL_APP_STATE with ${allApps.length} apps to DA socket ${primaryDaSocket.id}.`,
    )
    primaryDaSocket.emit(SAIL_APP_STATE, allApps)
  } catch (error) {
    console.error(
      "[emitCurrentAppState] Error fetching or emitting app state:",
      error,
    )
  }
}
