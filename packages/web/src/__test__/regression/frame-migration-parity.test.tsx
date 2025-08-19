import { describe, it, expect, beforeEach, vi } from "vitest"

import { render } from "@/__test__/utils/component-test-utils"

import { Frame } from "../../client/frame/frame"
import { useClientStore } from "../../stores/useClientStore"
import { useServerStore } from "../../stores/useServerStore"
import { mockGridStack } from "../utils/test-mocks"

// Mock GridStack to avoid complex UI library in tests
vi.mock("gridstack", () => ({
  GridStack: mockGridStack(),
}))

describe("Frame Modern Implementation Tests", () => {
  beforeEach(() => {
    // Set up consistent state for both implementations
    const testState = {
      activeTabId: "One",
      tabs: [
        { id: "One", icon: "/icons/tabs/one.svg", background: "#123456" },
        { id: "Two", icon: "/icons/tabs/two.svg", background: "#564312" },
      ],
      panels: [
        {
          panelId: "panel-1",
          tabId: "One",
          title: "Test App",
          url: "http://test.com",
          appId: "test-app",
          icon: "/test-icon.png",
          x: 0,
          y: 0,
          w: 6,
          h: 4,
        },
      ],
      directories: [],
      knownApps: [],
      customApps: [],
      intentResolution: null,
      contextHistory: { One: [{ type: "fdc3.instrument", id: { ticker: "AAPL" } }] },
      userSessionId: "test-user",
    }

    useClientStore.setState(testState)
    useServerStore.setState({
      socket: null,
      isConnected: false,
      connectionError: null,
      appStates: [],
    })
  })

  it("should render the expected DOM structure", () => {
    // Render modern Frame implementation (now consolidated)
    const result = render(<Frame />)
    const container = result.container

    // Should have the basic structure
    const outer = container.querySelector("[class*='outer']")
    expect(outer).toBeTruthy()

    // Should have top, left, and main sections
    const top = container.querySelector("[class*='top']")
    expect(top).toBeTruthy()

    const left = container.querySelector("[class*='left']")
    expect(left).toBeTruthy()

    const main = container.querySelector("[class*='main']")
    expect(main).toBeTruthy()

    // Should have modern testids
    expect(container.querySelector("[data-testid='frame-modern']")).toBeTruthy()
  })

  it("should apply active tab styling", () => {
    const result = render(<Frame />)
    const main = result.container.querySelector("[class*='main']")

    // Should have the border color from active tab
    expect(main).toHaveStyle("border: 1px solid #123456")
  })

  it("should handle state updates", () => {
    const result = render(<Frame />)

    // Change active tab
    useClientStore.getState().setActiveTabId("Two")

    // Re-render
    result.rerender(<Frame />)

    const main = result.container.querySelector("[class*='main']")

    // Should reflect the new tab color
    expect(main).toHaveStyle("border: 1px solid #564312")
  })

  it("should handle context history", () => {
    // Should have access to context history
    const store = useClientStore.getState()
    const history = store.getContextHistory("One")

    expect(history).toHaveLength(1)
    expect(history[0].id?.ticker).toBe("AAPL")
  })

  it("should handle intent resolution", () => {
    const testIntentResolution = {
      appIntents: [],
      requestId: "req-123",
      context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
    }

    // Set intent resolution
    useClientStore.getState().setIntentResolution(testIntentResolution)

    const result = render(<Frame />)

    // Should show resolver panel or have resolver content
    const resolver = result.container.querySelector("[class*='resolver']")
    const hasResolverContent = result.container.textContent?.includes("resolver")

    expect(resolver !== null || hasResolverContent).toBe(true)
  })

  it("should render efficiently", () => {
    const iterations = 10

    // Test rendering performance
    const startTime = performance.now()
    for (let i = 0; i < iterations; i++) {
      const result = render(<Frame />)
      result.unmount()
    }
    const endTime = performance.now()
    const totalTime = endTime - startTime

    // Should render reasonably fast
    expect(totalTime).toBeLessThan(1000) // Less than 1 second for 10 renders

    console.log(`Rendering performance: ${totalTime.toFixed(2)}ms for ${iterations} renders`)
  })

  it("should handle unmounting gracefully", () => {
    const result = render(<Frame />)

    // Should unmount without errors
    expect(() => result.unmount()).not.toThrow()
  })
})
