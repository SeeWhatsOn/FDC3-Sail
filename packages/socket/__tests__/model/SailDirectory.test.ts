// packages/socket/__tests__/model/SailDirectory.test.ts
import { describe, it, expect, vi, beforeEach, Mock } from "vitest"
import { SailDirectory, getIcon } from "../../src/model/fdc3/SailDirectory"
import { DirectoryApp } from "@finos/fdc3-web-impl"
import { AppDirectory } from "@finos/fdc3-sail-common"

// Mock fetch globally
global.fetch = vi.fn()

describe("SailDirectory", () => {
  let sailDirectory: SailDirectory
  let mockDirectories: AppDirectory[]

  beforeEach(() => {
    mockDirectories = [
      {
        apps: [
          {
            appId: "local-app-1",
            name: "Local App 1",
            details: { url: "https://example.com/app1" },
            intents: [
              {
                name: "StartCall",
                contexts: ["fdc3.contact"],
              },
            ],
          },
          {
            appId: "local-app-2",
            name: "Local App 2",
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

    sailDirectory = new SailDirectory(mockDirectories)
    vi.clearAllMocks()
  })

  describe("Initialization", () => {
    it("should initialize with local directories", () => {
      const allApps = sailDirectory.getAllApps()
      expect(allApps).toHaveLength(2)
      expect(allApps[0].appId).toBe("local-app-1")
      expect(allApps[1].appId).toBe("local-app-2")
    })

    it("should handle empty directories", () => {
      const emptyDirectory = new SailDirectory([])
      const allApps = emptyDirectory.getAllApps()
      expect(allApps).toHaveLength(0)
    })

    it("should handle directories with empty apps array", () => {
      const emptyAppsDirectory = new SailDirectory([{ apps: [] }])
      const allApps = emptyAppsDirectory.getAllApps()
      expect(allApps).toHaveLength(0)
    })
  })

  describe("App Retrieval", () => {
    it("should get app by ID", () => {
      const app = sailDirectory.getAppById("local-app-1")
      expect(app).toBeDefined()
      expect(app?.appId).toBe("local-app-1")
      expect(app?.name).toBe("Local App 1")
    })

    it("should return undefined for non-existent app ID", () => {
      const app = sailDirectory.getAppById("nonexistent-app")
      expect(app).toBeUndefined()
    })

    it("should retrieve apps by ID", () => {
      const apps = sailDirectory.retrieveAppsById("local-app-1")
      expect(apps).toHaveLength(1)
      expect(apps[0].appId).toBe("local-app-1")
    })

    it("should return empty array for non-existent app ID in retrieveAppsById", () => {
      const apps = sailDirectory.retrieveAppsById("nonexistent-app")
      expect(apps).toHaveLength(0)
    })

    it("should get all apps", () => {
      const allApps = sailDirectory.getAllApps()
      expect(allApps).toHaveLength(2)
      expect(allApps.map(app => app.appId)).toEqual(["local-app-1", "local-app-2"])
    })
  })

  describe("Remote Directory Loading", () => {
    it("should load remote directory successfully", async () => {
      const remoteApps = [
        {
          appId: "remote-app-1",
          name: "Remote App 1",
          details: { url: "https://remote.com/app1" },
          intents: [],
        },
      ]

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ apps: remoteApps }),
      } as Response)

      await sailDirectory.loadRemoteDirectory("https://remote.com/directory")

      const allApps = sailDirectory.getAllApps()
      expect(allApps).toHaveLength(3) // 2 local + 1 remote
      expect(allApps.some(app => app.appId === "remote-app-1")).toBe(true)
    })

    it("should handle remote directory fetch failure", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"))

      // Should not throw, but should log error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      
      await sailDirectory.loadRemoteDirectory("https://remote.com/directory")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load remote directory")
      )

      // Apps should remain unchanged
      const allApps = sailDirectory.getAllApps()
      expect(allApps).toHaveLength(2)

      consoleSpy.mockRestore()
    })

    it("should handle invalid remote directory response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response)

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      
      await sailDirectory.loadRemoteDirectory("https://remote.com/directory")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load remote directory")
      )

      consoleSpy.mockRestore()
    })

    it("should handle malformed remote directory JSON", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalidStructure: true }),
      } as Response)

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      
      await sailDirectory.loadRemoteDirectory("https://remote.com/directory")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load remote directory")
      )

      consoleSpy.mockRestore()
    })
  })

  describe("App Deduplication", () => {
    it("should deduplicate apps with same appId", async () => {
      const duplicateApp = {
        appId: "local-app-1", // Same as existing app
        name: "Updated Local App 1",
        details: { url: "https://updated.com/app1" },
        intents: [],
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ apps: [duplicateApp] }),
      } as Response)

      await sailDirectory.loadRemoteDirectory("https://remote.com/directory")

      const allApps = sailDirectory.getAllApps()
      expect(allApps).toHaveLength(2) // Should still be 2, not 3
      
      // The remote app should override the local one
      const updatedApp = sailDirectory.getAppById("local-app-1")
      expect(updatedApp?.name).toBe("Updated Local App 1")
    })

    it("should handle multiple directories with same apps", async () => {
      const directory1Apps = [{ appId: "shared-app", name: "Shared App v1", details: {}, intents: [] }]
      const directory2Apps = [{ appId: "shared-app", name: "Shared App v2", details: {}, intents: [] }]

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ apps: directory1Apps }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ apps: directory2Apps }),
        } as Response)

      await sailDirectory.loadRemoteDirectory("https://dir1.com/directory")
      await sailDirectory.loadRemoteDirectory("https://dir2.com/directory")

      const allApps = sailDirectory.getAllApps()
      const sharedApps = allApps.filter(app => app.appId === "shared-app")
      expect(sharedApps).toHaveLength(1)
      expect(sharedApps[0].name).toBe("Shared App v2") // Last loaded should win
    })
  })

  describe("Complex Directory Scenarios", () => {
    it("should handle multiple directories with mixed local and remote apps", () => {
      const multiDirectories: AppDirectory[] = [
        {
          apps: [
            { appId: "local-1", name: "Local 1", details: {}, intents: [] },
            { appId: "local-2", name: "Local 2", details: {}, intents: [] },
          ],
        },
        {
          apps: [
            { appId: "local-3", name: "Local 3", details: {}, intents: [] },
          ],
        },
      ]

      const multiDirectory = new SailDirectory(multiDirectories)
      const allApps = multiDirectory.getAllApps()
      
      expect(allApps).toHaveLength(3)
      expect(allApps.map(app => app.appId)).toEqual(["local-1", "local-2", "local-3"])
    })

    it("should handle apps with complex intent configurations", () => {
      const complexApps: AppDirectory[] = [
        {
          apps: [
            {
              appId: "complex-app",
              name: "Complex App",
              details: { url: "https://example.com" },
              intents: [
                {
                  name: "StartCall",
                  contexts: ["fdc3.contact", "fdc3.contactList"],
                },
                {
                  name: "ViewChart",
                  contexts: ["fdc3.instrument", "fdc3.portfolio"],
                },
              ],
            },
          ],
        },
      ]

      const complexDirectory = new SailDirectory(complexApps)
      const app = complexDirectory.getAppById("complex-app")
      
      expect(app?.intents).toHaveLength(2)
      expect(app?.intents?.[0].contexts).toEqual(["fdc3.contact", "fdc3.contactList"])
    })
  })

  describe("Error Edge Cases", () => {
    it("should handle null/undefined apps in directory", () => {
      const malformedDirectory = new SailDirectory([
        {
          apps: [
            null as any,
            undefined as any,
            { appId: "valid-app", name: "Valid", details: {}, intents: [] },
          ],
        },
      ])

      const allApps = malformedDirectory.getAllApps()
      expect(allApps).toHaveLength(1)
      expect(allApps[0].appId).toBe("valid-app")
    })

    it("should handle apps with missing required fields", () => {
      const incompleteApps = [
        { name: "No ID App", details: {}, intents: [] } as any,
        { appId: "no-name", details: {}, intents: [] } as any,
        { appId: "valid", name: "Valid", details: {}, intents: [] },
      ]

      const incompleteDirectory = new SailDirectory([{ apps: incompleteApps }])
      const allApps = incompleteDirectory.getAllApps()
      
      // Should include all apps regardless of missing fields (filtering may happen elsewhere)
      expect(allApps).toHaveLength(3)
    })
  })
})

describe("getIcon utility", () => {
  it("should return icon URL for app with icon", () => {
    const app: DirectoryApp = {
      appId: "test-app",
      name: "Test App",
      details: {},
      intents: [],
      icons: [{ src: "https://example.com/icon.png" }],
    }

    const iconUrl = getIcon(app)
    expect(iconUrl).toBe("https://example.com/icon.png")
  })

  it("should return undefined for app without icons", () => {
    const app: DirectoryApp = {
      appId: "test-app",
      name: "Test App",
      details: {},
      intents: [],
    }

    const iconUrl = getIcon(app)
    expect(iconUrl).toBeUndefined()
  })

  it("should return undefined for app with empty icons array", () => {
    const app: DirectoryApp = {
      appId: "test-app",
      name: "Test App",
      details: {},
      intents: [],
      icons: [],
    }

    const iconUrl = getIcon(app)
    expect(iconUrl).toBeUndefined()
  })

  it("should return first icon when multiple icons exist", () => {
    const app: DirectoryApp = {
      appId: "test-app",
      name: "Test App",
      details: {},
      intents: [],
      icons: [
        { src: "https://example.com/icon1.png" },
        { src: "https://example.com/icon2.png" },
      ],
    }

    const iconUrl = getIcon(app)
    expect(iconUrl).toBe("https://example.com/icon1.png")
  })
})