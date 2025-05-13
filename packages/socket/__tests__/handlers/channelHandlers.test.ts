// packages/socket/__tests__/handlers/fdc3/channelHandlers.test.ts
import { describe, it, expect, vi, beforeEach, Mock } from "vitest"
import { Socket } from "socket.io"
import { ConnectionState } from "../../src/types"
import { SessionManager } from "../../src/sessionManager"
import { registerChannelHandlers } from "../../src/handlers/fdc3/channelHandlers"
import { SailFDC3Server } from "../../src/model/fdc3/SailFDC3Server"

// Interface for the mock FDC3 server that includes only the methods used in tests
interface MockFDC3Server {
  getChannels: Mock
  getCurrentChannel: Mock
  setCurrentChannel: Mock
  leaveCurrentChannel: Mock
  broadcast: Mock
  addContextListener: Mock
  findInstances: Mock
}

// Mock external dependencies
vi.mock("../../src/utils/socketUtils", () => ({
  safeAcknowledgement: vi.fn((callback, data, error) => {
    if (callback) callback(data, error)
  }),
  safeEmit: vi.fn(),
  createErrorResponse: vi.fn((err) => ({ error: err.message || err })),
  createSuccessResponse: vi.fn((data) => data),
}))

describe("Channel Handlers", () => {
  let socket: Socket & { on: Mock; emit: Mock }
  let sessionManager: SessionManager
  let connectionState: ConnectionState
  let mockFdc3Server: MockFDC3Server & SailFDC3Server

  beforeEach(() => {
    socket = {
      id: "socket-id",
      on: vi.fn(),
      emit: vi.fn(),
      connected: true,
    } as unknown as Socket & { on: Mock; emit: Mock }

    // Create a mock that correctly matches the FDC3 interface
    mockFdc3Server = {
      getChannels: vi.fn().mockReturnValue({
        system: [
          { id: "system", type: "system", displayMetadata: { name: "System" } },
        ],
        user: [
          { id: "user1", type: "user", displayMetadata: { name: "User 1" } },
        ],
      }),
      getCurrentChannel: vi.fn().mockReturnValue(null),
      setCurrentChannel: vi.fn().mockResolvedValue(true),
      leaveCurrentChannel: vi.fn().mockResolvedValue(true),
      broadcast: vi.fn().mockResolvedValue(true),
      addContextListener: vi.fn(),
      findInstances: vi.fn(),
    } as unknown as MockFDC3Server & SailFDC3Server

    sessionManager = new SessionManager()
    vi.spyOn(sessionManager, "getSession").mockResolvedValue(mockFdc3Server)

    connectionState = {
      socket,
      sessionManager,
      userSessionId: "test-session-id",
      fdc3ServerInstance: mockFdc3Server,
    }
  })

  it("should register all channel handlers", () => {
    registerChannelHandlers(socket, connectionState)

    // Verify the socket.on has been called for channel events
    expect(socket.on).toHaveBeenCalledWith(
      "fdc3.joinChannel",
      expect.any(Function),
    )
    expect(socket.on).toHaveBeenCalledWith(
      "fdc3.getCurrentChannel",
      expect.any(Function),
    )
    expect(socket.on).toHaveBeenCalledWith(
      "fdc3.leaveCurrentChannel",
      expect.any(Function),
    )
    expect(socket.on).toHaveBeenCalledWith(
      "fdc3.broadcast",
      expect.any(Function),
    )
    expect(socket.on).toHaveBeenCalledWith(
      "fdc3.getSystemChannels",
      expect.any(Function),
    )
    expect(socket.on).toHaveBeenCalledWith(
      "fdc3.getUserChannels",
      expect.any(Function),
    )
  })

  it("should handle getSystemChannels request", async () => {
    // Register handlers
    registerChannelHandlers(socket, connectionState)

    // Get the getSystemChannels handler
    const getSystemChannelsHandler = socket.on.mock.calls.find(
      (call) => call[0] === "fdc3.getSystemChannels",
    )?.[1]

    // Mock callback
    const callback = vi.fn()

    // Call the handler
    await getSystemChannelsHandler(
      { userSessionId: "test-session-id" },
      callback,
    )

    // Verify the handler called the server method
    expect(mockFdc3Server.getChannels).toHaveBeenCalled()

    // Verify callback received the channels
    expect(callback).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "system" })]),
      null,
    )
  })

  it("should handle getUserChannels request", async () => {
    // Register handlers
    registerChannelHandlers(socket, connectionState)

    // Get the getUserChannels handler
    const getUserChannelsHandler = socket.on.mock.calls.find(
      (call) => call[0] === "fdc3.getUserChannels",
    )?.[1]

    // Mock callback
    const callback = vi.fn()

    // Call the handler
    await getUserChannelsHandler({ userSessionId: "test-session-id" }, callback)

    // Verify the handler called the server method
    expect(mockFdc3Server.getChannels).toHaveBeenCalled()

    // Verify callback received the channels
    expect(callback).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "user1" })]),
      null,
    )
  })

  it("should handle joinChannel request", async () => {
    // Register handlers
    registerChannelHandlers(socket, connectionState)

    // Get the joinChannel handler
    const joinChannelHandler = socket.on.mock.calls.find(
      (call) => call[0] === "fdc3.joinChannel",
    )?.[1]

    // Mock callback
    const callback = vi.fn()

    // Call the handler
    await joinChannelHandler(
      {
        userSessionId: "test-session-id",
        channelId: "user1",
        instanceId: "app123",
      },
      callback,
    )

    // Verify the handler called the server method
    expect(mockFdc3Server.setCurrentChannel).toHaveBeenCalledWith(
      "app123",
      "user1",
    )

    // Verify callback was called with success
    expect(callback).toHaveBeenCalledWith(true, null)
  })

  it("should handle errors", async () => {
    mockFdc3Server.setCurrentChannel = vi.fn().mockImplementation(() => {
      throw new Error("Test error")
    })

    // Register handlers
    registerChannelHandlers(socket, connectionState)

    // Get the joinChannel handler
    const joinChannelHandler = socket.on.mock.calls.find(
      (call) => call[0] === "fdc3.joinChannel",
    )?.[1]

    // Mock callback
    const callback = vi.fn()

    // Call the handler
    await joinChannelHandler(
      {
        userSessionId: "test-session-id",
        channelId: "user1",
        instanceId: "app123",
      },
      callback,
    )

    // Verify callback was called with error
    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ error: "Test error" }),
    )
  })

  it("should handle broadcast request", async () => {
    // Register handlers
    registerChannelHandlers(socket, connectionState)

    // Get the broadcast handler
    const broadcastHandler = socket.on.mock.calls.find(
      (call) => call[0] === "fdc3.broadcast",
    )?.[1]

    // Mock callback
    const callback = vi.fn()

    // Call the handler
    await broadcastHandler(
      {
        userSessionId: "test-session-id",
        instanceId: "app123",
        context: { type: "fdc3.test", id: { value: "test" } },
      },
      callback,
    )

    // Verify the handler called the server method
    expect(mockFdc3Server.broadcast).toHaveBeenCalledWith(
      "app123",
      expect.objectContaining({ type: "fdc3.test" }),
    )

    // Verify callback was called with success
    expect(callback).toHaveBeenCalledWith(true, null)
  })

  it("should handle getCurrentChannel request", async () => {
    mockFdc3Server.getCurrentChannel = vi.fn().mockReturnValue({
      id: "user1",
      type: "user",
      displayMetadata: { name: "User 1" },
    })

    // Register handlers
    registerChannelHandlers(socket, connectionState)

    // Get the getCurrentChannel handler
    const getCurrentChannelHandler = socket.on.mock.calls.find(
      (call) => call[0] === "fdc3.getCurrentChannel",
    )?.[1]

    // Mock callback
    const callback = vi.fn()

    // Call the handler
    await getCurrentChannelHandler(
      {
        userSessionId: "test-session-id",
        instanceId: "app123",
      },
      callback,
    )

    // Verify the handler called the server method
    expect(mockFdc3Server.getCurrentChannel).toHaveBeenCalledWith("app123")

    // Verify callback was called with the channel
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user1" }),
      null,
    )
  })

  it("should handle leaveCurrentChannel request", async () => {
    // Register handlers
    registerChannelHandlers(socket, connectionState)

    // Get the leaveCurrentChannel handler
    const leaveChannelHandler = socket.on.mock.calls.find(
      (call) => call[0] === "fdc3.leaveCurrentChannel",
    )?.[1]

    // Mock callback
    const callback = vi.fn()

    // Call the handler
    await leaveChannelHandler(
      {
        userSessionId: "test-session-id",
        instanceId: "app123",
      },
      callback,
    )

    // Verify the handler called the server method
    expect(mockFdc3Server.leaveCurrentChannel).toHaveBeenCalledWith("app123")

    // Verify callback was called with success
    expect(callback).toHaveBeenCalledWith(true, null)
  })
})
