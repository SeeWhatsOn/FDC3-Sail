/**
 * Verifies SailPlatform owns a SailDesktopAgent browser instance.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vite-plus/test"
import { SailDesktopAgent } from "@finos/sail-desktop-agent"
import { SailPlatform } from "../sail-platform"

describe("SailPlatform desktop agent wiring", () => {
  it("starts a SailDesktopAgent with Sail host options", () => {
    const appLauncher = { launch: vi.fn() }
    const intentResolver = { resolve: vi.fn() }
    const apps = [
      {
        appId: "platform-app",
        title: "Platform App",
        type: "web" as const,
        details: { url: "https://example.com/app" },
      },
    ]

    const platform = new SailPlatform({
      appLauncher,
      intentResolver,
      apps,
      openContextListenerTimeoutMs: 4000,
      heartbeatIntervalMs: 15000,
      heartbeatTimeoutMs: 45000,
    })

    platform.start()

    expect(platform.isRunning).toBe(true)
    expect(platform.agent).toBeInstanceOf(SailDesktopAgent)
    expect(platform.connector).toBe((platform.agent as SailDesktopAgent).connector)
    expect(platform.apps.getById("platform-app")).toEqual(apps[0])

    platform.stop()
  })

  it("stop() delegates to the agent lifecycle", () => {
    const platform = new SailPlatform({
      appLauncher: { launch: vi.fn() },
    })

    platform.start()
    const agent = platform.agent
    const stopSpy = vi.spyOn(agent, "stop")

    platform.stop()

    expect(stopSpy).toHaveBeenCalledOnce()
    expect(platform.isRunning).toBe(false)
  })
})
