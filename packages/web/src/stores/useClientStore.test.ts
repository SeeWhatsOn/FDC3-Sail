import { describe, it, expect, beforeEach } from "vitest"
import { useClientStore } from "./useClientStore"
import { TabDetail, Directory } from "@finos/fdc3-sail-shared"
import { DirectoryApp } from "@finos/fdc3-web-impl"
import { AppPanel } from "../types"

// Reset store before each test
beforeEach(() => {
  useClientStore.setState({
    userSessionId: "test-user-123",
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
  })
})

describe("useClientStore - Tab Management", () => {
  it("should get active tab correctly", () => {
    const store = useClientStore.getState()
    const activeTab = store.getActiveTab()

    expect(activeTab.id).toBe("One")
    expect(activeTab.background).toBe("#123456")
  })

  it("should fallback to first tab if active tab is invalid", () => {
    useClientStore.setState({ activeTabId: "Invalid" })

    const store = useClientStore.getState()
    const activeTab = store.getActiveTab()

    expect(activeTab.id).toBe("One")
    // Check that activeTabId was updated after calling getActiveTab()
    expect(useClientStore.getState().activeTabId).toBe("One")
  })

  it("should set active tab ID", () => {
    const store = useClientStore.getState()
    store.setActiveTabId("Two")

    expect(useClientStore.getState().activeTabId).toBe("Two")
  })

  it("should add new tab", () => {
    const newTab: TabDetail = {
      id: "Three",
      icon: "/icons/tabs/three.svg",
      background: "#341256",
    }

    const store = useClientStore.getState()
    store.addTab(newTab)

    const tabs = useClientStore.getState().tabs
    expect(tabs).toHaveLength(3)
    expect(tabs[2]).toEqual(newTab)
  })

  it("should remove tab and associated panels", () => {
    // Add a panel to the tab we'll remove
    const testPanel: AppPanel = {
      panelId: "panel-1",
      tabId: "Two",
      title: "Test Panel",
      url: "http://test.com",
      appId: "test-app",
      icon: null,
      x: 0,
      y: 0,
      w: 4,
      h: 3,
    }

    useClientStore.setState({ panels: [testPanel] })

    const store = useClientStore.getState()
    store.removeTab("Two")

    const { tabs, panels } = useClientStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs.find((t) => t.id === "Two")).toBeUndefined()
    expect(panels).toHaveLength(0) // Panel should be removed too
  })

  it("should update existing tab", () => {
    const updatedTab: TabDetail = {
      id: "One",
      icon: "/icons/tabs/updated.svg",
      background: "#FF0000",
    }

    const store = useClientStore.getState()
    store.updateTab(updatedTab)

    const tabs = useClientStore.getState().tabs
    const tab = tabs.find((t) => t.id === "One")
    expect(tab?.background).toBe("#FF0000")
    expect(tab?.icon).toBe("/icons/tabs/updated.svg")
  })

  it("should move tab up", () => {
    const store = useClientStore.getState()
    store.moveTab("Two", "up")

    const tabs = useClientStore.getState().tabs
    expect(tabs[0].id).toBe("Two")
    expect(tabs[1].id).toBe("One")
  })

  it("should move tab down", () => {
    const store = useClientStore.getState()
    store.moveTab("One", "down")

    const tabs = useClientStore.getState().tabs
    expect(tabs[0].id).toBe("Two")
    expect(tabs[1].id).toBe("One")
  })
})

describe("useClientStore - Panel Management", () => {
  const testPanel: AppPanel = {
    panelId: "panel-1",
    tabId: "One",
    title: "Test Panel",
    url: "http://test.com",
    appId: "test-app",
    icon: "/icon.png",
    x: 0,
    y: 0,
    w: 6,
    h: 4,
  }

  it("should add panel", () => {
    const store = useClientStore.getState()
    store.addPanel(testPanel)

    const panels = store.getPanels()
    expect(panels).toHaveLength(1)
    expect(panels[0]).toEqual(testPanel)
  })

  it("should remove panel", () => {
    useClientStore.setState({ panels: [testPanel] })

    const store = useClientStore.getState()
    store.removePanel("panel-1")

    expect(store.getPanels()).toHaveLength(0)
  })

  it("should update existing panel", () => {
    useClientStore.setState({ panels: [testPanel] })

    const updatedPanel = { ...testPanel, title: "Updated Title" }
    const store = useClientStore.getState()
    store.updatePanel(updatedPanel)

    const panels = store.getPanels()
    expect(panels[0].title).toBe("Updated Title")
  })

  it("should create new panel from app", () => {
    const mockApp: DirectoryApp = {
      appId: "test-app",
      name: "Test App",
      title: "Test Application",
      description: "A test app",
      version: "1.0.0",
      type: "web",
      details: { url: "http://testapp.com" },
      icons: [{ src: "/app-icon.png" }],
    }

    const store = useClientStore.getState()
    store.newPanel(mockApp, "instance-123", "Test App 1")

    const panels = store.getPanels()
    expect(panels).toHaveLength(1)
    expect(panels[0].panelId).toBe("instance-123")
    expect(panels[0].title).toBe("Test App 1")
    expect(panels[0].appId).toBe("test-app")
    expect(panels[0].tabId).toBe("One") // Should use active tab
  })
})

describe("useClientStore - Directory Management", () => {
  const testDirectory: Directory = {
    label: "Test Directory",
    url: "http://test.com/directory.json",
    active: true,
  }

  it("should set directories", () => {
    const store = useClientStore.getState()
    store.setDirectories([testDirectory])

    const directories = store.getDirectories()
    expect(directories).toHaveLength(1)
    expect(directories[0]).toEqual(testDirectory)
  })

  it("should update directory", () => {
    useClientStore.setState({ directories: [testDirectory] })

    const updatedDirectory = { ...testDirectory, active: false }
    const store = useClientStore.getState()
    store.updateDirectory(updatedDirectory)

    const directories = store.getDirectories()
    expect(directories[0].active).toBe(false)
  })
})

describe("useClientStore - App Management", () => {
  const testApp: DirectoryApp = {
    appId: "test-app",
    name: "Test App",
    title: "Test Application",
    description: "A test app",
    version: "1.0.0",
    type: "web",
    details: { url: "http://testapp.com" },
  }

  it("should set and get known apps", () => {
    const store = useClientStore.getState()
    store.setKnownApps([testApp])

    const apps = store.getKnownApps()
    expect(apps).toHaveLength(1)
    expect(apps[0]).toEqual(testApp)
  })

  it("should set and get custom apps", () => {
    const store = useClientStore.getState()
    store.setCustomApps([testApp])

    const apps = store.getCustomApps()
    expect(apps).toHaveLength(1)
    expect(apps[0]).toEqual(testApp)
  })
})

describe("useClientStore - Context History", () => {
  it("should get empty context history for non-existent tab", () => {
    const store = useClientStore.getState()
    const history = store.getContextHistory("NonExistent")

    expect(history).toEqual([])
  })

  it("should append context to history", () => {
    const testContext = {
      type: "fdc3.instrument",
      id: { ticker: "AAPL" },
    }

    const store = useClientStore.getState()
    store.appendContextHistory("One", testContext)

    const history = store.getContextHistory("One")
    expect(history).toHaveLength(1)
    expect(history[0]).toEqual(testContext)
  })

  it("should maintain separate history per tab", () => {
    const context1 = { type: "fdc3.instrument", id: { ticker: "AAPL" } }
    const context2 = { type: "fdc3.instrument", id: { ticker: "GOOGL" } }

    const store = useClientStore.getState()
    store.appendContextHistory("One", context1)
    store.appendContextHistory("Two", context2)

    expect(store.getContextHistory("One")).toHaveLength(1)
    expect(store.getContextHistory("Two")).toHaveLength(1)
    expect(store.getContextHistory("One")[0].id?.ticker).toBe("AAPL")
    expect(store.getContextHistory("Two")[0].id?.ticker).toBe("GOOGL")
  })
})

describe("useClientStore - Intent Resolution", () => {
  it("should set and get intent resolution", () => {
    const testResolution = {
      appIntents: [],
      requestId: "req-123",
      context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
    }

    const store = useClientStore.getState()
    store.setIntentResolution(testResolution)

    expect(store.getIntentResolution()).toEqual(testResolution)
  })

  it("should clear intent resolution", () => {
    const testResolution = {
      appIntents: [],
      requestId: "req-123",
      context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
    }

    const store = useClientStore.getState()
    store.setIntentResolution(testResolution)
    store.setIntentResolution(null)

    expect(store.getIntentResolution()).toBeNull()
  })
})

describe("useClientStore - Utilities", () => {
  it("should return user session ID", () => {
    const store = useClientStore.getState()
    const sessionId = store.getUserSessionID()

    expect(sessionId).toBe("test-user-123")
  })
})
