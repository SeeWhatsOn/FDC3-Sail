import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { createPopupCloseWatcher } from "./popup-launcher"

function createMockPopup(closed = false): Window {
  return { closed } as Window
}

describe("createPopupCloseWatcher", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("calls onPopupClosed when a registered popup reports closed", () => {
    vi.useFakeTimers()

    const onPopupClosed = vi.fn<(instanceId: string) => void>()
    const watcher = createPopupCloseWatcher({
      onPopupClosed,
      pollIntervalMs: 100,
    })

    const popup = createMockPopup(false)
    watcher.registerPopup("instance-a", popup)

    Object.defineProperty(popup, "closed", { value: true, configurable: true })

    vi.advanceTimersByTime(100)

    expect(onPopupClosed).toHaveBeenCalledOnce()
    expect(onPopupClosed).toHaveBeenCalledWith("instance-a")
    expect(watcher.hasPopup("instance-a")).toBe(false)

    watcher.stop()
  })

  it("does not call onPopupClosed while the popup remains open", () => {
    vi.useFakeTimers()

    const onPopupClosed = vi.fn<(instanceId: string) => void>()
    const watcher = createPopupCloseWatcher({
      onPopupClosed,
      pollIntervalMs: 100,
    })

    watcher.registerPopup("instance-b", createMockPopup(false))

    vi.advanceTimersByTime(300)

    expect(onPopupClosed).not.toHaveBeenCalled()

    watcher.stop()
  })

  it("stops polling after unregisterPopup removes the last popup", () => {
    vi.useFakeTimers()

    const onPopupClosed = vi.fn<(instanceId: string) => void>()
    const watcher = createPopupCloseWatcher({
      onPopupClosed,
      pollIntervalMs: 100,
    })

    const popup = createMockPopup(false)
    watcher.registerPopup("instance-c", popup)
    watcher.unregisterPopup("instance-c")

    Object.defineProperty(popup, "closed", { value: true, configurable: true })

    vi.advanceTimersByTime(300)

    expect(onPopupClosed).not.toHaveBeenCalled()

    watcher.stop()
  })

  it("closePopup returns true when window.close succeeds", () => {
    const popup = createMockPopup(false)
    const close = vi.fn(() => {
      Object.defineProperty(popup, "closed", { value: true, configurable: true })
    })
    Object.assign(popup, { close })

    const watcher = createPopupCloseWatcher({ onPopupClosed: vi.fn() })
    watcher.registerPopup("instance-d", popup)

    expect(watcher.closePopup("instance-d")).toBe(true)
    expect(close).toHaveBeenCalledOnce()
  })

  it("closePopup returns false and warns when window.close has no effect", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const popup = createMockPopup(false)
    Object.assign(popup, { close: vi.fn() })

    const watcher = createPopupCloseWatcher({ onPopupClosed: vi.fn() })
    watcher.registerPopup("instance-e", popup)

    expect(watcher.closePopup("instance-e")).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      "[ConformanceHarness] Browsing context still open after close() for instance-e",
    )

    warnSpy.mockRestore()
    watcher.stop()
  })

  it("closePopup returns false when instance is not registered", () => {
    const watcher = createPopupCloseWatcher({ onPopupClosed: vi.fn() })
    expect(watcher.closePopup("missing-instance")).toBe(false)
    watcher.stop()
  })
})

describe("remapPopupByWindow", () => {
  it("re-keys popup so closePopup on canonical id closes the same browsing context", () => {
    let closed = false
    const close = vi.fn(() => {
      closed = true
    })
    const popup = {
      get closed() {
        return closed
      },
      close,
    } as unknown as Window

    const watcher = createPopupCloseWatcher({ onPopupClosed: vi.fn() })
    watcher.registerPopup("launcher-L", popup)

    expect(watcher.remapPopupByWindow(popup, "canonical-C")).toBe(true)
    expect(watcher.hasPopup("launcher-L")).toBe(false)
    expect(watcher.hasPopup("canonical-C")).toBe(true)

    expect(watcher.closePopup("canonical-C")).toBe(true)
    expect(close).toHaveBeenCalledOnce()

    watcher.stop()
  })

  it("leaves launcher id without a stale orphan after re-key", () => {
    const popup = createMockPopup(false)
    const watcher = createPopupCloseWatcher({ onPopupClosed: vi.fn() })
    watcher.registerPopup("launcher-L", popup)

    expect(watcher.remapPopupByWindow(popup, "canonical-C")).toBe(true)
    expect(watcher.closePopup("launcher-L")).toBe(false)
    expect(watcher.hasPopup("launcher-L")).toBe(false)

    watcher.stop()
  })

  it("returns false when source window is not registered", () => {
    const watcher = createPopupCloseWatcher({ onPopupClosed: vi.fn() })
    expect(watcher.remapPopupByWindow({ closed: false } as Window, "canonical-C")).toBe(false)
    watcher.stop()
  })
})
