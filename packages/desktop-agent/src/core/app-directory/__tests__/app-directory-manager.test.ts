/**
 * AppDirectoryManager Tests
 *
 * Comprehensive test suite for the AppDirectoryManager covering all
 * functionality including query methods, loading, validation, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { AppDirectoryManager, isValidDirectoryUrl } from "../app-directory-manager"
import type { DirectoryApp, DirectoryData, DirectoryIntent } from "../types"

describe("AppDirectoryManager", () => {
  let directory: AppDirectoryManager

  // Test data
  const mockApp1: DirectoryApp = {
    appId: "app-1",
    title: "Test App 1",
    type: "web",
    details: {
      url: "https://example.com/app1",
    },
    interop: {
      intents: {
        listensFor: {
          "ViewContact": {
            contexts: ["fdc3.contact"],
            resultType: "fdc3.contact",
          },
        },
      },
    },
  }

  const mockApp2: DirectoryApp = {
    appId: "app-2",
    title: "Test App 2",
    type: "web",
    details: {
      url: "https://example.com/app2",
    },
    interop: {
      intents: {
        listensFor: {
          "ViewChart": {
            contexts: ["fdc3.instrument"],
          },
        },
      },
    },
  }

  const mockApp3: DirectoryApp = {
    appId: "app-3",
    title: "Test App 3",
    type: "native",
    details: {
      path: "/usr/bin/app3",
    },
    interop: {
      intents: {
        listensFor: {
          "ViewContact": {
            contexts: ["fdc3.contact", "fdc3.instrument"],
            resultType: "fdc3.contact",
          },
        },
      },
    },
  }

  beforeEach(() => {
    directory = new AppDirectoryManager()
  })

  describe("Constructor", () => {
    it("should create an empty directory", () => {
      expect(directory.allApps).toEqual([])
      expect(directory.retrieveAllApps()).toEqual([])
    })
  })

  describe("add()", () => {
    it("should add a single app", () => {
      directory.add(mockApp1)
      expect(directory.allApps).toHaveLength(1)
      expect(directory.allApps[0]).toEqual(mockApp1)
    })

    it("should allow adding duplicate appIds (no validation)", () => {
      directory.add(mockApp1)
      directory.add(mockApp1)
      expect(directory.allApps).toHaveLength(2)
    })
  })

  describe("addApplications()", () => {
    it("should add apps from array format", () => {
      directory.addApplications([mockApp1, mockApp2])
      expect(directory.allApps).toHaveLength(2)
      expect(directory.retrieveAppsById("app-1")).toHaveLength(1)
      expect(directory.retrieveAppsById("app-2")).toHaveLength(1)
    })

    it("should add apps from DirectoryData format", () => {
      const data: DirectoryData = {
        applications: [mockApp1, mockApp2],
      }
      directory.addApplications(data)
      expect(directory.allApps).toHaveLength(2)
    })

    it("should prevent duplicates by appId", () => {
      directory.add(mockApp1)
      directory.addApplications([mockApp1, mockApp2])
      expect(directory.allApps).toHaveLength(2) // app-1 already exists
      expect(directory.retrieveAppsById("app-1")).toHaveLength(1)
      expect(directory.retrieveAppsById("app-2")).toHaveLength(1)
    })

    it("should validate required fields", () => {
      const invalidApp = {
        appId: "invalid",
        // Missing title, type, details
      } as DirectoryApp

      expect(() => {
        directory.addApplications([invalidApp])
      }).toThrow("missing required fields")
    })

    it("should throw error for invalid data format", () => {
      expect(() => {
        directory.addApplications({ invalid: "data" } as unknown as DirectoryData)
      }).toThrow("Invalid data format")
    })
  })

  describe("retrieveAllApps()", () => {
    it("should return all apps", () => {
      directory.add(mockApp1)
      directory.add(mockApp2)
      const apps = directory.retrieveAllApps()
      expect(apps).toHaveLength(2)
      expect(apps).toContainEqual(mockApp1)
      expect(apps).toContainEqual(mockApp2)
    })

    it("should return a copy of the array", () => {
      directory.add(mockApp1)
      const apps = directory.retrieveAllApps()
      apps.push(mockApp2)
      expect(directory.allApps).toHaveLength(1) // Original unchanged
    })
  })

  describe("retrieveAppsById()", () => {
    beforeEach(() => {
      directory.add(mockApp1)
      directory.add(mockApp2)
    })

    it("should return apps with matching appId", () => {
      const apps = directory.retrieveAppsById("app-1")
      expect(apps).toHaveLength(1)
      expect(apps[0]).toEqual(mockApp1)
    })

    it("should return empty array for non-existent appId", () => {
      const apps = directory.retrieveAppsById("non-existent")
      expect(apps).toHaveLength(0)
    })
  })

  describe("retrieveApps()", () => {
    beforeEach(() => {
      directory.add(mockApp1) // ViewContact, fdc3.contact
      directory.add(mockApp2) // ViewChart, fdc3.instrument
      directory.add(mockApp3) // ViewContact, fdc3.contact + fdc3.instrument
    })

    it("should return all apps when no filters provided", () => {
      const apps = directory.retrieveApps(undefined, undefined, undefined)
      expect(apps).toHaveLength(3)
    })

    it("should filter by contextType", () => {
      const apps = directory.retrieveApps("fdc3.contact", undefined, undefined)
      expect(apps).toHaveLength(2) // app-1 and app-3
      expect(apps.map(a => a.appId)).toContain("app-1")
      expect(apps.map(a => a.appId)).toContain("app-3")
    })

    it("should filter by intentName", () => {
      const apps = directory.retrieveApps(undefined, "ViewContact", undefined)
      expect(apps).toHaveLength(2) // app-1 and app-3
      expect(apps.map(a => a.appId)).toContain("app-1")
      expect(apps.map(a => a.appId)).toContain("app-3")
    })

    it("should filter by resultType", () => {
      const apps = directory.retrieveApps(undefined, undefined, "fdc3.contact")
      expect(apps).toHaveLength(2) // app-1 and app-3
    })

    it("should filter by multiple criteria", () => {
      const apps = directory.retrieveApps("fdc3.contact", "ViewContact", "fdc3.contact")
      expect(apps).toHaveLength(2) // app-1 and app-3
    })

    it("should return empty array when no apps match", () => {
      const apps = directory.retrieveApps("fdc3.nonexistent", undefined, undefined)
      expect(apps).toHaveLength(0)
    })
  })

  describe("retrieveAllIntents()", () => {
    beforeEach(() => {
      directory.add(mockApp1)
      directory.add(mockApp2)
      directory.add(mockApp3)
    })

    it("should return all intents from all apps", () => {
      const intents = directory.retrieveAllIntents()
      expect(intents.length).toBeGreaterThan(0)
      expect(intents.some(i => i.intentName === "ViewContact")).toBe(true)
      expect(intents.some(i => i.intentName === "ViewChart")).toBe(true)
    })

    it("should include appId in each intent", () => {
      const intents = directory.retrieveAllIntents()
      intents.forEach(intent => {
        expect(intent.appId).toBeDefined()
        expect(intent.intentName).toBeDefined()
        expect(intent.contexts).toBeDefined()
      })
    })
  })

  describe("retrieveIntents()", () => {
    beforeEach(() => {
      directory.add(mockApp1) // ViewContact, fdc3.contact
      directory.add(mockApp2) // ViewChart, fdc3.instrument
      directory.add(mockApp3) // ViewContact, fdc3.contact + fdc3.instrument
    })

    it("should return all intents when no filters provided", () => {
      const intents = directory.retrieveIntents(undefined, undefined, undefined)
      expect(intents.length).toBeGreaterThan(0)
    })

    it("should filter by contextType", () => {
      const intents = directory.retrieveIntents("fdc3.contact", undefined, undefined)
      expect(intents.length).toBeGreaterThan(0)
      intents.forEach(intent => {
        expect(intent.contexts).toContain("fdc3.contact")
      })
    })

    it("should filter by intentName", () => {
      const intents = directory.retrieveIntents(undefined, "ViewContact", undefined)
      expect(intents.length).toBe(2) // From app-1 and app-3
      intents.forEach(intent => {
        expect(intent.intentName).toBe("ViewContact")
      })
    })

    it("should filter by resultType", () => {
      const intents = directory.retrieveIntents(undefined, undefined, "fdc3.contact")
      expect(intents.length).toBe(2) // From app-1 and app-3
      intents.forEach(intent => {
        expect(intent.resultType).toBe("fdc3.contact")
      })
    })

    it("should filter by multiple criteria", () => {
      const intents = directory.retrieveIntents("fdc3.contact", "ViewContact", "fdc3.contact")
      expect(intents.length).toBe(2)
      intents.forEach(intent => {
        expect(intent.intentName).toBe("ViewContact")
        expect(intent.contexts).toContain("fdc3.contact")
        expect(intent.resultType).toBe("fdc3.contact")
      })
    })
  })

  describe("retrieveAppsByUrl()", () => {
    beforeEach(() => {
      directory.add(mockApp1)
      directory.add(mockApp2)
      directory.add(mockApp3) // native app, no URL
    })

    it("should return web apps matching URL", () => {
      const apps = directory.retrieveAppsByUrl("https://example.com/app1")
      expect(apps).toHaveLength(1)
      expect(apps[0].appId).toBe("app-1")
    })

    it("should return empty array for non-matching URL", () => {
      const apps = directory.retrieveAppsByUrl("https://example.com/nonexistent")
      expect(apps).toHaveLength(0)
    })

    it("should return empty array for invalid input", () => {
      expect(directory.retrieveAppsByUrl("")).toHaveLength(0)
      expect(directory.retrieveAppsByUrl(null as unknown as string)).toHaveLength(0)
    })
  })

  describe("URL Management", () => {
    it("should add directory URL", () => {
      directory.addDirectoryUrl("https://example.com/v2/apps")
      expect(directory.getDirectoryUrls()).toContain("https://example.com/v2/apps")
    })

    it("should not add duplicate URLs", () => {
      directory.addDirectoryUrl("https://example.com/v2/apps")
      directory.addDirectoryUrl("https://example.com/v2/apps")
      expect(directory.getDirectoryUrls()).toHaveLength(1)
    })

    it("should remove directory URL", () => {
      directory.addDirectoryUrl("https://example.com/v2/apps")
      directory.removeDirectoryUrl("https://example.com/v2/apps")
      expect(directory.getDirectoryUrls()).toHaveLength(0)
    })

    it("should clear all directory URLs", () => {
      directory.addDirectoryUrl("https://example.com/v2/apps")
      directory.addDirectoryUrl("https://example2.com/v2/apps")
      directory.clearDirectoryUrls()
      expect(directory.getDirectoryUrls()).toHaveLength(0)
    })

    it("should throw error for invalid URL", () => {
      expect(() => {
        directory.addDirectoryUrl("not-a-url")
      }).toThrow("Invalid directory URL")
    })

    it("should throw error for non-http/https URL", () => {
      expect(() => {
        directory.addDirectoryUrl("ftp://example.com")
      }).toThrow("Invalid directory URL")
    })
  })

  describe("loadDirectory()", () => {
    it("should load apps from REST endpoint", async () => {
      const mockApps: DirectoryApp[] = [mockApp1, mockApp2]
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockApps),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await directory.loadDirectory("https://example.com/v2/apps")

      expect(directory.allApps).toHaveLength(2)
      expect(directory.getDirectoryUrls()).toContain("https://example.com/v2/apps")
    })

    it("should handle DirectoryData format", async () => {
      const mockData: DirectoryData = {
        applications: [mockApp1, mockApp2],
      }
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await directory.loadDirectory("https://example.com/v2/apps")

      expect(directory.allApps).toHaveLength(2)
    })

    it("should prevent duplicate apps", async () => {
      directory.add(mockApp1)
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockApp1, mockApp2]),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await directory.loadDirectory("https://example.com/v2/apps")

      expect(directory.allApps).toHaveLength(2) // app-1 already existed
    })

    it("should normalize URL to /v2/apps endpoint", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await directory.loadDirectory("https://example.com")

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v2/apps")
      )
    })

    it("should throw error on fetch failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

      await expect(
        directory.loadDirectory("https://example.com/v2/apps")
      ).rejects.toThrow("Failed to load applications")
    })

    it("should throw error on HTTP error response", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await expect(
        directory.loadDirectory("https://example.com/v2/apps")
      ).rejects.toThrow("Failed to fetch")
    })
  })

  describe("replace()", () => {
    beforeEach(() => {
      directory.add(mockApp1)
    })

    it("should clear existing apps and load from URLs", async () => {
      const mockApps = [mockApp2, mockApp3]
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockApps),
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      await directory.replace(["https://example.com/v2/apps"])

      expect(directory.allApps).toHaveLength(2)
      expect(directory.allApps.map(a => a.appId)).not.toContain("app-1")
      expect(directory.getDirectoryUrls()).toEqual(["https://example.com/v2/apps"])
    })

    it("should handle empty URLs array", async () => {
      await directory.replace([])
      expect(directory.allApps).toHaveLength(0)
      expect(directory.getDirectoryUrls()).toHaveLength(0)
    })

    it("should load from multiple URLs in parallel", async () => {
      const mockResponse1 = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockApp1]),
      }
      const mockResponse2 = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockApp2]),
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)

      await directory.replace([
        "https://example.com/v2/apps",
        "https://example2.com/v2/apps",
      ])

      expect(directory.allApps.length).toBeGreaterThanOrEqual(2)
    })

    it("should throw error for invalid URLs", async () => {
      await expect(
        directory.replace(["not-a-url"])
      ).rejects.toThrow("Invalid directory URLs")
    })

    it("should throw error if urls is not an array", async () => {
      await expect(
        directory.replace("not-an-array" as unknown as string[])
      ).rejects.toThrow("URLs must be an array")
    })
  })

  describe("isValidDirectoryUrl()", () => {
    it("should validate http URLs", () => {
      expect(isValidDirectoryUrl("http://example.com")).toBe(true)
    })

    it("should validate https URLs", () => {
      expect(isValidDirectoryUrl("https://example.com")).toBe(true)
    })

    it("should reject non-http/https URLs", () => {
      expect(isValidDirectoryUrl("ftp://example.com")).toBe(false)
      expect(isValidDirectoryUrl("file:///path")).toBe(false)
    })

    it("should reject invalid URLs", () => {
      expect(isValidDirectoryUrl("not-a-url")).toBe(false)
      expect(isValidDirectoryUrl("")).toBe(false)
    })
  })
})
