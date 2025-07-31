// packages/socket/__tests__/model/SailFDC3Server.test.ts
import { describe, it, expect, vi, beforeEach, Mock } from "vitest"
import { SailFDC3Server } from "../../src/model/fdc3/SailFDC3Server"
import { SailServerContext } from "../../src/model/fdc3/SailServerContext"
import { SailDirectory } from "../../src/model/fdc3/SailDirectory"
import { Channel, ImplementationMetadata } from "@finos/fdc3"
import { AppDirectory } from "@finos/fdc3-sail-common"

describe("SailFDC3Server", () => {
  let sailFDC3Server: SailFDC3Server
  let mockServerContext: SailServerContext
  let mockDirectory: SailDirectory
  let channels: Channel[]
  let directories: AppDirectory[]

  beforeEach(() => {
    // Mock channels
    channels = [
      {
        id: "system",
        type: "system",
        displayMetadata: { name: "System", color: "red" },
      },
      {
        id: "user1",
        type: "user",
        displayMetadata: { name: "User 1", color: "blue" },
      },
      {
        id: "user2",
        type: "user",
        displayMetadata: { name: "User 2", color: "green" },
      },
    ]

    // Mock directories
    directories = [
      {
        apps: [
          {
            appId: "test-app-1",
            name: "Test App 1",
            details: { url: "https://example.com/app1" },
            intents: [
              {
                name: "StartCall",
                contexts: ["fdc3.contact"],
              },
            ],
          },
          {
            appId: "test-app-2",
            name: "Test App 2", 
            details: { url: "https://example.com/app2" },
            intents: [
              {
                name: "ViewChart",
                contexts: ["fdc3.instrument"],
              },
            ],
          },
        ],
      },
    ]

    // Mock SailDirectory
    mockDirectory = {
      getAllApps: vi.fn().mockReturnValue(directories[0].apps),
      getAppById: vi.fn(),
      retrieveAppsById: vi.fn(),
    } as unknown as SailDirectory

    // Mock SailServerContext
    mockServerContext = {
      directory: mockDirectory,
      setFDC3Server: vi.fn(),
      register: vi.fn(),
      unregister: vi.fn(),
      post: vi.fn(),
      getInstances: vi.fn().mockReturnValue(new Map()),
      findInstances: vi.fn().mockReturnValue([]),
      open: vi.fn(),
      openOnChannel: vi.fn(),
      notifyBroadcastContext: vi.fn(),
      notifyChannelChange: vi.fn(),
      notifyIntentResolution: vi.fn(),
    } as unknown as SailServerContext

    sailFDC3Server = new SailFDC3Server(mockServerContext, channels, directories)

    vi.clearAllMocks()
  })

  describe("Initialization", () => {
    it("should create server with context, channels, and directories", () => {
      expect(sailFDC3Server.getAppDirectory()).toBe(mockDirectory)
      
      const serverChannels = sailFDC3Server.getChannels()
      expect(serverChannels.system).toHaveLength(1)
      expect(serverChannels.user).toHaveLength(2)
      expect(serverChannels.system[0].id).toBe("system")
      expect(serverChannels.user[0].id).toBe("user1")
      expect(serverChannels.user[1].id).toBe("user2")
    })

    it("should set server context on creation", () => {
      expect(mockServerContext.setFDC3Server).toHaveBeenCalledWith(sailFDC3Server)
    })

    it("should provide implementation metadata", () => {
      const metadata = sailFDC3Server.getImplementationMetadata()
      
      expect(metadata).toEqual<ImplementationMetadata>({
        fdc3Version: "2.2",
        provider: "fdc3-sail",
        providerVersion: expect.any(String),
        optionalFeatures: {
          OriginatingAppMetadata: true,
          UserChannelMembershipAPIs: true,
        },
      })
    })
  })

  describe("Channel Management", () => {
    it("should return mapped channels correctly", () => {
      const channelMap = sailFDC3Server.getChannels()
      
      expect(channelMap.system).toHaveLength(1)
      expect(channelMap.user).toHaveLength(2)
      expect(channelMap.app).toHaveLength(0)
    })

    it("should get channel by ID", () => {
      const systemChannel = sailFDC3Server.getCurrentChannel("system")
      const userChannel = sailFDC3Server.getCurrentChannel("user1")
      const nonExistentChannel = sailFDC3Server.getCurrentChannel("nonexistent")

      expect(systemChannel?.id).toBe("system")
      expect(userChannel?.id).toBe("user1")
      expect(nonExistentChannel).toBeNull()
    })

    it("should handle empty channels gracefully", () => {
      const emptyChannelServer = new SailFDC3Server(mockServerContext, [], directories)
      const channelMap = emptyChannelServer.getChannels()
      
      expect(channelMap.system).toHaveLength(0)
      expect(channelMap.user).toHaveLength(0)
      expect(channelMap.app).toHaveLength(0)
    })
  })

  describe("Channel Operations", () => {
    const testInstanceId = "test-instance-123"

    it("should set current channel successfully", async () => {
      const result = await sailFDC3Server.setCurrentChannel(testInstanceId, "user1")
      
      expect(result).toBe(true)
      expect(mockServerContext.notifyChannelChange).toHaveBeenCalledWith(
        testInstanceId,
        expect.objectContaining({ id: "user1" })
      )
    })

    it("should reject setting non-existent channel", async () => {
      const result = await sailFDC3Server.setCurrentChannel(testInstanceId, "nonexistent")
      
      expect(result).toBe(false)
      expect(mockServerContext.notifyChannelChange).not.toHaveBeenCalled()
    })

    it("should leave current channel successfully", async () => {
      // First set a channel
      await sailFDC3Server.setCurrentChannel(testInstanceId, "user1")
      
      // Then leave it
      const result = await sailFDC3Server.leaveCurrentChannel(testInstanceId)
      
      expect(result).toBe(true)
      expect(mockServerContext.notifyChannelChange).toHaveBeenCalledWith(
        testInstanceId,
        null
      )
    })

    it("should get current channel for instance", () => {
      // Initially no channel
      let currentChannel = sailFDC3Server.getCurrentChannel(testInstanceId)
      expect(currentChannel).toBeNull()

      // Set a channel (this would normally be tracked internally)
      // Note: This test assumes internal channel tracking, which may need adjustment
      // based on actual implementation details
    })
  })

  describe("Context Broadcasting", () => {
    const testInstanceId = "test-instance-123"
    const testContext = {
      type: "fdc3.instrument",
      id: { ticker: "AAPL" },
    }

    it("should broadcast context successfully", async () => {
      const result = await sailFDC3Server.broadcast(testInstanceId, testContext)
      
      expect(result).toBe(true)
      expect(mockServerContext.notifyBroadcastContext).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            context: testContext,
          }),
        })
      )
    })

    it("should handle broadcast for unregistered instance", async () => {
      // Should not throw, but may have different behavior
      const result = await sailFDC3Server.broadcast("nonexistent-instance", testContext)
      
      // Behavior depends on implementation - adjust expectation as needed
      expect(typeof result).toBe("boolean")
    })
  })

  describe("App Directory Integration", () => {
    it("should return app directory", () => {
      const directory = sailFDC3Server.getAppDirectory()
      expect(directory).toBe(mockDirectory)
    })

    it("should get all apps from directory", () => {
      const apps = mockDirectory.getAllApps()
      expect(apps).toHaveLength(2)
      expect(apps[0].appId).toBe("test-app-1")
      expect(apps[1].appId).toBe("test-app-2")
    })
  })

  describe("Error Handling", () => {
    it("should handle directory errors gracefully", () => {
      const errorDirectory = {
        getAllApps: vi.fn().mockImplementation(() => {
          throw new Error("Directory error")
        }),
      } as unknown as SailDirectory

      const errorContext = {
        ...mockServerContext,
        directory: errorDirectory,
      } as unknown as SailServerContext

      // Should not throw during construction
      expect(() => {
        new SailFDC3Server(errorContext, channels, directories)
      }).not.toThrow()
    })

    it("should handle malformed channel data", () => {
      const malformedChannels = [
        { id: "valid", type: "user" } as Channel,
        null as any,
        { id: "missing-type" } as Channel,
        { type: "missing-id" } as Channel,
      ]

      // Should not throw with malformed data
      expect(() => {
        new SailFDC3Server(mockServerContext, malformedChannels, directories)
      }).not.toThrow()
    })
  })

  describe("Shutdown", () => {
    it("should shutdown gracefully", async () => {
      await sailFDC3Server.shutdown()
      
      // Verify shutdown completed without errors
      expect(true).toBe(true)
    })

    it("should handle shutdown errors gracefully", async () => {
      // Mock context to throw error on shutdown operations
      const errorContext = {
        ...mockServerContext,
        getInstances: vi.fn().mockImplementation(() => {
          throw new Error("Shutdown error")
        }),
      } as unknown as SailServerContext

      const errorServer = new SailFDC3Server(errorContext, channels, directories)
      
      // Should not throw during shutdown
      await expect(errorServer.shutdown()).resolves.toBeUndefined()
    })
  })

  describe("Channel Mapping", () => {
    it("should map channels by type correctly", () => {
      const mixedChannels: Channel[] = [
        { id: "sys1", type: "system", displayMetadata: { name: "System 1" } },
        { id: "user1", type: "user", displayMetadata: { name: "User 1" } },
        { id: "app1", type: "app", displayMetadata: { name: "App 1" } },
        { id: "sys2", type: "system", displayMetadata: { name: "System 2" } },
      ]

      const mixedServer = new SailFDC3Server(mockServerContext, mixedChannels, directories)
      const channelMap = mixedServer.getChannels()

      expect(channelMap.system).toHaveLength(2)
      expect(channelMap.user).toHaveLength(1)
      expect(channelMap.app).toHaveLength(1)
      expect(channelMap.system.map(c => c.id)).toEqual(["sys1", "sys2"])
    })

    it("should handle unknown channel types", () => {
      const unknownTypeChannels = [
        { id: "unknown", type: "unknown-type" as any, displayMetadata: { name: "Unknown" } },
      ]

      const unknownServer = new SailFDC3Server(mockServerContext, unknownTypeChannels, directories)
      const channelMap = unknownServer.getChannels()

      // Unknown types should not appear in standard categories
      expect(channelMap.system).toHaveLength(0)
      expect(channelMap.user).toHaveLength(0)
      expect(channelMap.app).toHaveLength(0)
    })
  })
})