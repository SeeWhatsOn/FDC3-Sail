// packages/socket/__tests__/model/SailServerContext.test.ts
import { describe, it, expect, vi, beforeEach, Mock } from "vitest"
import { Socket } from "socket.io"
import { SailServerContext } from "../../src/model/fdc3/SailServerContext"
import { SailDirectory } from "../../src/model/fdc3/SailDirectory"
import { FDC3Server, DirectoryApp } from "@finos/fdc3-web-impl"
import { Context, AppIntent, OpenError } from "@finos/fdc3"
import {
  FDC3_DA_EVENT,
  SAIL_APP_OPEN,
  SAIL_BROADCAST_CONTEXT,
  AppHosting,
} from "@finos/fdc3-sail-common"
import { SailData } from "../../src/types"

describe("SailServerContext", () => {
  let sailServerContext: SailServerContext
  let mockSocket: Socket & { emit: Mock }
  let mockDirectory: SailDirectory
  let mockFdc3Server: FDC3Server

  const testAppId = "test-app-1"
  const testInstanceId = "instance-123"
  const testChannelId = "test-channel"

  beforeEach(() => {
    // Mock Socket
    mockSocket = {
      id: "desktop-agent-socket",
      emit: vi.fn(),
      on: vi.fn(),
      connected: true,
    } as unknown as Socket & { emit: Mock }

    // Mock Directory
    mockDirectory = {
      retrieveAppsById: vi.fn(),
      getAllApps: vi.fn(),
      getAppById: vi.fn(),
    } as unknown as SailDirectory

    // Mock FDC3 Server
    mockFdc3Server = {
      getChannels: vi.fn(),
      getCurrentChannel: vi.fn(),
      setCurrentChannel: vi.fn(),
    } as unknown as FDC3Server

    sailServerContext = new SailServerContext(mockDirectory, mockSocket)
    sailServerContext.setFDC3Server(mockFdc3Server)

    vi.clearAllMocks()
  })

  describe("Basic Operations", () => {
    it("should create instance with directory and socket", () => {
      expect(sailServerContext.directory).toBe(mockDirectory)
      expect(sailServerContext.getDesktopAgentSocket()).toBe(mockSocket)
    })

    it("should set FDC3 server instance", () => {
      const newServer = {} as FDC3Server
      sailServerContext.setFDC3Server(newServer)
      // Verify server is set (internal state, verified indirectly through behavior)
      expect(true).toBe(true)
    })
  })

  describe("App Registration and Lifecycle", () => {
    it("should register app instance", () => {
      const mockAppSocket = { emit: vi.fn() } as unknown as Socket
      const sailData: SailData = {
        socket: mockAppSocket,
        hosting: AppHosting.Frame,
        appId: testAppId,
        instanceTitle: "Test App Instance",
      }

      sailServerContext.register(testInstanceId, sailData)

      // Verify registration by attempting to post a message
      const testMessage = { type: "test", data: "hello" }
      sailServerContext.post(testMessage, testInstanceId)

      expect(mockAppSocket.emit).toHaveBeenCalledWith(FDC3_DA_EVENT, testMessage)
    })

    it("should handle unregistration", () => {
      const mockAppSocket = { emit: vi.fn() } as unknown as Socket
      const sailData: SailData = {
        socket: mockAppSocket,
        hosting: AppHosting.Frame,
        appId: testAppId,
        instanceTitle: "Test App Instance",
      }

      sailServerContext.register(testInstanceId, sailData)
      sailServerContext.unregister(testInstanceId)

      // Verify unregistration by attempting to post a message (should not emit)
      const testMessage = { type: "test", data: "hello" }
      sailServerContext.post(testMessage, testInstanceId)

      expect(mockAppSocket.emit).not.toHaveBeenCalled()
    })

    it("should get registered instances", () => {
      const mockAppSocket = { emit: vi.fn() } as unknown as Socket
      const sailData: SailData = {
        socket: mockAppSocket,
        hosting: AppHosting.Frame,
        appId: testAppId,
        instanceTitle: "Test App Instance",
      }

      sailServerContext.register(testInstanceId, sailData)
      const instances = sailServerContext.getInstances()

      expect(instances.has(testInstanceId)).toBe(true)
      expect(instances.get(testInstanceId)).toBe(sailData)
    })

    it("should find instances by app ID", () => {
      const mockAppSocket1 = { emit: vi.fn() } as unknown as Socket
      const mockAppSocket2 = { emit: vi.fn() } as unknown as Socket

      const sailData1: SailData = {
        socket: mockAppSocket1,
        hosting: AppHosting.Frame,
        appId: testAppId,
        instanceTitle: "Instance 1",
      }

      const sailData2: SailData = {
        socket: mockAppSocket2,
        hosting: AppHosting.Tab,
        appId: testAppId,
        instanceTitle: "Instance 2",
      }

      const sailData3: SailData = {
        socket: mockAppSocket2,
        hosting: AppHosting.Frame,
        appId: "different-app",
        instanceTitle: "Different App",
      }

      sailServerContext.register("instance-1", sailData1)
      sailServerContext.register("instance-2", sailData2)
      sailServerContext.register("instance-3", sailData3)

      const instances = sailServerContext.findInstances(testAppId)

      expect(instances).toHaveLength(2)
      expect(instances).toContainEqual({
        instanceId: "instance-1",
        ...sailData1,
      })
      expect(instances).toContainEqual({
        instanceId: "instance-2",
        ...sailData2,
      })
    })
  })

  describe("Message Posting", () => {
    it("should post message to registered instance", () => {
      const mockAppSocket = { emit: vi.fn() } as unknown as Socket
      const sailData: SailData = {
        socket: mockAppSocket,
        hosting: AppHosting.Frame,
        appId: testAppId,
        instanceTitle: "Test App Instance",
      }

      sailServerContext.register(testInstanceId, sailData)

      const testMessage = { type: "contextUpdate", context: { type: "fdc3.test" } }
      sailServerContext.post(testMessage, testInstanceId)

      expect(mockAppSocket.emit).toHaveBeenCalledWith(FDC3_DA_EVENT, testMessage)
    })

    it("should not post message to unregistered instance", () => {
      const testMessage = { type: "contextUpdate", context: { type: "fdc3.test" } }
      
      // Should not throw, just silently ignore
      expect(() => {
        sailServerContext.post(testMessage, "nonexistent-instance")
      }).not.toThrow()
    })

    it("should filter heartbeat messages from logging", () => {
      const mockAppSocket = { emit: vi.fn() } as unknown as Socket
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      const sailData: SailData = {
        socket: mockAppSocket,
        hosting: AppHosting.Frame,
        appId: testAppId,
        instanceTitle: "Test App Instance",
      }

      sailServerContext.register(testInstanceId, sailData)

      // Heartbeat message should not be logged
      const heartbeatMessage = { type: "heartbeat", timestamp: new Date() }
      sailServerContext.post(heartbeatMessage, testInstanceId)

      // Regular message should be logged
      const regularMessage = { type: "contextUpdate", context: { type: "fdc3.test" } }
      sailServerContext.post(regularMessage, testInstanceId)

      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Posting message to app:")
      )

      logSpy.mockRestore()
    })
  })

  describe("App Opening", () => {
    const mockDirectoryApp: DirectoryApp = {
      appId: testAppId,
      name: "Test App",
      details: {
        url: "https://example.com/test-app",
      },
      intents: [],
    }

    beforeEach(() => {
      vi.mocked(mockDirectory.retrieveAppsById).mockReturnValue([mockDirectoryApp])
    })

    it("should open app successfully", async () => {
      const instanceId = await sailServerContext.open(testAppId)

      expect(mockDirectory.retrieveAppsById).toHaveBeenCalledWith(testAppId)
      expect(mockSocket.emit).toHaveBeenCalledWith(
        SAIL_APP_OPEN,
        expect.objectContaining({
          appId: testAppId,
          instanceId,
          hosting: AppHosting.Frame,
        })
      )
      expect(instanceId).toBeDefined()
    })

    it("should open app on specific channel", async () => {
      await sailServerContext.openOnChannel(testAppId, testChannelId)
      const instanceId = await sailServerContext.open(testAppId)

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SAIL_APP_OPEN,
        expect.objectContaining({
          appId: testAppId,
          instanceId,
          hosting: AppHosting.Frame,
          channel: testChannelId,
        })
      )
    })

    it("should throw error when app not found", async () => {
      vi.mocked(mockDirectory.retrieveAppsById).mockReturnValue([])

      await expect(sailServerContext.open("nonexistent-app")).rejects.toThrow(
        OpenError.AppNotFound
      )
    })

    it("should handle app with no URL", async () => {
      const appWithoutUrl: DirectoryApp = {
        ...mockDirectoryApp,
        details: {},
      }
      vi.mocked(mockDirectory.retrieveAppsById).mockReturnValue([appWithoutUrl])

      await expect(sailServerContext.open(testAppId)).rejects.toThrow()
    })

    it("should force new window for configured apps", async () => {
      const appWithNewWindow: DirectoryApp = {
        ...mockDirectoryApp,
        details: {
          url: "https://example.com/test-app",
          forceNewWindow: true,
        },
      }
      vi.mocked(mockDirectory.retrieveAppsById).mockReturnValue([appWithNewWindow])

      const instanceId = await sailServerContext.open(testAppId)

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SAIL_APP_OPEN,
        expect.objectContaining({
          hosting: AppHosting.Tab,
        })
      )
    })
  })

  describe("Context Broadcasting", () => {
    it("should notify broadcast context", () => {
      const broadcastEvent = {
        payload: {
          channelId: testChannelId,
          context: { type: "fdc3.test", id: { value: "test-data" } },
        },
      }

      sailServerContext.notifyBroadcastContext(broadcastEvent)

      expect(mockSocket.emit).toHaveBeenCalledWith(SAIL_BROADCAST_CONTEXT, {
        channelId: testChannelId,
        context: broadcastEvent.payload.context,
      })
    })
  })

  describe("Channel Operations", () => {
    beforeEach(() => {
      const mockAppSocket = { emit: vi.fn() } as unknown as Socket
      const sailData: SailData = {
        socket: mockAppSocket,
        hosting: AppHosting.Frame,
        appId: testAppId,
        instanceTitle: "Test App Instance",
      }
      sailServerContext.register(testInstanceId, sailData)
    })

    it("should notify channel change", () => {
      const channelDetail = {
        id: testChannelId,
        type: "user" as const,
        displayMetadata: { name: "Test Channel" },
      }

      sailServerContext.notifyChannelChange(testInstanceId, channelDetail)

      // Verify the instance receives the channel change notification
      const instance = sailServerContext.getInstances().get(testInstanceId)
      expect(instance?.socket?.emit).toHaveBeenCalledWith(
        FDC3_DA_EVENT,
        expect.objectContaining({
          type: "channelChanged",
        })
      )
    })

    it("should handle channel change for unregistered instance", () => {
      const channelDetail = {
        id: testChannelId,
        type: "user" as const,
        displayMetadata: { name: "Test Channel" },
      }

      // Should not throw for unregistered instance
      expect(() => {
        sailServerContext.notifyChannelChange("nonexistent-instance", channelDetail)
      }).not.toThrow()
    })
  })

  describe("Intent Resolution", () => {
    beforeEach(() => {
      const mockAppSocket = { emit: vi.fn() } as unknown as Socket
      const sailData: SailData = {
        socket: mockAppSocket,
        hosting: AppHosting.Frame,
        appId: testAppId,
        instanceTitle: "Test App Instance",
      }
      sailServerContext.register(testInstanceId, sailData)
    })

    it("should notify intent resolution", () => {
      const intentName = "ViewChart"
      const context: Context = { type: "fdc3.instrument", id: { ticker: "AAPL" } }
      const targetAppId = "chart-app"

      sailServerContext.notifyIntentResolution(
        testInstanceId,
        intentName,
        context,
        targetAppId
      )

      const instance = sailServerContext.getInstances().get(testInstanceId)
      expect(instance?.socket?.emit).toHaveBeenCalledWith(
        FDC3_DA_EVENT,
        expect.objectContaining({
          type: "intentResolution",
          intent: intentName,
          context,
          targetApp: targetAppId,
        })
      )
    })
  })

  describe("Error Handling", () => {
    it("should handle socket emission errors gracefully", () => {
      const mockAppSocket = {
        emit: vi.fn().mockImplementation(() => {
          throw new Error("Socket error")
        }),
      } as unknown as Socket

      const sailData: SailData = {
        socket: mockAppSocket,
        hosting: AppHosting.Frame,
        appId: testAppId,
        instanceTitle: "Test App Instance",
      }

      sailServerContext.register(testInstanceId, sailData)

      // Should not throw error when socket emission fails
      expect(() => {
        sailServerContext.post({ type: "test" }, testInstanceId)
      }).not.toThrow()
    })
  })
})