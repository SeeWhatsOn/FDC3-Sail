// FDC3 Server business logic tests - no socket mocking, pure unit tests
import { describe, it, expect, beforeEach, vi } from "vitest"
import { SimpleFDC3Server } from "../SimpleFDC3Server"
import { State } from "@finos/fdc3-web-impl"
import { AppHosting } from "@finos/fdc3-sail-common"

describe("FDC3 Server - Business Logic", () => {
  let server: SimpleFDC3Server
  let mockSocket: unknown

  beforeEach(() => {
    // Minimal socket mock - just what SimpleFDC3Server constructor needs
    mockSocket = {
      id: "test-socket",
      connected: true,
      emit: vi.fn(),
      emitWithAck: vi.fn(),
    }

    server = new SimpleFDC3Server(mockSocket, {
      userSessionId: "test-session",
      channels: [
        { id: "red", icon: "🔴", background: "#ff0000" },
        { id: "blue", icon: "🔵", background: "#0000ff" },
      ],
      directories: ["https://example.com/directory.json"],
      panels: [],
      customApps: [],
      contextHistory: {},
    })
  })

  describe("Server Context Operations", () => {
    it("should manage app instances", () => {
      const instanceData = {
        instanceId: "test-instance",
        appId: "calculator",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red",
        instanceTitle: "Calculator Instance",
        channelSockets: [],
      }

      server.serverContext.setInstanceDetails("test-instance", instanceData)

      const retrieved = server.serverContext.getInstanceDetails("test-instance")
      expect(retrieved).toEqual(instanceData)
    })

    it("should get connected apps only", async () => {
      // Add connected app
      server.serverContext.setInstanceDetails("connected-app", {
        instanceId: "connected-app",
        appId: "calculator",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red",
        instanceTitle: "Calculator",
        channelSockets: [],
      })

      // Add pending app (should not be included)
      server.serverContext.setInstanceDetails("pending-app", {
        instanceId: "pending-app",
        appId: "chart",
        state: State.Pending,
        hosting: AppHosting.Frame,
        channel: "blue",
        instanceTitle: "Chart",
        channelSockets: [],
      })

      const connectedApps = await server.serverContext.getConnectedApps()

      expect(connectedApps).toHaveLength(1)
      expect(connectedApps[0].instanceId).toBe("connected-app")
      expect(connectedApps[0].state).toBe(State.Connected)
    })

    it("should check app connection status", async () => {
      server.serverContext.setInstanceDetails("connected-app", {
        instanceId: "connected-app",
        appId: "calculator",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red",
        instanceTitle: "Calculator",
        channelSockets: [],
      })

      const isConnected =
        await server.serverContext.isAppConnected("connected-app")
      const isNotConnected =
        await server.serverContext.isAppConnected("missing-app")

      expect(isConnected).toBe(true)
      expect(isNotConnected).toBe(false)
    })
  })

  describe("Channel Management", () => {
    it("should initialize with provided channels", () => {
      const tabs = server.serverContext.getTabs()

      expect(tabs).toHaveLength(2)
      expect(tabs.find((t) => t.id === "red")).toBeDefined()
      expect(tabs.find((t) => t.id === "blue")).toBeDefined()
    })

    it("should update channel data", () => {
      const newChannels = [{ id: "green", icon: "🟢", background: "#00ff00" }]

      server.serverContext.updateChannelData(newChannels)

      const tabs = server.serverContext.getTabs()
      expect(tabs).toHaveLength(1)
      expect(tabs[0].id).toBe("green")
    })

    it("should notify channel changes", async () => {
      const appSocket = { emit: vi.fn() } as unknown
      server.serverContext.setInstanceDetails("test-app", {
        instanceId: "test-app",
        appId: "calculator",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red",
        instanceTitle: "Calculator",
        channelSockets: [],
        socket: appSocket,
      })

      await server.serverContext.notifyUserChannelsChanged("test-app", "blue")

      const updatedInstance =
        server.serverContext.getInstanceDetails("test-app")
      expect(updatedInstance?.channel).toBe("blue")
      expect(appSocket.emit).toHaveBeenCalled()
    })
  })

  describe("Intent Resolution", () => {
    beforeEach(() => {
      // Set up test instances for intent resolution
      server.serverContext.setInstanceDetails("raiser-instance", {
        instanceId: "raiser-instance",
        appId: "raiser-app",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red",
        instanceTitle: "Raiser App",
        channelSockets: [],
      })
    })

    it("should auto-resolve intent with single app in same channel", async () => {
      const raiser = { instanceId: "raiser-instance", appId: "raiser-app" }
      const app = { appId: "calculator", instanceId: "running-instance" }
      const intent = {
        intent: { name: "test-intent", displayName: "Test" },
        apps: [app],
      }

      server.serverContext.setInstanceDetails("running-instance", {
        instanceId: "running-instance",
        appId: "calculator",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red", // Same channel as raiser
        instanceTitle: "Calculator App",
        channelSockets: [],
      })

      const result = await server.narrowIntents(raiser, [intent], {
        type: "fdc3.instrument",
        id: { ticker: "AAPL" },
      })

      expect(result).toEqual([intent])
    })

    it("should handle multiple apps requiring resolution", async () => {
      const raiser = { instanceId: "raiser-instance", appId: "raiser-app" }
      const app1 = { appId: "calculator", instanceId: "running-instance-1" }
      const app2 = { appId: "calculator", instanceId: "running-instance-2" }
      const intent = {
        intent: { name: "test-intent", displayName: "Test" },
        apps: [app1, app2],
      }

      // Set up multiple running instances
      server.serverContext.setInstanceDetails("running-instance-1", {
        instanceId: "running-instance-1",
        appId: "calculator",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red",
        instanceTitle: "Calculator Instance 1",
        channelSockets: [],
      })
      server.serverContext.setInstanceDetails("running-instance-2", {
        instanceId: "running-instance-2",
        appId: "calculator",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red",
        instanceTitle: "Calculator Instance 2",
        channelSockets: [],
      })

      // Mock the desktop agent resolution
      mockSocket.emit.mockImplementation(
        (
          _event: string,
          _payload: unknown,
          callback?: (data: unknown) => void,
        ) => {
          if (callback) callback({ appIntents: [intent] })
        },
      )

      const result = await server.narrowIntents(raiser, [intent], {
        type: "fdc3.instrument",
        id: { ticker: "AAPL" },
      })

      expect(result).toEqual([intent])
    })
  })

  describe("Message Handling", () => {
    it("should post messages to connected apps", async () => {
      const appSocket = { emit: vi.fn() } as unknown
      server.serverContext.setInstanceDetails("test-app", {
        instanceId: "test-app",
        appId: "calculator",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red",
        instanceTitle: "Calculator",
        channelSockets: [],
        socket: appSocket,
      })

      const message = { type: "test-message", data: "hello" }
      await server.serverContext.post(message, "test-app")

      expect(appSocket.emit).toHaveBeenCalledWith("fdc3-da-event", message)
    })

    it("should handle missing app gracefully", async () => {
      const message = { type: "test-message" }

      // Should not throw
      await expect(
        server.serverContext.post(message, "missing-app"),
      ).resolves.not.toThrow()
    })
  })

  describe("Lifecycle Management", () => {
    it("should shutdown cleanly", async () => {
      // Add some test data
      server.serverContext.setInstanceDetails("test-app", {
        instanceId: "test-app",
        appId: "calculator",
        state: State.Connected,
        hosting: AppHosting.Frame,
        channel: "red",
        instanceTitle: "Calculator",
        channelSockets: [],
      })

      await server.shutdown()

      // Verify cleanup
      expect(
        server.serverContext.getInstanceDetails("test-app"),
      ).toBeUndefined()
    })
  })

  describe("Error Scenarios", () => {
    it("should handle invalid app opening", async () => {
      await expect(server.openApp("non-existent-app")).rejects.toThrow(
        "AppNotFound",
      )
    })

    it("should handle malformed directory data gracefully", () => {
      // Server should initialize even with invalid directory URLs
      expect(server.getAppDirectory()).toBeDefined()
    })
  })
})
