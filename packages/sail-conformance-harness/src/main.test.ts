/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import * as sailDesktopAgent from "@finos/sail-desktop-agent"
import { resolveDesktopAgentConfig, SailDesktopAgent } from "@finos/sail-desktop-agent"

import { createHarnessBootstrap, getConformance1PanelState } from "./harness-bootstrap"
import { createPopupCloseWatcher } from "./popup-launcher"

describe("createHarnessBootstrap", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates DesktopAgent with heartbeatEnabled false in resolved config", () => {
    const OriginalSailDesktopAgent = sailDesktopAgent.SailDesktopAgent
    let capturedOptions: sailDesktopAgent.SailDesktopAgentOptions | undefined
    const constructorSpy = vi
      .spyOn(sailDesktopAgent, "SailDesktopAgent")
      .mockImplementation(function (options) {
        capturedOptions = options
        return new OriginalSailDesktopAgent(options)
      })
    const bootstrap = createHarnessBootstrap({ debug: false })
    try {
      expect(constructorSpy).toHaveBeenCalledOnce()
      const resolved = resolveDesktopAgentConfig(capturedOptions ?? {})
      expect(resolved.heartbeatEnabled).toBe(false)
    } finally {
      bootstrap.desktopAgent.stop()
    }
  })

  it("bootstraps a started SailDesktopAgent with Conformance1 pre-registered as pending", () => {
    const bootstrap = createHarnessBootstrap({ debug: false })
    try {
      expect(bootstrap.desktopAgent).toBeInstanceOf(SailDesktopAgent)
      expect(bootstrap.desktopAgent.connector.getIsStarted()).toBe(true)
      expect(bootstrap.desktopAgent.apps.getById("Conformance1")).toBeDefined()

      const panelState = getConformance1PanelState(bootstrap)

      expect(panelState).toBeDefined()
      expect(panelState?.state).toBe("pending")

      const instance = bootstrap.desktopAgent.apps.getInstance(panelState!.instanceId)
      expect(instance?.appId).toBe("Conformance1")
      expect(instance?.status).toBe("pending")
    } finally {
      bootstrap.desktopAgent.stop()
    }
  })
})

describe("harness popup disconnect cleanup", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("disconnects agent instance when popup close watcher fires", () => {
    vi.useFakeTimers()

    const disconnectInstance = vi.fn()
    const popup = { closed: false } as Window

    const watcher = createPopupCloseWatcher({
      onPopupClosed: instanceId => {
        disconnectInstance(instanceId)
      },
      pollIntervalMs: 100,
    })

    watcher.registerPopup("popup-instance-1", popup)
    Object.defineProperty(popup, "closed", { value: true, configurable: true })

    vi.advanceTimersByTime(100)

    expect(disconnectInstance).toHaveBeenCalledWith("popup-instance-1")
    watcher.stop()
  })
})
