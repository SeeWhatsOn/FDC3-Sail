import { SailFDC3Server } from "./desktop-agent/SailFDC3Server" // Adjust import path if necessary
import { SAIL_APP_STATE } from "@finos/fdc3-sail-common" // Import SAIL_APP_STATE
import { AppRegistration } from "@finos/fdc3-web-impl" // Import AppRegistration from its source

export const DEBUG_MODE = true
let _debugReconnectionNumber = 0 // Internal variable

// Function to get and increment the number
export function getIncrementedDebugReconnectionNumber(): number {
  return _debugReconnectionNumber++
}

export function getSailUrl(): string {
  return process.env.SAIL_URL || "http://localhost:8090"
}

export function getFdc3ServerInstance(
  sessions: Map<string, SailFDC3Server>,
  userSessionId: string,
): Promise<SailFDC3Server> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 300 // e.g., 30 seconds with 100ms interval
    const interval = setInterval(() => {
      const fdc3Server = sessions.get(userSessionId)
      if (fdc3Server) {
        clearInterval(interval)
        resolve(fdc3Server)
      } else if (attempts++ > maxAttempts) {
        clearInterval(interval)
        console.error(
          `getFdc3ServerInstance timed out for session ${userSessionId}`,
        )
        reject(new Error(`Session ${userSessionId} not found after timeout.`))
      }
    }, 100) // Check every 100ms
  })
}

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
    const primaryDaSocket = fdc3ServerInstance.serverContext.getPrimarySocket()
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
      await fdc3ServerInstance.serverContext.getAllApps()
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
