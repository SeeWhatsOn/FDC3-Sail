import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor } from "@/__test__/utils/component-test-utils"
import { Frame } from "@/client/frame/frame"
import { useClientStore } from "@/stores/useClientStore"
import { useServerStore } from "@/stores/useServerStore"

// End-to-end workflow regression tests
// These tests verify critical user journeys work before and after migration
describe("End-to-End Workflow Regression Tests", () => {
  beforeEach(() => {
    // Reset all stores to clean state
    useClientStore.setState({
      activeTabId: "One",
      tabs: [
        { id: "One", icon: "/icons/tabs/one.svg", background: "#123456" },
        { id: "Two", icon: "/icons/tabs/two.svg", background: "#564312" },
      ],
      panels: [],
      directories: [
        {
          label: "Test Directory",
          url: "http://test.com/apps.json", 
          active: true
        }
      ],
      knownApps: [
        {
          appId: "test-app",
          name: "Test App",
          title: "Test Application",
          description: "A test app",
          version: "1.0.0",
          type: "web",
          details: { url: "http://testapp.com" },
          icons: [{ src: "/app-icon.png" }],
        }
      ],
      customApps: [],
      intentResolution: null,
      contextHistory: {},
      userSessionId: "test-user",
    })

    useServerStore.setState({
      socket: null,
      isConnected: false,
      connectionError: null,
      appStates: [],
    })
  })

  it("should maintain tab switching functionality", () => {
    render(<Frame />)
    
    // Verify initial state
    const store = useClientStore.getState()
    expect(store.activeTabId).toBe("One")
    
    // Switch to tab two
    store.setActiveTabId("Two")
    
    // Verify state changed
    expect(useClientStore.getState().activeTabId).toBe("Two")
  })

  it("should handle panel lifecycle correctly", () => {
    const store = useClientStore.getState()
    const mockApp = store.knownApps[0]
    
    // Initial state: no panels
    expect(store.panels).toHaveLength(0)
    
    // Add a panel (simulates app launch)
    store.newPanel(mockApp, "instance-123", "Test App Instance")
    
    // Verify panel was added
    const panels = useClientStore.getState().panels
    expect(panels).toHaveLength(1)
    expect(panels[0].panelId).toBe("instance-123")
    expect(panels[0].title).toBe("Test App Instance")
    expect(panels[0].tabId).toBe("One") // Should use active tab
    
    // Remove the panel
    store.removePanel("instance-123")
    
    // Verify panel was removed
    expect(useClientStore.getState().panels).toHaveLength(0)
  })

  it("should handle tab removal with panel cleanup", () => {
    const store = useClientStore.getState()
    const mockApp = store.knownApps[0]
    
    // Add panels to both tabs
    store.setActiveTabId("One")
    store.newPanel(mockApp, "panel-tab1", "App on Tab 1")
    
    store.setActiveTabId("Two") 
    store.newPanel(mockApp, "panel-tab2", "App on Tab 2")
    
    // Verify both panels exist
    expect(useClientStore.getState().panels).toHaveLength(2)
    
    // Remove tab "Two" 
    store.removeTab("Two")
    
    const finalState = useClientStore.getState()
    
    // Tab should be removed
    expect(finalState.tabs.find(t => t.id === "Two")).toBeUndefined()
    
    // Panel associated with removed tab should be cleaned up
    expect(finalState.panels).toHaveLength(1)
    expect(finalState.panels[0].tabId).toBe("One")
  })

  it("should handle context history per tab", () => {
    const store = useClientStore.getState()
    const testContext1 = { type: "fdc3.instrument", id: { ticker: "AAPL" } }
    const testContext2 = { type: "fdc3.instrument", id: { ticker: "GOOGL" } }
    
    // Add context to different tabs
    store.appendContextHistory("One", testContext1)
    store.appendContextHistory("Two", testContext2)
    
    // Verify contexts are isolated by tab
    expect(store.getContextHistory("One")).toHaveLength(1)
    expect(store.getContextHistory("Two")).toHaveLength(1)
    expect(store.getContextHistory("One")[0].id?.ticker).toBe("AAPL")
    expect(store.getContextHistory("Two")[0].id?.ticker).toBe("GOOGL")
  })

  it("should handle directory management workflow", () => {
    const store = useClientStore.getState()
    const newDirectory = {
      label: "New Test Directory",
      url: "http://new.com/apps.json",
      active: false
    }
    
    // Initial state
    expect(store.directories).toHaveLength(1)
    
    // Add new directory
    store.setDirectories([...store.directories, newDirectory])
    
    // Verify directory added
    expect(useClientStore.getState().directories).toHaveLength(2)
    
    // Update directory status
    const updatedDirectory = { ...newDirectory, active: true }
    store.updateDirectory(updatedDirectory)
    
    // Verify directory updated
    const directories = useClientStore.getState().directories
    const found = directories.find(d => d.url === newDirectory.url)
    expect(found?.active).toBe(true)
  })

  it("should maintain intent resolution state", () => {
    const store = useClientStore.getState()
    const testResolution = {
      appIntents: [],
      requestId: "req-123",
      context: { type: "fdc3.instrument", id: { ticker: "AAPL" } },
    }
    
    // Initial state
    expect(store.intentResolution).toBeNull()
    
    // Set intent resolution
    store.setIntentResolution(testResolution)
    
    // Verify state
    expect(useClientStore.getState().intentResolution).toEqual(testResolution)
    
    // Clear resolution
    store.setIntentResolution(null)
    
    // Verify cleared
    expect(useClientStore.getState().intentResolution).toBeNull()
  })

  it("should handle server connection state changes", () => {
    const serverStore = useServerStore.getState()
    
    // Initial state
    expect(serverStore.isConnected).toBe(false)
    expect(serverStore.connectionError).toBeNull()
    
    // Simulate connection
    serverStore._setConnectionState(true)
    
    // Verify connected
    expect(useServerStore.getState().isConnected).toBe(true)
    
    // Simulate error
    serverStore._setConnectionState(false, "Connection failed")
    
    // Verify error state
    const finalState = useServerStore.getState()
    expect(finalState.isConnected).toBe(false)
    expect(finalState.connectionError).toBe("Connection failed")
  })
})