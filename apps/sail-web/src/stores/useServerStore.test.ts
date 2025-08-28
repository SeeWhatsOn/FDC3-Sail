import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { useServerStore } from "./useServerStore"
import { AppHosting } from "@finos/fdc3-sail-shared"
import { State } from "@finos/fdc3-web-impl"
import { Socket } from "socket.io-client"

// Mock socket interface
interface MockSocket {
  connected: boolean
  on: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
}

// Mock socket.io-client
const mockSocket: MockSocket = {
  connected: false,
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
}

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}))

beforeEach(() => {
  // Reset store
  useServerStore.setState({
    socket: null,
    isConnected: false,
    connectionError: null,
    appStates: [],
  })

  // Reset mocks
  vi.clearAllMocks()
  mockSocket.connected = false
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("useServerStore - Connection Management", () => {
  it("should initialize with disconnected state", () => {
    const store = useServerStore.getState()

    expect(store.isConnected).toBe(false)
    expect(store.socket).toBeNull()
    expect(store.connectionError).toBeNull()
    expect(store.appStates).toEqual([])
  })

  it("should create socket connection on connect", async () => {
    const store = useServerStore.getState()
    store.connect()

    const { io } = await import("socket.io-client")
    expect(io).toHaveBeenCalledWith("ws://localhost:8090", {
      transports: ["websocket"],
    })
    expect(useServerStore.getState().socket).toBe(mockSocket)
  })

  it("should not create new connection if already connected", async () => {
    mockSocket.connected = true
    useServerStore.setState({
      socket: mockSocket as unknown as Socket,
      isConnected: true,
    })

    const store = useServerStore.getState()
    store.connect()

    const { io } = await import("socket.io-client")
    expect(io).not.toHaveBeenCalled()
  })

  it("should set up event listeners on connect", () => {
    const store = useServerStore.getState()
    store.connect()

    expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith("disconnect", expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith("connect_error", expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith("appStateUpdate", expect.any(Function))
  })

  it("should handle connect event", () => {
    const store = useServerStore.getState()
    store.connect()

    // Simulate connect event
    const connectHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === "connect"
    )?.[1] as (...args: unknown[]) => void
    connectHandler?.()

    expect(useServerStore.getState().isConnected).toBe(true)
    expect(useServerStore.getState().connectionError).toBeNull()
  })

  it("should handle disconnect event", () => {
    useServerStore.setState({ isConnected: true })

    const store = useServerStore.getState()
    store.connect()

    // Simulate disconnect event
    const disconnectHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === "disconnect"
    )?.[1] as (...args: unknown[]) => void
    disconnectHandler?.("transport close")

    expect(useServerStore.getState().isConnected).toBe(false)
  })

  it("should handle connection error", () => {
    const store = useServerStore.getState()
    store.connect()

    // Simulate connection error
    const errorHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === "connect_error"
    )?.[1] as (...args: unknown[]) => void
    errorHandler?.(new Error("Connection failed"))

    expect(useServerStore.getState().isConnected).toBe(false)
    expect(useServerStore.getState().connectionError).toBe("Connection failed")
  })

  it("should handle app state updates", () => {
    const store = useServerStore.getState()
    store.connect()

    const mockAppStates = [
      { instanceId: "app-1", state: State.Connected },
      { instanceId: "app-2", state: State.Pending },
    ]

    // Simulate app state update
    const updateHandler = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === "appStateUpdate"
    )?.[1] as (...args: unknown[]) => void
    updateHandler?.(mockAppStates)

    expect(useServerStore.getState().appStates).toEqual(mockAppStates)
  })

  it("should disconnect properly", () => {
    useServerStore.setState({
      socket: mockSocket as unknown as Socket,
      isConnected: true,
    })

    const store = useServerStore.getState()
    store.disconnect()

    expect(mockSocket.disconnect).toHaveBeenCalled()

    const state = useServerStore.getState()
    expect(state.socket).toBeNull()
    expect(state.isConnected).toBe(false)
    expect(state.connectionError).toBeNull()
  })
})

describe("useServerStore - Server Communication", () => {
  beforeEach(() => {
    useServerStore.setState({
      socket: mockSocket as unknown as Socket,
      isConnected: true,
    })
  })

  it("should register desktop agent successfully", async () => {
    const mockResponse = { success: true }
    mockSocket.emit.mockImplementation(
      (event: string, _data: unknown, callback: (result: unknown) => void) => {
        if (event === "registerDesktopAgent") {
          callback(mockResponse)
        }
      }
    )

    const store = useServerStore.getState()
    const clientArgs = {
      userSessionId: "test-user",
      channels: [],
      panels: [],
      directories: [],
      customApps: [],
      contextHistory: {},
    }

    const result = await store.registerDesktopAgent(clientArgs)

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "registerDesktopAgent",
      clientArgs,
      expect.any(Function)
    )
    expect(result).toEqual(mockResponse)
  })

  it("should reject when not connected for registerDesktopAgent", async () => {
    useServerStore.setState({ isConnected: false })

    const store = useServerStore.getState()
    const clientArgs = {
      userSessionId: "test-user",
      channels: [],
      panels: [],
      directories: [],
      customApps: [],
      contextHistory: {},
    }

    await expect(store.registerDesktopAgent(clientArgs)).rejects.toThrow("Not connected to server")
  })

  it("should register app launch successfully", async () => {
    const mockInstanceId = "instance-123"
    mockSocket.emit.mockImplementation(
      (event: string, _data: unknown, callback: (result: unknown) => void) => {
        if (event === "registerAppLaunch") {
          callback({ instanceId: mockInstanceId })
        }
      }
    )

    const store = useServerStore.getState()
    const launchParams = {
      appId: "test-app",
      hosting: AppHosting.Frame,
      channel: "One",
      instanceTitle: "Test App 1",
    }

    const instanceId = await store.registerAppLaunch(launchParams)

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "registerAppLaunch",
      launchParams,
      expect.any(Function)
    )
    expect(instanceId).toBe(mockInstanceId)
  })

  it("should handle app launch error", async () => {
    mockSocket.emit.mockImplementation(
      (event: string, _data: unknown, callback: (result: unknown) => void) => {
        if (event === "registerAppLaunch") {
          callback({ error: "App not found" })
        }
      }
    )

    const store = useServerStore.getState()
    const launchParams = {
      appId: "invalid-app",
      hosting: AppHosting.Frame,
      instanceTitle: "Invalid App",
    }

    await expect(store.registerAppLaunch(launchParams)).rejects.toThrow("App not found")
  })

  it("should send client state successfully", async () => {
    const mockResponse = { received: true }
    mockSocket.emit.mockImplementation(
      (event: string, _data: unknown, callback: (result: unknown) => void) => {
        if (event === "sendClientState") {
          callback(mockResponse)
        }
      }
    )

    const store = useServerStore.getState()
    const clientArgs = {
      userSessionId: "test-user",
      channels: [],
      panels: [],
      directories: [],
      customApps: [],
      contextHistory: {},
    }

    const result = await store.sendClientState(clientArgs)

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "sendClientState",
      clientArgs,
      expect.any(Function)
    )
    expect(result).toEqual(mockResponse)
  })

  it("should send intent choice without callback", () => {
    const store = useServerStore.getState()
    store.intentChosen("req-123", "app-1", "intent-1", "channel-1")

    expect(mockSocket.emit).toHaveBeenCalledWith("intentChosen", {
      requestId: "req-123",
      appId: "app-1",
      intentId: "intent-1",
      channelId: "channel-1",
    })
  })

  it("should handle intent choice when not connected", () => {
    useServerStore.setState({ isConnected: false })
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const store = useServerStore.getState()
    store.intentChosen("req-123", "app-1", "intent-1", "channel-1")

    expect(consoleSpy).toHaveBeenCalledWith("Cannot send intent choice: not connected to server")
    expect(mockSocket.emit).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})

describe("useServerStore - Internal Methods", () => {
  it("should set app states", () => {
    const mockStates = [
      { appId: "test-app-1", instanceId: "app-1", state: State.Connected },
      { appId: "test-app-2", instanceId: "app-2", state: State.Pending },
    ]

    const store = useServerStore.getState()
    store._setAppStates(mockStates)

    expect(useServerStore.getState().appStates).toEqual(mockStates)
  })

  it("should set connection state with error", () => {
    const store = useServerStore.getState()
    store._setConnectionState(false, "Network error")

    const state = useServerStore.getState()
    expect(state.isConnected).toBe(false)
    expect(state.connectionError).toBe("Network error")
  })

  it("should clear connection error when connected", () => {
    useServerStore.setState({ connectionError: "Previous error" })

    const store = useServerStore.getState()
    store._setConnectionState(true)

    const state = useServerStore.getState()
    expect(state.isConnected).toBe(true)
    expect(state.connectionError).toBeNull()
  })
})
