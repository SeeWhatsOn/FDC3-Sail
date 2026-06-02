/**
 * Verifies SailPlatform delegates browser Desktop Agent wiring to the top-level preset.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as sailDesktopAgent from "@finos/sail-desktop-agent"
import { SailPlatform } from "../sail-platform"

describe("SailPlatform preset wiring", () => {
  const mockStart = vi.fn()
  const mockStop = vi.fn()
  const mockDesktopAgent = {
    getUserChannels: vi.fn(() => []),
    getAppUserChannelId: vi.fn(() => null),
  }
  const mockWcpConnector = {
    on: vi.fn(),
    off: vi.fn(),
  }
  const mockConnectorTransport = {
    send: vi.fn(),
  }

  let createBrowserDesktopAgentSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createBrowserDesktopAgentSpy = vi.spyOn(sailDesktopAgent, "createBrowserDesktopAgent").mockReturnValue({
      desktopAgent: mockDesktopAgent as unknown as sailDesktopAgent.DesktopAgent,
      wcpConnector: mockWcpConnector as unknown as import("@finos/sail-desktop-agent/browser").WCPConnector,
      connectorTransport: mockConnectorTransport as unknown as sailDesktopAgent.Transport,
      start: mockStart,
      stop: mockStop,
    })
  })

  afterEach(() => {
    createBrowserDesktopAgentSpy.mockRestore()
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
    expect(createBrowserDesktopAgentSpy).toHaveBeenCalledWith({
      appLauncher,
      apps,
      userChannels: undefined,
      implementationMetadata: undefined,
      openContextListenerTimeoutMs: 4000,
      heartbeatIntervalMs: 15000,
      heartbeatTimeoutMs: 45000,
      intentResolver,
      wcpOptions: {
        getIntentResolverUrl: expect.any(Function),
        getChannelSelectorUrl: expect.any(Function),
        fdc3Version: "2.2",
      },
    })
    expect(mockStart).toHaveBeenCalledOnce()
    expect(platform.isRunning).toBe(true)
    expect(platform.agent).toBe(mockDesktopAgent)
    expect(platform.connector).toBe(mockWcpConnector)
  })

  it("stop() delegates to the preset session stop()", () => {
    const platform = new SailPlatform({
      appLauncher: { launch: vi.fn() },
    })

    platform.start()
    platform.stop()

    expect(mockStop).toHaveBeenCalledOnce()
    expect(platform.isRunning).toBe(false)
  })
})
