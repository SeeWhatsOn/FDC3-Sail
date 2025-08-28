import { describe, it, expect } from "vitest"
import { useClientStore } from "@/stores/useClientStore"
import { useServerStore } from "@/stores/useServerStore"

// Migration safety tests - ensure data integrity during Phase 3 migration
describe("Migration Safety Tests", () => {
  it("should maintain Zustand store interfaces after migration", () => {
    // These interfaces are the contract that the migration must preserve
    const clientStore = useClientStore.getState()
    const serverStore = useServerStore.getState()

    // Critical client store methods that components depend on
    expect(typeof clientStore.getActiveTab).toBe("function")
    expect(typeof clientStore.setActiveTabId).toBe("function")
    expect(typeof clientStore.addPanel).toBe("function")
    expect(typeof clientStore.removePanel).toBe("function")
    expect(typeof clientStore.newPanel).toBe("function")
    expect(typeof clientStore.getPanels).toBe("function")
    expect(typeof clientStore.getContextHistory).toBe("function")
    expect(typeof clientStore.appendContextHistory).toBe("function")

    // Critical server store methods
    expect(typeof serverStore.connect).toBe("function")
    expect(typeof serverStore.disconnect).toBe("function")
    expect(typeof serverStore.registerDesktopAgent).toBe("function")
    expect(typeof serverStore.registerAppLaunch).toBe("function")
    expect(typeof serverStore.intentChosen).toBe("function")
  })

  it("should maintain state structure compatibility", () => {
    const clientState = useClientStore.getState()

    // Required state properties that components access
    expect(clientState).toHaveProperty("activeTabId")
    expect(clientState).toHaveProperty("tabs")
    expect(clientState).toHaveProperty("panels")
    expect(clientState).toHaveProperty("directories")
    expect(clientState).toHaveProperty("knownApps")
    expect(clientState).toHaveProperty("customApps")
    expect(clientState).toHaveProperty("intentResolution")
    expect(clientState).toHaveProperty("contextHistory")
    expect(clientState).toHaveProperty("userSessionId")

    // Validate array types
    expect(Array.isArray(clientState.tabs)).toBe(true)
    expect(Array.isArray(clientState.panels)).toBe(true)
    expect(Array.isArray(clientState.directories)).toBe(true)
    expect(Array.isArray(clientState.knownApps)).toBe(true)
    expect(Array.isArray(clientState.customApps)).toBe(true)

    // Validate object types
    expect(typeof clientState.contextHistory).toBe("object")
    expect(typeof clientState.userSessionId).toBe("string")
  })

  it("should maintain server state structure compatibility", () => {
    const serverState = useServerStore.getState()

    // Required server state properties
    expect(serverState).toHaveProperty("socket")
    expect(serverState).toHaveProperty("isConnected")
    expect(serverState).toHaveProperty("connectionError")
    expect(serverState).toHaveProperty("appStates")

    // Validate types
    expect(typeof serverState.isConnected).toBe("boolean")
    expect(Array.isArray(serverState.appStates)).toBe(true)
  })

  it("should maintain backward compatibility with legacy state getters", () => {
    // During migration, legacy components might still call these patterns
    const clientStore = useClientStore.getState()

    // Test that all current getter patterns work
    expect(() => clientStore.getActiveTab()).not.toThrow()
    expect(() => clientStore.getPanels()).not.toThrow()
    expect(() => clientStore.getDirectories()).not.toThrow()
    expect(() => clientStore.getKnownApps()).not.toThrow()
    expect(() => clientStore.getCustomApps()).not.toThrow()
    expect(() => clientStore.getIntentResolution()).not.toThrow()
    expect(() => clientStore.getUserSessionID()).not.toThrow()
  })

  it("should handle state mutations safely", () => {
    const initialState = useClientStore.getState()
    const initialPanelsLength = initialState.panels.length

    // Test that state mutations work correctly
    const mockApp = {
      appId: "migration-test",
      name: "Migration Test",
      title: "Migration Test App",
      description: "Test app for migration",
      version: "1.0.0",
      type: "web" as const,
      details: { url: "http://test.com" },
    }

    // Add panel
    initialState.newPanel(mockApp, "test-panel", "Test Panel")

    // Verify state changed
    const afterAdd = useClientStore.getState()
    expect(afterAdd.panels.length).toBe(initialPanelsLength + 1)

    // Remove panel
    initialState.removePanel("test-panel")

    // Verify state reverted
    const afterRemove = useClientStore.getState()
    expect(afterRemove.panels.length).toBe(initialPanelsLength)
  })

  it("should maintain type safety across migration", () => {
    const clientStore = useClientStore.getState()

    // Verify TypeScript types are preserved (compile-time check)
    const activeTab = clientStore.getActiveTab()
    expect(activeTab).toHaveProperty("id")
    expect(activeTab).toHaveProperty("icon")
    expect(activeTab).toHaveProperty("background")

    const panels = clientStore.getPanels()
    if (panels.length > 0) {
      const panel = panels[0]
      expect(panel).toHaveProperty("panelId")
      expect(panel).toHaveProperty("tabId")
      expect(panel).toHaveProperty("title")
      expect(panel).toHaveProperty("url")
      expect(panel).toHaveProperty("appId")
    }
  })

  it("should ensure state persistence works after migration", () => {
    const initialUserSessionId = useClientStore.getState().userSessionId

    // Modify persisted state
    useClientStore.setState({
      activeTabId: "TestTab",
      tabs: [{ id: "TestTab", icon: "/test.svg", background: "#ff0000" }],
    })

    // Verify changes persisted
    const modifiedState = useClientStore.getState()
    expect(modifiedState.activeTabId).toBe("TestTab")
    expect(modifiedState.userSessionId).toBe(initialUserSessionId) // Should remain unchanged
  })

  it("should maintain performance characteristics", () => {
    const iterations = 100
    const startTime = performance.now()

    // Rapid state access (simulates component re-renders)
    for (let i = 0; i < iterations; i++) {
      const store = useClientStore.getState()
      store.getActiveTab()
      store.getPanels()
      store.getDirectories()
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime
    const avgTime = totalTime / iterations

    // Performance should remain fast (under 1ms per access)
    expect(avgTime).toBeLessThan(1)

    console.log(`Store access performance: ${avgTime.toFixed(3)}ms per operation`)
  })

  it("should handle error states gracefully", () => {
    const clientStore = useClientStore.getState()

    // Test error conditions that components might encounter
    expect(() => clientStore.removePanel("non-existent")).not.toThrow()
    expect(() => clientStore.removeTab("non-existent")).not.toThrow()
    expect(() => clientStore.getContextHistory("non-existent")).not.toThrow()

    // Should return safe defaults
    expect(clientStore.getContextHistory("non-existent")).toEqual([])
  })
})
