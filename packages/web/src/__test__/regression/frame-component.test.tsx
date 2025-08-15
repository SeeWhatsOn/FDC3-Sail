import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@/__test__/utils/component-test-utils"
import { Frame } from "@/client/frame/frame"
import { useClientStore } from "@/stores/useClientStore"

// Regression tests for Frame component before migration to hooks
describe("Frame Component - Regression Tests", () => {
  beforeEach(() => {
    // Reset store to clean state
    useClientStore.setState({
      activeTabId: "One",
      tabs: [
        { id: "One", icon: "/icons/tabs/one.svg", background: "#123456" },
        { id: "Two", icon: "/icons/tabs/two.svg", background: "#564312" },
      ],
      panels: [],
      directories: [],
      knownApps: [],
      customApps: [],
      intentResolution: null,
      contextHistory: {},
      userSessionId: "test-user",
    })
  })

  it("should render main layout structure", () => {
    // This test verifies the current Frame component renders correctly
    // Critical for ensuring migration doesn't break basic layout
    render(<Frame />)
    
    // These elements should always be present
    expect(document.querySelector("[class*='outer']")).toBeInTheDocument()
    expect(document.querySelector("[class*='top']")).toBeInTheDocument()
    expect(document.querySelector("[class*='left']")).toBeInTheDocument()
    expect(document.querySelector("[class*='main']")).toBeInTheDocument()
  })

  it("should handle active tab styling", () => {
    render(<Frame />)
    
    // The main area should have a border color based on active tab
    const mainElement = document.querySelector("[class*='main']")
    expect(mainElement).toHaveStyle("border: 1px solid #123456")
  })

  it("should render without errors when no panels exist", () => {
    // Edge case: empty state should not crash
    expect(() => render(<Frame />)).not.toThrow()
  })

  it("should maintain consistent DOM structure", () => {
    // This test captures the current DOM structure to detect breaking changes
    const { container } = render(<Frame />)
    
    // Critical structural elements that migration must preserve
    const outerDiv = container.firstChild
    expect(outerDiv).toHaveClass(expect.stringMatching(/outer/))
    
    const children = (outerDiv as Element).children
    expect(children.length).toBeGreaterThanOrEqual(3) // top, left, main
  })
})