import { describe, it, expect, vi } from "vitest"
import { createInitialState } from "../../initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import {
  addApplication,
  addApplications,
  addDirectoryUrl,
  removeDirectoryUrl,
  clearDirectoryUrls,
  loadDirectoryIntoState,
  replaceAppDirectories,
} from "../app-directory"
import { getDirectoryUrls } from "../../../app-directory/app-directory-queries"
import { isValidDirectoryUrl } from "../../../app-directory/fetch-app-directory"
import type { DirectoryApp, DirectoryData } from "../../../app-directory/types"
import {
  mockApp1,
  mockApp2,
  mockApp3,
} from "../../../app-directory/__tests__/app-directory-test-fixtures"

function baseState() {
  return createInitialState(DEFAULT_FDC3_USER_CHANNELS)
}

describe("app-directory mutators", () => {
  describe("addApplication()", () => {
    it("should add a single app", () => {
      const next = addApplication(baseState(), mockApp1)
      expect(next.appDirectory.apps).toHaveLength(1)
      expect(next.appDirectory.apps[0]).toEqual(mockApp1)
    })

    it("should allow adding duplicate appIds (no validation)", () => {
      let state = addApplication(baseState(), mockApp1)
      state = addApplication(state, mockApp1)
      expect(state.appDirectory.apps).toHaveLength(2)
    })
  })

  describe("addApplications()", () => {
    it("should add apps from array format", () => {
      const state = addApplications(baseState(), [mockApp1, mockApp2])
      expect(state.appDirectory.apps).toHaveLength(2)
    })

    it("should add apps from DirectoryData format", () => {
      const data: DirectoryData = { applications: [mockApp1, mockApp2] }
      expect(addApplications(baseState(), data).appDirectory.apps).toHaveLength(2)
    })

    it("should prevent duplicates by appId", () => {
      let state = addApplication(baseState(), mockApp1)
      state = addApplications(state, [mockApp1, mockApp2])
      expect(state.appDirectory.apps).toHaveLength(2)
    })

    it("should validate required fields", () => {
      const invalidApp = { appId: "invalid" } as DirectoryApp
      expect(() => addApplications(baseState(), [invalidApp])).toThrow("missing required fields")
    })

    it("should throw error for invalid data format", () => {
      expect(() =>
        addApplications(baseState(), { invalid: "data" } as unknown as DirectoryData)
      ).toThrow("Invalid data format")
    })
  })

  describe("URL management", () => {
    it("should add directory URL", () => {
      const url = "https://example.com/v2/apps"
      const state = addDirectoryUrl(baseState(), url)
      expect(getDirectoryUrls(state.appDirectory)).toContain(url)
    })

    it("should not add duplicate URLs", () => {
      const url = "https://example.com/v2/apps"
      let state = addDirectoryUrl(baseState(), url)
      state = addDirectoryUrl(state, url)
      expect(getDirectoryUrls(state.appDirectory)).toHaveLength(1)
    })

    it("should remove directory URL", () => {
      const url = "https://example.com/v2/apps"
      let state = addDirectoryUrl(baseState(), url)
      state = removeDirectoryUrl(state, url)
      expect(getDirectoryUrls(state.appDirectory)).toHaveLength(0)
    })

    it("should clear all directory URLs", () => {
      let state = addDirectoryUrl(baseState(), "https://example.com/v2/apps")
      state = addDirectoryUrl(state, "https://example2.com/v2/apps")
      state = clearDirectoryUrls(state)
      expect(getDirectoryUrls(state.appDirectory)).toHaveLength(0)
    })

    it("should throw error for invalid URL", () => {
      expect(() => addDirectoryUrl(baseState(), "not-a-url")).toThrow("Invalid directory URL")
    })

    it("should throw error for non-http/https URL", () => {
      expect(() => addDirectoryUrl(baseState(), "ftp://example.com")).toThrow(
        "Invalid directory URL"
      )
    })
  })

  describe("loadDirectoryIntoState()", () => {
    it("should load apps from REST endpoint", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([mockApp1, mockApp2]),
      })

      const state = await loadDirectoryIntoState(baseState(), "https://example.com/v2/apps")
      expect(state.appDirectory.apps).toHaveLength(2)
      expect(state.appDirectory.directoryUrls).toContain("https://example.com/v2/apps")
    })

    it("should handle DirectoryData format", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ applications: [mockApp1, mockApp2] }),
      })

      const state = await loadDirectoryIntoState(baseState(), "https://example.com/v2/apps")
      expect(state.appDirectory.apps).toHaveLength(2)
    })

    it("should prevent duplicate apps", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([mockApp1, mockApp2]),
      })

      let state = addApplication(baseState(), mockApp1)
      state = await loadDirectoryIntoState(state, "https://example.com/v2/apps")
      expect(state.appDirectory.apps).toHaveLength(2)
    })

    it("should normalize URL to /v2/apps endpoint", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      })

      await loadDirectoryIntoState(baseState(), "https://example.com")
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/v2/apps"))
    })

    it("should throw error on fetch failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))
      await expect(
        loadDirectoryIntoState(baseState(), "https://example.com/v2/apps")
      ).rejects.toThrow("Failed to load applications")
    })

    it("should throw error on HTTP error response", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" })
      await expect(
        loadDirectoryIntoState(baseState(), "https://example.com/v2/apps")
      ).rejects.toThrow("Failed to fetch")
    })
  })

  describe("replaceAppDirectories()", () => {
    it("should clear existing apps and load from URLs", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([mockApp2, mockApp3]),
      })

      let state = addApplication(baseState(), mockApp1)
      state = await replaceAppDirectories(state, ["https://example.com/v2/apps"])

      expect(state.appDirectory.apps).toHaveLength(2)
      expect(state.appDirectory.apps.map(a => a.appId)).not.toContain("app-1")
      expect(state.appDirectory.directoryUrls).toEqual(["https://example.com/v2/apps"])
    })

    it("should handle empty URLs array", async () => {
      let state = addApplication(baseState(), mockApp1)
      state = await replaceAppDirectories(state, [])
      expect(state.appDirectory.apps).toHaveLength(0)
      expect(state.appDirectory.directoryUrls).toHaveLength(0)
    })

    it("should load from multiple URLs in parallel", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([mockApp1]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([mockApp2]),
        })

      const state = await replaceAppDirectories(baseState(), [
        "https://example.com/v2/apps",
        "https://example2.com/v2/apps",
      ])
      expect(state.appDirectory.apps.length).toBeGreaterThanOrEqual(2)
    })

    it("should throw error for invalid URLs", async () => {
      await expect(replaceAppDirectories(baseState(), ["not-a-url"])).rejects.toThrow(
        "Invalid directory URLs"
      )
    })

    it("should throw error if urls is not an array", async () => {
      await expect(
        replaceAppDirectories(baseState(), "not-an-array" as unknown as string[])
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
