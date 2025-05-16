import { SAIL_APP_STATE } from "@finos/fdc3-sail-common"
import { AppRegistration } from "@finos/fdc3-web-impl"
import { SailFDC3Server } from "../model/fdc3/SailFDC3Server"
import { Socket } from "socket.io"

export enum SocketType {
  DESKTOP_AGENT,
  APP,
  CHANNEL,
  ELECTRON_DA, // Added type for Electron DA connection
  ELECTRON_APP, // Added type for Electron App connection
}

/**
 * Safely emit an event to a socket, checking if it's connected first
 */
export function safeEmit(socket: Socket, event: string, data: unknown): void {
  try {
    if (socket && socket.connected) {
      socket.emit(event, data)
    }
  } catch (error) {
    console.error(`Error emitting ${event}:`, error)
  }
}

/**
 * Safely call a socket acknowledgement callback
 */
export function safeAcknowledgement(
  callback: ((data: unknown, error: unknown) => void) | null,
  data: unknown,
  error?: Error | null,
): void {
  if (typeof callback === "function") {
    if (error) {
      callback(null, createErrorResponse(error))
    } else {
      callback(data, null)
    }
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: Error | string,
): Record<string, unknown> {
  if (typeof error === "string") {
    return { error }
  }

  const response: Record<string, unknown> = { error: error.message }

  if (error.stack) {
    response.stack = error.stack
  }

  // Check for other properties like error code
  const errorWithCode = error as Error & { code?: string }
  if (errorWithCode.code) {
    response.code = errorWithCode.code
  }

  return response
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T): T {
  return data
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
