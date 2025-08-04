import { SailFDC3Server } from "../model/fdc3/SailFDC3Server"
import { SessionManager } from "../sessionManager"

// Cache for pending session requests to prevent duplicate calls
const pendingSessionRequests = new Map<string, Promise<SailFDC3Server>>()

export function getServerUrl(): string {
  return process.env.SAIL_URL || "http://localhost:8090"
}

/**
 * Helper function to get an FDC3 server instance for a given session
 * Implements caching to prevent duplicate concurrent requests for the same session
 * @param sessionManager - The session manager instance
 * @param userSessionId - The user session ID
 * @returns Promise that resolves to the FDC3 server instance
 */
export async function getOrAwaitFdc3Server(
  sessionManager: SessionManager,
  userSessionId: string,
): Promise<SailFDC3Server> {
  // Check if request is already pending to avoid duplicate calls
  const existingRequest = pendingSessionRequests.get(userSessionId)
  if (existingRequest) {
    return existingRequest
  }

  const sessionPromise = sessionManager.getSession(userSessionId)
  pendingSessionRequests.set(userSessionId, sessionPromise)
  
  try {
    const session = await sessionPromise
    return session
  } catch (error) {
    console.error(`Failed to get session ${userSessionId}:`, error)
    throw error
  } finally {
    // Clean up the pending request whether successful or not
    pendingSessionRequests.delete(userSessionId)
  }
}

/**
 * Clears any pending session requests for cleanup purposes
 * This is mainly for testing or shutdown scenarios
 */
export function clearPendingSessionRequests(): void {
  pendingSessionRequests.clear()
}
