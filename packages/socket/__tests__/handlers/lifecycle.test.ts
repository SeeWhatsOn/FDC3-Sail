// packages/socket/__tests__/handlers/lifecycleHandlers.test.ts
import { describe, it, expect, vi, beforeEach, Mock } from "vitest"
import { Socket } from "socket.io"
import { ConnectionState } from "../../src/types"
import { SessionManager } from "../../src/sessionManager"
import { registerLifecycleHandlers } from "../../src/handlers/lifecycleHandlers"

// Mock external dependencies
vi.mock("../../src/utils/socketUtils", () => ({
  safeAcknowledgement: vi.fn((callback, data, error) => {
    if (callback) callback(data, error)
  }),
  safeEmit: vi.fn(),
  createErrorResponse: vi.fn((err) => ({ error: err.message || err })),
  createSuccessResponse: vi.fn((data) => data),
}))

describe("Lifecycle Handlers", () => {
  let socket: Socket & { on: Mock }
  let sessionManager: SessionManager
  let connectionState: ConnectionState

  beforeEach(() => {
    socket = {
      id: "socket-id",
      on: vi.fn(),
      emit: vi.fn(),
      connected: true,
      disconnect: vi.fn(),
    } as unknown as Socket & { on: Mock }

    sessionManager = new SessionManager()
    vi.spyOn(sessionManager, "getSession").mockImplementation(async () => {
      return {
        shutdown: vi.fn().mockResolvedValue(undefined),
      } as any
    })

    connectionState = {
      socket,
      sessionManager,
      userSessionId: "test-session-id",
    }
  })

  it("should register all lifecycle handlers", () => {
    registerLifecycleHandlers(socket, connectionState)

    // Verify the socket.on has been called for lifecycle events
    expect(socket.on).toHaveBeenCalledWith("disconnect", expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith("heartbeat", expect.any(Function))
  })

  it("should handle disconnect event", () => {
    const removeSessionSpy = vi.spyOn(sessionManager, "removeSession")

    // Register handlers
    registerLifecycleHandlers(socket, connectionState)

    // Get the disconnect handler
    const disconnectCall = socket.on.mock.calls.find(
      (call) => call[0] === "disconnect",
    )
    const disconnectHandler = disconnectCall ? disconnectCall[1] : null
    expect(disconnectHandler).not.toBeNull()

    // Call the disconnect handler with 'client namespace disconnect'
    disconnectHandler("client namespace disconnect")

    // Verify session is not removed on temporary disconnect
    expect(removeSessionSpy).not.toHaveBeenCalled()

    // Call the disconnect handler with 'transport close'
    disconnectHandler("transport close")

    // Verify session is removed on permanent disconnect
    expect(removeSessionSpy).toHaveBeenCalledWith("test-session-id")
  })

  it("should handle heartbeat event", () => {
    // Register handlers
    registerLifecycleHandlers(socket, connectionState)

    // Get the heartbeat handler
    const heartbeatCall = socket.on.mock.calls.find(
      (call) => call[0] === "heartbeat",
    )
    const heartbeatHandler = heartbeatCall ? heartbeatCall[1] : null
    expect(heartbeatHandler).not.toBeNull()

    // Mock callback
    const callback = vi.fn()

    // Call the heartbeat handler
    heartbeatHandler({}, callback)

    // Verify callback is called with success
    expect(callback).toHaveBeenCalledWith(true, null)
  })
})
