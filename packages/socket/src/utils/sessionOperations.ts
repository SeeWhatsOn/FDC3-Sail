import { SailFDC3Server } from "../model/fdc3/SailFDC3Server"
import { SessionManager } from "../sessionManager"
import { handleOperationError } from "./errorHandling"

/**
 * Configuration for executing an operation that requires a FDC3 server session
 */
export interface Fdc3SessionOptions<T> {
  /** Description of the operation being performed */
  operation: string
  /** The session manager instance */
  sessionManager: SessionManager
  /** The session ID to retrieve */
  userSessionId: string
  /** Callback function to invoke with results or error */
  callback: (result: T | null, error?: string) => void
  /** The action to perform with the retrieved session */
  action: (session: SailFDC3Server) => Promise<T>
}

/**
 * Executes an operation that requires a valid FDC3 server session
 * with standardized error handling
 */
export async function withFdc3Session<T>(
  options: Fdc3SessionOptions<T>,
): Promise<void> {
  const { operation, sessionManager, userSessionId, callback, action } = options

  try {
    const session = await sessionManager.getSession(userSessionId)
    const result = await action(session)
    callback(result)
  } catch (error) {
    handleOperationError({
      operation,
      contextData: { sessionId: userSessionId },
      fallbackMessage: `Session not found or operation failed for ${operation}`,
      callback,
      error,
    })
  }
}
