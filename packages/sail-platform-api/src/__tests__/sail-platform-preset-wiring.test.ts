/**
 * Verifies SailPlatform delegates browser Desktop Agent wiring to the top-level preset.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest"
import * as sailDesktopAgent from "@finos/sail-desktop-agent"
import * as sailDesktopAgentPresets from "@finos/sail-desktop-agent/presets"
import { SailPlatform } from "../sail-platform"

describe("SailPlatform preset wiring", () => {
  const mockStop = vi.fn()
  const mockDesktopAgent = {
    getUserChannels: vi.fn(() => []),
    getAppUserChannelId: vi.fn(() => null),
    stop: mockStop,
  }
  const mockWcpConnector = {
    on: vi.fn(),
    off: vi.fn(),
  }
  const mockConnectorTransport = {
    send: vi.fn(),
  }

  let createBrowserDesktopAgentSpy: MockInstance
  let getBrowserDesktopAgentSessionSpy: MockInstance

  beforeEach(() => {
    createBrowserDesktopAgentSpy = vi
      .spyOn(sailDesktopAgent, "createBrowserDesktopAgent")
      .mockReturnValue(mockDesktopAgent as unknown as sailDesktopAgent.DesktopAgent)
    getBrowserDesktopAgentSessionSpy = vi
      .spyOn(sailDesktopAgentPresets, "getBrowserDesktopAgentSession")
      .mockReturnValue({
        wcpConnector:
          mockWcpConnector as unknown as import("@finos/sail-desktop-agent/presets").WCPConnector,
        connectorTransport: mockConnectorTransport as unknown as sailDesktopAgent.Transport,
      })
  })

  afterEach(() => {
    createBrowserDesktopAgentSpy.mockRestore()
    getBrowserDesktopAgentSessionSpy.mockRestore()
    vi.clearAllMocks()
  })

  it("delegates start() to createBrowserDesktopAgent with Sail host options", () => {
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

    expect(createBrowserDesktopAgentSpy).toHaveBeenCalledOnce()
    const createOptions = createBrowserDesktopAgentSpy.mock.calls[0]?.[0] as Parameters<
      typeof sailDesktopAgent.createBrowserDesktopAgent
    >[0]
    expect(createOptions).toMatchObject({
      appLauncher,
      apps,
      userChannels: undefined,
      implementationMetadata: undefined,
      openContextListenerTimeoutMs: 4000,
      heartbeatIntervalMs: 15000,
      heartbeatTimeoutMs: 45000,
      intentResolver,
      wcpOptions: {
        fdc3Version: "2.2",
      },
    })
    expect(typeof createOptions.wcpOptions?.getIntentResolverUrl).toBe("function")
    expect(typeof createOptions.wcpOptions?.getChannelSelectorUrl).toBe("function")
    expect(getBrowserDesktopAgentSessionSpy).toHaveBeenCalledWith(mockDesktopAgent)
    expect(platform.isRunning).toBe(true)
    expect(platform.agent).toBe(mockDesktopAgent)
    expect(platform.connector).toBe(mockWcpConnector)
  })

  it("stop() delegates to the preset agent stop()", () => {
    const platform = new SailPlatform({
      appLauncher: { launch: vi.fn() },
    })

    platform.start()
    platform.stop()

    expect(mockStop).toHaveBeenCalledOnce()
    expect(platform.isRunning).toBe(false)
  })
})
