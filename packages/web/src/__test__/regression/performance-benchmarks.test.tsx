import { describe, it, expect, beforeEach } from "vitest"
import { performance } from "perf_hooks"
import { useClientStore } from "@/stores/useClientStore"
import { useServerStore } from "@/stores/useServerStore"

// Performance benchmark tests to establish baseline before migration
describe("Performance Benchmarks - Regression Tests", () => {
  beforeEach(() => {
    // Reset stores to consistent state
    useClientStore.setState({
      activeTabId: "One",
      tabs: [{ id: "One", icon: "/icons/tabs/one.svg", background: "#123456" }],
      panels: [],
      directories: [],
      knownApps: [],
      customApps: [],
      intentResolution: null,
      contextHistory: {},
      userSessionId: "test-user",
    })
  })

  it("should handle rapid tab switching efficiently", () => {
    const store = useClientStore.getState()
    const iterations = 1000
    
    // Add multiple tabs for testing
    const tabs = Array.from({ length: 10 }, (_, i) => ({
      id: `Tab${i}`,
      icon: `/icons/tabs/tab${i}.svg`, 
      background: `#${i.toString(16).repeat(6).slice(0, 6)}`
    }))
    
    store.setDirectories([])
    useClientStore.setState({ tabs })
    
    const startTime = performance.now()
    
    // Rapid tab switching
    for (let i = 0; i < iterations; i++) {
      const tabId = `Tab${i % 10}`
      store.setActiveTabId(tabId)
    }
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    const avgTimePerOperation = totalTime / iterations
    
    // Benchmark: should be under 1ms per operation
    expect(avgTimePerOperation).toBeLessThan(1)
    expect(totalTime).toBeLessThan(1000) // Total under 1 second
    
    console.log(`Tab switching: ${avgTimePerOperation.toFixed(3)}ms per operation`)
  })

  it("should handle rapid panel addition/removal efficiently", () => {
    const store = useClientStore.getState()
    const iterations = 500
    
    const mockApp = {
      appId: "test-app",
      name: "Test App",
      title: "Test Application", 
      description: "A test app",
      version: "1.0.0",
      type: "web" as const,
      details: { url: "http://testapp.com" },
      icons: [{ src: "/app-icon.png" }],
    }
    
    const startTime = performance.now()
    
    // Rapid panel operations
    for (let i = 0; i < iterations; i++) {
      const panelId = `panel-${i}`
      
      // Add panel
      store.newPanel(mockApp, panelId, `App ${i}`)
      
      // Remove panel immediately (stress test)
      if (i % 2 === 0) {
        store.removePanel(panelId)
      }
    }
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    const avgTimePerOperation = totalTime / (iterations * 1.5) // 1.5 operations per iteration
    
    // Benchmark: should be under 2ms per operation
    expect(avgTimePerOperation).toBeLessThan(2)
    expect(totalTime).toBeLessThan(2000) // Total under 2 seconds
    
    console.log(`Panel operations: ${avgTimePerOperation.toFixed(3)}ms per operation`)
  })

  it("should handle large context history efficiently", () => {
    const store = useClientStore.getState()
    const iterations = 1000
    
    const startTime = performance.now()
    
    // Add many context entries
    for (let i = 0; i < iterations; i++) {
      const context = {
        type: "fdc3.instrument",
        id: { ticker: `STOCK${i}` },
        name: `Stock ${i}`,
        timestamp: Date.now() + i
      }
      
      store.appendContextHistory("One", context)
    }
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    const avgTimePerOperation = totalTime / iterations
    
    // Benchmark: should be under 1ms per context addition
    expect(avgTimePerOperation).toBeLessThan(1)
    
    // Verify all contexts were added
    const history = store.getContextHistory("One")
    expect(history).toHaveLength(iterations)
    
    console.log(`Context history: ${avgTimePerOperation.toFixed(3)}ms per operation`)
  })

  it("should handle store persistence efficiently", () => {
    const store = useClientStore.getState()
    
    // Add substantial data
    const tabs = Array.from({ length: 50 }, (_, i) => ({
      id: `Tab${i}`,
      icon: `/icons/tabs/tab${i}.svg`,
      background: `#${i.toString(16).repeat(6).slice(0, 6)}`
    }))
    
    const panels = Array.from({ length: 20 }, (_, i) => ({
      panelId: `panel-${i}`,
      tabId: `Tab${i % 10}`,
      title: `App ${i}`,
      url: `http://app${i}.com`,
      appId: `app-${i}`,
      icon: `/icon${i}.png`,
      x: i % 12,
      y: Math.floor(i / 12),
      w: 6,
      h: 4,
    }))
    
    const startTime = performance.now()
    
    // Update store (triggers persistence)
    useClientStore.setState({
      tabs,
      panels,
      activeTabId: "Tab0"
    })
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    
    // Benchmark: should be under 100ms for large state update
    expect(totalTime).toBeLessThan(100)
    
    console.log(`Store persistence: ${totalTime.toFixed(3)}ms for large state`)
  })

  it("should handle server store operations efficiently", () => {
    const serverStore = useServerStore.getState()
    const iterations = 100
    
    const mockAppStates = Array.from({ length: 50 }, (_, i) => ({
      instanceId: `instance-${i}`,
      appId: `app-${i}`,
      state: "Connected" as const,
      timestamp: Date.now() + i
    }))
    
    const startTime = performance.now()
    
    // Rapid state updates
    for (let i = 0; i < iterations; i++) {
      serverStore._setAppStates(mockAppStates)
      serverStore._setConnectionState(i % 2 === 0, i % 3 === 0 ? "Test error" : undefined)
    }
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    const avgTimePerOperation = totalTime / (iterations * 2) // 2 operations per iteration
    
    // Benchmark: should be under 1ms per operation
    expect(avgTimePerOperation).toBeLessThan(1)
    
    console.log(`Server store operations: ${avgTimePerOperation.toFixed(3)}ms per operation`)
  })

  it("should establish memory usage baseline", () => {
    const store = useClientStore.getState()
    
    // Initial memory baseline
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0
    
    // Create substantial amount of data
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      data: Array.from({ length: 100 }, (_, j) => `item-${i}-${j}`),
      metadata: {
        timestamp: Date.now(),
        random: Math.random(),
        nested: { deep: { value: `deep-${i}` } }
      }
    }))
    
    // Add to context history (simulates heavy usage)
    largeData.forEach((item, i) => {
      store.appendContextHistory("One", {
        type: "custom.data",
        data: item
      })
    })
    
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
    const memoryIncrease = finalMemory - initialMemory
    
    // Memory increase should be reasonable (under 50MB for this test)
    if (initialMemory > 0) {
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
    }
    
    // Clean up
    useClientStore.setState({ contextHistory: {} })
  })
})