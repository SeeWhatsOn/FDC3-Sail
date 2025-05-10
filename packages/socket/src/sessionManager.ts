// sessionManager.ts
import { SailFDC3Server } from "./model/fdc3/SailFDC3Server"
import { EventEmitter } from "events"

const SESSION_WAIT_TIMEOUT = 3000 // 3 seconds

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, SailFDC3Server>()
  private pendingRequests = new Map<
    string,
    {
      waiters: Array<{
        resolve: (value: SailFDC3Server) => void
        reject: (reason?: Error) => void
      }>
      timeoutId?: NodeJS.Timeout
    }
  >()

  createSession(sessionId: string, server: SailFDC3Server): void {
    this.sessions.set(sessionId, server)
    this.emit("session:created", { sessionId, server })

    const pendingEntry = this.pendingRequests.get(sessionId)
    if (pendingEntry) {
      if (pendingEntry.timeoutId) {
        clearTimeout(pendingEntry.timeoutId)
      }
      pendingEntry.waiters.forEach(({ resolve }) => resolve(server))
      this.pendingRequests.delete(sessionId)
    }
  }

  getSession(sessionId: string): Promise<SailFDC3Server> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId)
      if (session) {
        resolve(session)
        return
      }

      const pendingEntry = this.pendingRequests.get(sessionId)
      if (pendingEntry) {
        pendingEntry.waiters.push({ resolve, reject })
      } else {
        const waiters = [{ resolve, reject }]
        const timeoutId = setTimeout(() => {
          const currentPendingEntry = this.pendingRequests.get(sessionId)
          if (
            currentPendingEntry &&
            currentPendingEntry.timeoutId === timeoutId
          ) {
            // Ensure it's the same timeout
            const error = new Error(
              `Session not found after ${SESSION_WAIT_TIMEOUT}ms: ${sessionId}`,
            )
            currentPendingEntry.waiters.forEach(({ reject: rej }) => rej(error))
            this.pendingRequests.delete(sessionId)
          }
        }, SESSION_WAIT_TIMEOUT)

        this.pendingRequests.set(sessionId, { waiters, timeoutId })
      }
    })
  }

  updateSession(sessionId: string, server: SailFDC3Server): void {
    if (this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, server)
      this.emit("session:updated", { sessionId, server })
    }
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      this.sessions.delete(sessionId)
      this.emit("session:removed", { sessionId, server: session })

      const pendingEntry = this.pendingRequests.get(sessionId)
      if (pendingEntry) {
        if (pendingEntry.timeoutId) {
          clearTimeout(pendingEntry.timeoutId)
        }
        const error = new Error(`Session removed while awaiting: ${sessionId}`)
        pendingEntry.waiters.forEach(({ reject: rej }) => rej(error))
        this.pendingRequests.delete(sessionId)
      }
    }
  }

  getAllSessions(): Map<string, SailFDC3Server> {
    return new Map(this.sessions)
  }

  async shutdownAllSessions(): Promise<void> {
    const promises: Promise<void>[] = []
    this.sessions.forEach((server, sessionId) => {
      console.log(`Shutting down FDC3 session: ${sessionId}`)
      promises.push(Promise.resolve(server.shutdown()))
    })
    await Promise.all(promises)
    this.sessions.clear()

    this.pendingRequests.forEach((entry, sessionId) => {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId)
      }
      const error = new Error(
        `All sessions shut down; session never found: ${sessionId}`,
      )
      entry.waiters.forEach(({ reject: rej }) => rej(error))
    })
    this.pendingRequests.clear()
  }
}
