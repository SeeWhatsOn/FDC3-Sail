import { SailFDC3Server } from "../model/fdc3/SailFDC3Server"
import { SessionManager } from "../sessionManager"

export function getServerUrl(): string {
  return process.env.SAIL_URL || "http://localhost:8090"
}

export async function getOrAwaitFdc3Server(
  sessionManager: SessionManager,
  userSessionId: string,
): Promise<SailFDC3Server> {
  try {
    return await sessionManager.getSession(userSessionId)
  } catch (error) {
    console.error(`Failed to get session ${userSessionId}:`, error)
    throw error
  }
}
