// packages/socket/__tests__/sessionManager.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
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

  describe("Session Creation and Retrieval", () => {
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

    it("should prevent duplicate session creation", () => {
      sessionManager.createSession(sessionId, mockServer)
      
      // Creating duplicate should be ignored (early return)
      const emitSpy = vi.spyOn(sessionManager, "emit")
      sessionManager.createSession(sessionId, mockServer)
      
      // Should NOT emit event for duplicate (returns early)
      expect(emitSpy).not.toHaveBeenCalled()
    })

    it("should handle session creation with null server", () => {
      expect(() => {
        sessionManager.createSession(sessionId, null as any)
      }).not.toThrow()
    })
  })

  describe("Session Management", () => {
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
      expect(mockServer.shutdown).toHaveBeenCalled()
    })

    it("should not remove a non-existent session", async () => {
      await expect(
        sessionManager.removeSession("non-existent"),
      ).rejects.toThrow("Session not found: non-existent")
    })

    it("should not update a non-existent session", () => {
      const emitSpy = vi.spyOn(sessionManager, "emit")

      sessionManager.updateSession("non-existent", mockServer)

      expect(emitSpy).not.toHaveBeenCalled()
    })
  })

  describe("Multiple Sessions", () => {
    const secondSessionId = "another-session"
    let secondMockServer: SailFDC3Server

    beforeEach(() => {
      secondMockServer = {
        shutdown: vi.fn().mockResolvedValue(undefined),
      } as unknown as SailFDC3Server

      sessionManager.createSession(sessionId, mockServer)
      sessionManager.createSession(secondSessionId, secondMockServer)
    })

    it("should get all sessions", () => {
      const allSessions = sessionManager.getAllSessions()

      expect(allSessions.size).toBe(2)
      expect(allSessions.get(sessionId)).toBe(mockServer)
      expect(allSessions.get(secondSessionId)).toBe(secondMockServer)
    })

    it("should shut down all sessions", async () => {
      await sessionManager.shutdownAllSessions()

      expect(mockServer.shutdown).toHaveBeenCalled()
      expect(secondMockServer.shutdown).toHaveBeenCalled()
      expect(sessionManager.getAllSessions().size).toBe(0)
    })

    it("should handle partial shutdown failures", async () => {
      // Make one server fail shutdown
      vi.mocked(mockServer.shutdown).mockRejectedValueOnce(new Error("Shutdown failed"))

      await expect(sessionManager.shutdownAllSessions()).rejects.toThrow("Shutdown failed")

      expect(mockServer.shutdown).toHaveBeenCalled()
      expect(secondMockServer.shutdown).toHaveBeenCalled()
    })

    it("should emit events for multiple session operations", () => {
      const emitSpy = vi.spyOn(sessionManager, "emit")

      sessionManager.updateSession(sessionId, mockServer)
      sessionManager.updateSession(secondSessionId, secondMockServer)

      expect(emitSpy).toHaveBeenCalledTimes(2)
      expect(emitSpy).toHaveBeenCalledWith("session:updated", {
        sessionId,
        server: mockServer,
      })
      expect(emitSpy).toHaveBeenCalledWith("session:updated", {
        sessionId: secondSessionId,
        server: secondMockServer,
      })
    })
  })

  describe("Event Emission", () => {
    it("should emit session lifecycle events", () => {
      const emitSpy = vi.spyOn(sessionManager, "emit")

      // Create
      sessionManager.createSession(sessionId, mockServer)
      expect(emitSpy).toHaveBeenCalledWith("session:created", {
        sessionId,
        server: mockServer,
      })

      // Update
      sessionManager.updateSession(sessionId, mockServer)
      expect(emitSpy).toHaveBeenCalledWith("session:updated", {
        sessionId,
        server: mockServer,
      })

      expect(emitSpy).toHaveBeenCalledTimes(2)
    })

    it("should allow event listeners", () => {
      const createListener = vi.fn()
      const updateListener = vi.fn()
      const removeListener = vi.fn()

      sessionManager.on("session:created", createListener)
      sessionManager.on("session:updated", updateListener)
      sessionManager.on("session:removed", removeListener)

      sessionManager.createSession(sessionId, mockServer)
      sessionManager.updateSession(sessionId, mockServer)

      expect(createListener).toHaveBeenCalledWith({
        sessionId,
        server: mockServer,
      })
      expect(updateListener).toHaveBeenCalledWith({
        sessionId,
        server: mockServer,
      })
    })
  })

  describe("Concurrent Operations", () => {
    it("should handle concurrent session creation", () => {
      const session1Id = "concurrent-1"
      const session2Id = "concurrent-2"

      // Should not interfere with each other
      sessionManager.createSession(session1Id, mockServer)
      sessionManager.createSession(session2Id, mockServer)

      expect(sessionManager.getAllSessions().size).toBe(2)
    })

    it("should handle concurrent get operations", async () => {
      sessionManager.createSession(sessionId, mockServer)

      const [result1, result2] = await Promise.all([
        sessionManager.getSession(sessionId),
        sessionManager.getSession(sessionId),
      ])

      expect(result1).toBe(mockServer)
      expect(result2).toBe(mockServer)
    })
  })

  describe("Error Handling", () => {
    it("should handle invalid session IDs gracefully", async () => {
      await expect(sessionManager.getSession("")).rejects.toThrow()
      await expect(sessionManager.getSession(null as any)).rejects.toThrow()
      await expect(sessionManager.getSession(undefined as any)).rejects.toThrow()
    })

    it("should handle server shutdown errors", async () => {
      const failingServer = {
        shutdown: vi.fn().mockRejectedValue(new Error("Server shutdown error")),
      } as unknown as SailFDC3Server

      sessionManager.createSession(sessionId, failingServer)

      // Should not throw, but handle error gracefully
      await expect(sessionManager.removeSession(sessionId)).resolves.toBeUndefined()
    })
  })
})
