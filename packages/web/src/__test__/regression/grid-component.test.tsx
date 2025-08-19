import { describe, it, expect, beforeEach, vi } from "vitest"

import { render } from "@/__test__/utils/component-test-utils"
import { Grids } from "@/client/grid/grid"
import { GridsState } from "@/client/grid/gridstate"
import { useClientStore } from "@/stores/useClientStore"
import { AppPanel } from "@/types"

import { mockGridStack } from "../utils/test-mocks"

// Mock GridStack to avoid complex UI library in tests
vi.mock("gridstack", () => ({
  GridStack: mockGridStack(),
}))

// Regression tests for Grid component before migration to hooks
describe("Grid Component - Regression Tests", () => {
  let mockGridsState: GridsState
  let testPanels: AppPanel[]

  beforeEach(() => {
    // Reset store and create test data
    testPanels = [
      {
        panelId: "panel-1",
        tabId: "One",
        title: "Test App 1",
        url: "http://test1.com",
        appId: "test-app-1",
        icon: "/test-icon.png",
        x: 0,
        y: 0,
        w: 6,
        h: 4,
      },
      {
        panelId: "panel-2",
        tabId: "One",
        title: "Test App 2",
        url: "http://test2.com",
        appId: "test-app-2",
        icon: null,
        x: 6,
        y: 0,
        w: 6,
        h: 4,
      },
    ]

    useClientStore.setState({
      activeTabId: "One",
      tabs: [{ id: "One", icon: "/icons/tabs/one.svg", background: "#123456" }],
      panels: testPanels,
      directories: [],
      knownApps: [],
      customApps: [],
      intentResolution: null,
      contextHistory: {},
      userSessionId: "test-user",
    })

    // Mock GridsState
    mockGridsState = {
      updatePanels: vi.fn(),
    } as unknown as GridsState
  })

  it("should render correct number of app frames", () => {
    const clientState = useClientStore.getState()

    const { container } = render(
      <Grids
        cs={clientState as unknown as import("@/types").WebClientState}
        gs={mockGridsState}
        as={{} as import("@/types").AppState}
        id="test-grid"
      />
    )

    // Should render iframe for each panel
    const iframes = container.querySelectorAll("iframe")
    expect(iframes).toHaveLength(2)
  })

  it("should set correct iframe attributes", () => {
    const clientState = useClientStore.getState()

    const { container } = render(
      <Grids
        cs={clientState as unknown as import("@/types").WebClientState}
        gs={mockGridsState}
        as={{} as import("@/types").AppState}
        id="test-grid"
      />
    )

    const firstIframe = container.querySelector("iframe")
    expect(firstIframe).toHaveAttribute("src", "http://test1.com")
    expect(firstIframe).toHaveAttribute("id", "iframe_panel-1")
    expect(firstIframe).toHaveAttribute("name", "panel-1")
  })

  it("should call updatePanels on mount and update", () => {
    const clientState = useClientStore.getState()

    const { rerender } = render(
      <Grids
        cs={clientState as unknown as import("@/types").WebClientState}
        gs={mockGridsState}
        as={{} as import("@/types").AppState}
        id="test-grid"
      />
    )

    // Should be called on mount
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(mockGridsState.updatePanels)).toHaveBeenCalledTimes(1)

    // Should be called on update
    rerender(
      <Grids
        cs={clientState as unknown as import("@/types").WebClientState}
        gs={mockGridsState}
        as={{} as import("@/types").AppState}
        id="test-grid-updated"
      />
    )

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(mockGridsState.updatePanels)).toHaveBeenCalledTimes(2)
  })

  it("should handle empty panels gracefully", () => {
    useClientStore.setState({ panels: [] })
    const clientState = useClientStore.getState()

    expect(() =>
      render(
        <Grids
          cs={clientState as unknown as import("@/types").WebClientState}
          gs={mockGridsState}
          as={{} as import("@/types").AppState}
          id="test-grid"
        />
      )
    ).not.toThrow()
  })

  it("should maintain grid container structure", () => {
    const clientState = useClientStore.getState()

    const { container } = render(
      <Grids
        cs={clientState as unknown as import("@/types").WebClientState}
        gs={mockGridsState}
        as={{} as import("@/types").AppState}
        id="test-grid"
      />
    )

    // Main grid container should exist with correct ID
    const gridContainer = container.querySelector("#test-grid")
    expect(gridContainer).toBeInTheDocument()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(gridContainer).toHaveClass(expect.stringMatching("grids"))
  })
})
