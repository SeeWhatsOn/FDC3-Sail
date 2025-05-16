// packages/socket/__tests__/sessionManager.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { SessionManager } from "../src/sessionManager"
import { SailFDC3Server } from "../src/model/fdc3/SailFDC3Server"

describe("SessionManager", () => {
  let sessionManager: SessionManager
  const mockServer = {
    shutdown: vi.fn().mockResolvedValue(undefined),
  } as unknown as SailFDC3Server
  const sessionId = "test-session-id"

  beforeEach(() => {
    sessionManager = new SessionManager()
    vi.clearAllMocks()
  })

  describe("basic operations", () => {
    it("should create a new session", () => {
      const emitSpy = vi.spyOn(sessionManager, "emit")
      sessionManager.createSession(sessionId, mockServer)
      expect(emitSpy).toHaveBeenCalledWith("session:created", {
        sessionId,
        server: mockServer,
      })
    })

    it("should throw if a session is not found", async () => {
      await expect(sessionManager.getSession("non-existent")).rejects.toThrow(
        "Session not found: non-existent",
      )
    })
  })

  describe("with existing session", () => {
    beforeEach(() => {
      sessionManager.createSession(sessionId, mockServer)
    })

    it("should retrieve an existing session", async () => {
      const result = await sessionManager.getSession(sessionId)
      expect(result).toBe(mockServer)
    })

    it("should update an existing session", () => {
      const updatedServer = {
        ...mockServer,
        newProperty: true,
      } as unknown as SailFDC3Server
      const emitSpy = vi.spyOn(sessionManager, "emit")

      sessionManager.updateSession(sessionId, updatedServer)

      expect(emitSpy).toHaveBeenCalledWith("session:updated", {
        sessionId,
        server: updatedServer,
      })
    })

    it("should remove an existing session", async () => {
      const emitSpy = vi.spyOn(sessionManager, "emit")

      await sessionManager.removeSession(sessionId)

      expect(emitSpy).toHaveBeenCalledWith("session:removed", {
        sessionId,
        server: mockServer,
      })
    })

    it("should not remove a non-existent session", async () => {
      await expect(
        sessionManager.removeSession("non-existent"),
      ).rejects.toThrow("Session not found: non-existent")
    })
  })

  describe("multiple sessions", () => {
    beforeEach(() => {
      sessionManager.createSession(sessionId, mockServer)
      sessionManager.createSession("another-session", mockServer)
    })

    it("should get all sessions", () => {
      const allSessions = sessionManager.getAllSessions()

      expect(allSessions.size).toBe(2)
      expect(allSessions.get(sessionId)).toBe(mockServer)
      expect(allSessions.get("another-session")).toBe(mockServer)
    })

    it("should shut down all sessions", async () => {
      await sessionManager.shutdownAllSessions()

      expect(mockServer.shutdown).toHaveBeenCalledTimes(2)
      expect(sessionManager.getAllSessions().size).toBe(0)
    })

    it("should not update a non-existent session", () => {
      const emitSpy = vi.spyOn(sessionManager, "emit")

      sessionManager.updateSession("non-existent", mockServer)

      expect(emitSpy).not.toHaveBeenCalled()
    })
  })
})
