import { afterEach, describe, expect, it, vi } from "vitest"
import type { DirectoryApp } from "../DirectoryInterface"
import {
  fetchAppDirectory,
  isValidDirectoryUrl,
  loadLocalDirectoryData,
  mergeAppsWithoutDuplicates,
  parseDirectoryData,
  validateApplication,
  validateApplications,
} from "../fetch-app-directory"

const validApp: DirectoryApp = {
  appId: "app-1",
  title: "Test App",
  type: "web",
  details: { url: "https://example.com/app" },
}

describe("parseDirectoryData", () => {
  it("accepts a bare applications array", () => {
    expect(parseDirectoryData([validApp])).toEqual([validApp])
  })

  it("accepts a DirectoryData wrapper", () => {
    expect(parseDirectoryData({ applications: [validApp] })).toEqual([validApp])
  })

  it("rejects invalid shapes", () => {
    expect(() => parseDirectoryData({} as never)).toThrow(/Invalid data format/)
  })
})

describe("validateApplication / validateApplications", () => {
  it("accepts apps with required fields", () => {
    expect(() => validateApplication(validApp)).not.toThrow()
    expect(() => validateApplications([validApp])).not.toThrow()
  })

  it("rejects apps missing required fields", () => {
    expect(() =>
      validateApplication({ appId: "x" } as DirectoryApp, "fixture"),
    ).toThrow(/missing required fields/)
  })

  it("accepts apps that only have name (fills title from name)", () => {
    const app = {
      appId: "MockAppId",
      name: "MockApp",
      type: "web",
      details: { url: "https://example.com/mock" },
    } as DirectoryApp
    expect(() => validateApplication(app)).not.toThrow()
    expect(app.title).toBe("MockApp")
  })
})

describe("isValidDirectoryUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isValidDirectoryUrl("https://example.com/appd")).toBe(true)
    expect(isValidDirectoryUrl("http://localhost:3000/v2/apps")).toBe(true)
  })

  it("rejects non-http URLs and garbage", () => {
    expect(isValidDirectoryUrl("file:///tmp/apps.json")).toBe(false)
    expect(isValidDirectoryUrl("not-a-url")).toBe(false)
  })
})

describe("loadLocalDirectoryData", () => {
  it("parses and validates local FDC3-shaped JSON", () => {
    expect(loadLocalDirectoryData({ applications: [validApp] })).toEqual([
      validApp,
    ])
  })

  it("throws when local data fails validation", () => {
    expect(() =>
      loadLocalDirectoryData([{ appId: "bad" } as DirectoryApp]),
    ).toThrow(/missing required fields/)
  })
})

describe("mergeAppsWithoutDuplicates", () => {
  it("keeps first appId and appends new ones", () => {
    const other: DirectoryApp = {
      ...validApp,
      appId: "app-2",
      title: "Other",
    }
    const duplicate: DirectoryApp = {
      ...validApp,
      title: "Duplicate title ignored",
    }
    expect(mergeAppsWithoutDuplicates([validApp], [duplicate, other])).toEqual([
      validApp,
      other,
    ])
  })
})

describe("fetchAppDirectory", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("normalizes base URLs to /v2/apps and returns validated apps", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ applications: [validApp] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const apps = await fetchAppDirectory("https://example.com/appd")
    expect(apps).toEqual([validApp])
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/appd/v2/apps")
  })

  it("does not double-append /v2/apps", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [validApp],
    })
    vi.stubGlobal("fetch", fetchMock)

    await fetchAppDirectory("https://example.com/appd/v2/apps")
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/appd/v2/apps")
  })

  it("does not double-append /v2/apps when the URL has a trailing slash", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [validApp],
    })
    vi.stubGlobal("fetch", fetchMock)

    await fetchAppDirectory("https://directory.fdc3.finos.org/v2/apps/")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://directory.fdc3.finos.org/v2/apps",
    )
  })

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    )
    await expect(fetchAppDirectory("https://example.com/appd")).rejects.toThrow(
      /Failed to fetch/,
    )
  })

  it("fetches static .json directory URLs without appending /v2/apps", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ applications: [validApp] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const url = "http://localhost:3001/directories/localhost-conformance.json"
    const apps = await fetchAppDirectory(url)
    expect(apps).toEqual([validApp])
    expect(fetchMock).toHaveBeenCalledWith(url)
  })

  it("keeps valid apps when one incomplete entry is present", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        applications: [
          validApp,
          { appId: "broken" } as DirectoryApp,
          {
            appId: "MockAppId",
            name: "MockApp",
            type: "web",
            details: { url: "https://example.com/mock" },
          } as DirectoryApp,
        ],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const apps = await fetchAppDirectory(
      "http://localhost:3001/directories/localhost-conformance.json",
    )
    expect(apps.map((a) => a.appId)).toEqual(["app-1", "MockAppId"])
    expect(apps[1].title).toBe("MockApp")
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
