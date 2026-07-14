import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DirectoryApp } from "@finos/sail-desktop-agent"
import { SailHost } from "../SailHost"
import { AppHosting } from "../DefaultAppState"
import type { SailClientStateArgs } from "../ClientState"
import { installLocalStorage } from "./localStorageMock"

function makeWebApp(appId: string, url: string): DirectoryApp {
  return {
    appId,
    name: appId,
    title: appId,
    type: "web",
    details: { url },
  } as DirectoryApp
}

function clientArgs(
  overrides: Partial<SailClientStateArgs> = {},
): SailClientStateArgs {
  return {
    userSessionId: "user-test",
    directories: [],
    channels: [
      {
        id: "One",
        icon: "/icons/tabs/noun-airplane-3707662.svg",
        background: "#0061F2",
      },
    ],
    panels: [],
    customApps: [makeWebApp("demo-app", "https://app.example/page")],
    ...overrides,
  }
}

describe("SailHost", () => {
  beforeEach(() => {
    installLocalStorage()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("unexpected fetch in smoke test"))),
    )
  })

  it("registerDesktopAgent exposes local custom apps via getKnownApps", async () => {
    const host = new SailHost()
    await host.registerDesktopAgent(clientArgs())

    const apps = host.getKnownApps()
    expect(apps.map((a) => a.appId)).toContain("demo-app")
  })

  it("registerAppLaunch returns a sail-app instance id after agent is registered", async () => {
    const host = new SailHost()
    await host.registerDesktopAgent(clientArgs())

    const instanceId = await host.registerAppLaunch(
      "demo-app",
      AppHosting.Frame,
      "One",
      "Demo 1",
    )

    expect(instanceId).toMatch(/^sail-app-/)
  })

  it("sendClientState syncs a new tab channel without throwing", async () => {
    const host = new SailHost()
    const initial = clientArgs()
    await host.registerDesktopAgent(initial)

    await host.sendClientState(
      clientArgs({
        channels: [
          ...initial.channels,
          {
            id: "Four",
            icon: "/icons/tabs/noun-console-3707664.svg",
            background: "#00A86B",
          },
        ],
      }),
    )

    await host.setUserChannel("inst-1", "Four")
  })

  it("registerAppLaunch throws before the desktop agent is registered", async () => {
    const host = new SailHost()
    await expect(
      host.registerAppLaunch("demo-app", AppHosting.Frame, null, "Demo"),
    ).rejects.toThrow("Desktop Agent not registered")
  })
})
