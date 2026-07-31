import { beforeEach, describe, expect, it } from "vitest"
import type { DirectoryApp } from "@finos/sail-desktop-agent"
import { LocalStorageClientState } from "../ClientState"
import { installLocalStorage } from "./localStorageMock"

const STORAGE_KEY = "sail-client-state"

describe("LocalStorageClientState", () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it("loads default tabs and FINOS directory when storage is empty", () => {
    const state = new LocalStorageClientState()

    expect(state.getTabs()).toHaveLength(3)
    expect(state.getActiveTab().id).toBe("One")
    expect(state.getDirectories()).toEqual([
      {
        label: "FINOS FDC3 Directory",
        url: "https://directory.fdc3.finos.org/v2/apps",
        active: true,
      },
    ])
    expect(state.getUserSessionID()).toMatch(/^user-/)
  })

  it("createArgs only includes active directory URLs", async () => {
    const state = new LocalStorageClientState()
    await state.setDirectories([
      {
        label: "Active",
        url: "https://example.com/v2/apps",
        active: true,
      },
      {
        label: "Inactive",
        url: "https://other.example/v2/apps",
        active: false,
      },
    ])

    expect(state.createArgs().directories).toEqual([
      "https://example.com/v2/apps",
    ])
  })

  it("persists custom apps into createArgs and localStorage", async () => {
    const customApps: DirectoryApp[] = [
      {
        appId: "demo",
        name: "Demo",
        title: "Demo",
        type: "web",
        details: { url: "https://app.example/" },
      } as DirectoryApp,
    ]
    const state = new LocalStorageClientState()
    await state.setCustomApps(customApps)

    expect(state.createArgs().customApps).toEqual(customApps)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.customApps).toEqual(customApps)
  })

  it("rehydrates from localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tabs: [
          {
            id: "Saved",
            icon: "/icons/tabs/noun-airplane-3707662.svg",
            background: "#0061F2",
          },
        ],
        panels: [],
        activeTabId: "Saved",
        userSessionId: "user-fixed",
        directories: [
          {
            label: "Local",
            url: "https://local.example/v2/apps",
            active: true,
          },
        ],
        customApps: [],
      }),
    )

    const state = new LocalStorageClientState()
    expect(state.getUserSessionID()).toBe("user-fixed")
    expect(state.getActiveTab().id).toBe("Saved")
    expect(state.getDirectories()[0].url).toBe("https://local.example/v2/apps")
  })
})
