import { describe, expect, it, vi } from "vite-plus/test"
import type { DirectoryApp } from "@finos/sail-desktop-agent"

import { createHarnessAppLauncher, resolveHarnessLaunchMode } from "./app-launcher"
import { HARNESS_POPUP_FEATURES, openHarnessPopup } from "./popup-launcher"
import type { HarnessPanel } from "./types"

describe("resolveHarnessLaunchMode", () => {
  it("returns iframe when sail hostManifest omits forceNewWindow", () => {
    const app: DirectoryApp = {
      appId: "Conformance1",
      title: "Conformance1",
      type: "web",
      details: { url: "https://example.com/conformance1" },
    }

    expect(resolveHarnessLaunchMode(app)).toBe("iframe")
  })

  it("returns popup when hostManifests.sail.forceNewWindow is true", () => {
    const app: DirectoryApp = {
      appId: "ChannelsAppId",
      title: "Channels App",
      type: "web",
      details: { url: "https://example.com/channels" },
      hostManifests: {
        sail: {
          "inject-api": "2.0",
          forceNewWindow: true,
        },
      },
    }

    expect(resolveHarnessLaunchMode(app)).toBe("popup")
  })
})

describe("createHarnessAppLauncher", () => {
  it("always removes panel on close even when closePopup succeeds", async () => {
    const removePanel = vi.fn()
    const closePopup = vi.fn(() => true)
    const launcher = createHarnessAppLauncher(vi.fn(), { closePopup, removePanel })

    await launcher.close!("instance-1")

    expect(closePopup).toHaveBeenCalledWith("instance-1")
    expect(removePanel).toHaveBeenCalledWith("instance-1")
  })

  it("removes panel on close when closePopup is not configured", async () => {
    const removePanel = vi.fn()
    const launcher = createHarnessAppLauncher(vi.fn(), { removePanel })

    await launcher.close!("instance-2")

    expect(removePanel).toHaveBeenCalledWith("instance-2")
  })
})

describe("openHarnessPopup", () => {
  it("opens about:blank with popup features then navigates to the mock app URL", () => {
    const popup = {
      closed: false,
      location: { href: "about:blank" },
    } as Window
    const open = vi.fn(() => popup)
    vi.stubGlobal("window", { open })

    const panel: HarnessPanel = {
      instanceId: "popup-instance",
      appId: "MockApp",
      url: "https://example.com/mock",
      title: "Mock",
      launchMode: "popup",
    }

    const result = openHarnessPopup(panel)

    expect(result).toBe(popup)
    expect(open).toHaveBeenCalledWith("about:blank", panel.instanceId, HARNESS_POPUP_FEATURES)
    expect(popup.location.href).toBe(panel.url)

    vi.unstubAllGlobals()
  })
})
