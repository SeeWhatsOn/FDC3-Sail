import { describe, expect, it, vi } from "vite-plus/test"

import {
  closeHarnessBrowsingContext,
  collectHarnessCloseInstanceIds,
  tryCloseBrowsingContext,
} from "./harness-browsing-context-close"
import { createPopupCloseWatcher } from "./popup-launcher"

describe("tryCloseBrowsingContext", () => {
  it("returns true when window is already closed", () => {
    expect(tryCloseBrowsingContext({ closed: true } as Window, "gone")).toBe(true)
  })

  it("returns true when window.close succeeds", () => {
    const popup = { closed: false } as Window
    const close = vi.fn(() => {
      Object.defineProperty(popup, "closed", { value: true, configurable: true })
    })
    Object.assign(popup, { close })

    expect(tryCloseBrowsingContext(popup, "instance-1")).toBe(true)
    expect(close).toHaveBeenCalledOnce()
  })
})

describe("closeHarnessBrowsingContext", () => {
  it("falls back to WCP source window when popup registry misses the instance id", () => {
    const popup = { closed: false } as Window
    const close = vi.fn(() => {
      Object.defineProperty(popup, "closed", { value: true, configurable: true })
    })
    Object.assign(popup, { close })

    const desktopAgent = {
      apps: {
        getConnections: () => [
          {
            instanceId: "canonical-id",
            appId: "MockApp",
            source: popup,
          },
        ],
        getInstances: () => [],
        getConnection: () => undefined,
      },
    }

    const watcher = createPopupCloseWatcher({ onPopupClosed: vi.fn() })

    expect(
      closeHarnessBrowsingContext({
        instanceId: "canonical-id",
        desktopAgent: desktopAgent as never,
        popupWatcher: watcher,
      }),
    ).toBe(true)

    watcher.stop()
  })

  it("collects connected instance ids for close attempts", () => {
    const desktopAgent = {
      apps: {
        getConnections: () => [{ instanceId: "launcher-id", appId: "MockApp" }],
        getInstances: () => [{ instanceId: "launcher-id", appId: "MockApp", status: "connected" }],
        getConnection: () => undefined,
      },
    }

    expect(collectHarnessCloseInstanceIds(desktopAgent as never, "launcher-id")).toEqual([
      "launcher-id",
    ])
  })
})
