// packages/socket/__tests__/sessionManager.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { SessionManager } from "../src/sessionManager"
import { SailFDC3Server } from "../src/model/fdc3/SailFDC3Server"

// Mock SailFDC3Server
vi.mock("../src/model/fdc3/SailFDC3Server", () => {
  return {
    SailFDC3Server: vi.fn().mockImplementation(() => ({
      shutdown: vi.fn().mockResolvedValue(undefined),
    })),
  }
})

describe("SessionManager", () => {
  let sessionManager: SessionManager
  const mockServer = {
    shutdown: vi.fn().mockResolvedValue(undefined),
  } as unknown as SailFDC3Server
  const sessionId = "test-session-id"

  beforeEach(() => {
    vi.useFakeTimers()
    sessionManager = new SessionManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("should create a new session", () => {
    const emitSpy = vi.spyOn(sessionManager, "emit")

    sessionManager.createSession(sessionId, mockServer)

    expect(emitSpy).toHaveBeenCalledWith("session:created", {
      sessionId,
      server: mockServer,
    })
  })

  it("should retrieve an existing session", async () => {
    sessionManager.createSession(sessionId, mockServer)

    const result = await sessionManager.getSession(sessionId)

    expect(result).toBe(mockServer)
  })

  it("should wait for a session to be created", async () => {
    // Start a get request that will wait for the session
    const sessionPromise = sessionManager.getSession(sessionId)

    // Create the session after a short delay
    setTimeout(() => {
      sessionManager.createSession(sessionId, mockServer)
    }, 100)

    vi.advanceTimersByTime(200)

    const result = await sessionPromise
    expect(result).toBe(mockServer)
  })

  it("should time out when waiting for a non-existent session", async () => {
    const SESSION_WAIT_TIMEOUT = 3000 // This should match the value in sessionManager.ts

    const sessionPromise = sessionManager.getSession("non-existent-session")

    // Advance time past the timeout
    vi.advanceTimersByTime(SESSION_WAIT_TIMEOUT + 100)

    await expect(sessionPromise).rejects.toThrow("Session not found after")
  })

  it("should update an existing session", () => {
    sessionManager.createSession(sessionId, mockServer)

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

  it("should not update a non-existent session", () => {
    const emitSpy = vi.spyOn(sessionManager, "emit")

    sessionManager.updateSession("non-existent", mockServer)

    expect(emitSpy).not.toHaveBeenCalled()
  })

  it("should remove an existing session", () => {
    sessionManager.createSession(sessionId, mockServer)
    const emitSpy = vi.spyOn(sessionManager, "emit")

    sessionManager.removeSession(sessionId)

    expect(emitSpy).toHaveBeenCalledWith("session:removed", {
      sessionId,
      server: mockServer,
    })
  })

  it("should reject pending session requests when a session is removed", async () => {
    // Start a get request that will wait for the session
    const sessionPromise = sessionManager.getSession(sessionId)

    // Remove the session before it's created
    setTimeout(() => {
      sessionManager.removeSession(sessionId)
    }, 100)

    vi.advanceTimersByTime(200)

    await expect(sessionPromise).rejects.toThrow(
      "Session removed while awaiting",
    )
  })

  it("should get all sessions", () => {
    sessionManager.createSession(sessionId, mockServer)
    sessionManager.createSession("another-session", mockServer)

    const allSessions = sessionManager.getAllSessions()

    expect(allSessions.size).toBe(2)
    expect(allSessions.get(sessionId)).toBe(mockServer)
    expect(allSessions.get("another-session")).toBe(mockServer)
  })

  it("should shut down all sessions", async () => {
    sessionManager.createSession(sessionId, mockServer)
    sessionManager.createSession("another-session", mockServer)

    await sessionManager.shutdownAllSessions()

    // Should have called shutdown on both servers
    expect(mockServer.shutdown).toHaveBeenCalledTimes(2)

    // Should clear all sessions
    expect(sessionManager.getAllSessions().size).toBe(0)
  })

  it("should resolve multiple waiters when a session is created", async () => {
    // Create multiple promises waiting for the same session
    const promise1 = sessionManager.getSession(sessionId)
    const promise2 = sessionManager.getSession(sessionId)
    const promise3 = sessionManager.getSession(sessionId)

    // Create the session
    sessionManager.createSession(sessionId, mockServer)

    // All promises should resolve to the same server
    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ])
    expect(result1).toBe(mockServer)
    expect(result2).toBe(mockServer)
    expect(result3).toBe(mockServer)
  })

  it("should reject all waiters when shutdownAllSessions is called", async () => {
    // Create a promise waiting for a session
    const sessionPromise = sessionManager.getSession("will-never-exist")

    // Shut down all sessions
    setTimeout(() => {
      sessionManager.shutdownAllSessions()
    }, 100)

    vi.advanceTimersByTime(200)

    // The promise should be rejected
    await expect(sessionPromise).rejects.toThrow("All sessions shut down")
  })
})
