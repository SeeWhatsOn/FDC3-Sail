// sessionManager.ts
import { SailFDC3Server } from "./model/fdc3/SailFDC3Server"
import { EventEmitter } from "events"

/**
 * SessionManager handles the lifecycle of FDC3 server instances.
 *
 * This class is a central component responsible for tracking and managing FDC3 server
 * instances throughout their lifecycle. Each server instance represents a client session
 * with its own context and communication channel.
 *
 * SessionManager maintains a registry of active sessions and provides methods to create,
 * retrieve, update, and remove sessions. It leverages Node.js EventEmitter to notify
 * interested components about session lifecycle events.
 *
 * Emits events:
 * - 'session:created' - When a new session is created
 * - 'session:updated' - When an existing session is updated
 * - 'session:removed' - When a session is removed
 */
export class SessionManager extends EventEmitter {
  /** Map of active sessions by sessionId */
  private sessions = new Map<string, SailFDC3Server>()
  /** Map to track session creation operations to prevent race conditions */
  private sessionCreationLocks = new Map<string, Promise<void>>()

  /**
   * Creates a new session with the given ID
   * If there are any pending requests waiting for this session,
   * they will be resolved with the new server instance.
   *
   * This is typically called when a new client connects and establishes a session.
   * The session is stored in the internal registry and an event is emitted to notify subscribers.
   * This method is thread-safe and prevents race conditions during concurrent session creation.
   *
   * @param sessionId - Unique identifier for the session
   * @param server - The FDC3 server instance
   */
  async createSession(sessionId: string, server: SailFDC3Server): Promise<void> {
    // Check if session creation is already in progress
    if (this.sessionCreationLocks.has(sessionId)) {
      await this.sessionCreationLocks.get(sessionId)
      return
    }

    if (this.sessions.has(sessionId)) {
      console.log(`Session already exists: ${sessionId}`)
      return
    }

    // Create lock for this session creation
    const creationPromise = this.doCreateSession(sessionId, server)
    this.sessionCreationLocks.set(sessionId, creationPromise)
    
    try {
      await creationPromise
    } finally {
      this.sessionCreationLocks.delete(sessionId)
    }
  }

  /**
   * Internal method to perform the actual session creation
   * @private
   */
  private async doCreateSession(sessionId: string, server: SailFDC3Server): Promise<void> {
    console.log(`Creating session: ${sessionId}`)
    this.sessions.set(sessionId, server)
    this.emit("session:created", { sessionId, server })
  }

  /**
   * Gets a session by ID
   *
   * This method retrieves an existing session, or rejects if the requested session doesn't exist.
   * Used by request handlers to obtain the appropriate server instance for a client request.
   *
   * @param sessionId - ID of the session to retrieve
   * @returns Promise that resolves to the server instance or rejects if session not found
   */
  getSession(sessionId: string): Promise<SailFDC3Server> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId)
      if (session) {
        resolve(session)
        return
      }
      // No matching session found
      reject(new Error(`Session not found: ${sessionId}`))
    })
  }

  /**
   * Updates an existing session with a new server instance
   * Emits a 'session:updated' event if the session exists
   *
   * This is useful when a session's capabilities or configuration changes during its lifetime.
   *
   * @param sessionId - ID of the session to update
   * @param server - New server instance
   */
  updateSession(sessionId: string, server: SailFDC3Server): void {
    if (this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, server)
      this.emit("session:updated", { sessionId, server })
    } else {
      console.warn(`Session not found: ${sessionId}`)
    }
    // Silently ignores update requests for non-existent sessions
  }

  /**
   * Removes a session by ID
   * Emits a 'session:removed' event if the session exists
   *
   * This is typically called when a client disconnects or a session times out.
   * The session is removed from the internal registry and an event is emitted.
   *
   * @param sessionId - ID of the session to remove
   */
  removeSession(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId)
      if (session) {
        this.sessions.delete(sessionId)
        this.emit("session:removed", { sessionId, server: session })
        resolve()
      } else {
        reject(new Error(`Session not found: ${sessionId}`))
      }
    })
  }

  /**
   * Gets all active sessions
   *
   * Returns a copy of the sessions map to prevent external code from modifying
   * the internal registry directly.
   *
   * @returns A new Map with all current sessions
   */
  getAllSessions(): Map<string, SailFDC3Server> {
    return new Map(this.sessions)
  }

  /**
   * Shuts down all active sessions and clears pending requests
   *
   * This method is part of the graceful shutdown process for the application.
   * It ensures that all FDC3 server instances are properly terminated and resources are released.
   *
   * @returns Promise that resolves when all sessions are shut down
   */
  async shutdownAllSessions(): Promise<void> {
    const promises: Promise<void>[] = []

    // Shut down each session and collect the promises
    this.sessions.forEach((server, sessionId) => {
      console.log(`Shutting down FDC3 session: ${sessionId}`)
      promises.push(Promise.resolve(server.shutdown()))
    })

    // Wait for all sessions to shut down
    await Promise.all(promises)

    // Clear the sessions map
    this.sessions.clear()
  }
}
