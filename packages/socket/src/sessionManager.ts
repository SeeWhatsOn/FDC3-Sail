// sessionManager.ts
import { SailFDC3Server } from "./model/fdc3/SailFDC3Server"
import { EventEmitter } from "events"

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, SailFDC3Server>()

  createSession(sessionId: string, server: SailFDC3Server): void {
    this.sessions.set(sessionId, server)
    this.emit("session:created", { sessionId, server })
  }

  getSession(sessionId: string): Promise<SailFDC3Server> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId)
      if (session) {
        resolve(session)
        return
      }

      // Check a few times before giving up
      let attempts = 0
      const interval = setInterval(() => {
        const session = this.sessions.get(sessionId)
        if (session) {
          clearInterval(interval)
          resolve(session)
        } else if (++attempts > 30) {
          clearInterval(interval)
          reject(new Error(`Session not found: ${sessionId}`))
        }
      }, 100)
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
  }
}
