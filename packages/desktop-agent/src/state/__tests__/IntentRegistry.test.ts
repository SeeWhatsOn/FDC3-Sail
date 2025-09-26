/**
 * Intent Registry Tests
 *
 * Comprehensive test suite for the IntentRegistry covering intent listener
 * management, app capabilities, intent resolution, and query functionality.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { AppIdentifier, AppMetadata, Context } from "@finos/fdc3"
import { IntentRegistry, IntentResolutionRequest, IntentQuery } from "../IntentRegistry"

describe("IntentRegistry", () => {
  let registry: IntentRegistry

  // Test data
  const mockContext: Context = {
    type: "fdc3.instrument",
    id: { ticker: "AAPL" },
    name: "Apple Inc.",
  }

  const mockAppIdentifier: AppIdentifier = {
    appId: "test-app-1",
  }

  const mockAppMetadata: AppMetadata = {
    appId: "test-app-1",
    name: "Test Application 1",
    version: "1.0.0",
  }

  beforeEach(() => {
    registry = new IntentRegistry()
  })

  describe("Intent Listener Management", () => {
    it("should register a new intent listener", () => {
      const listener = registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: ["fdc3.instrument", "fdc3.portfolio"],
        resultType: "channel",
        metadata: { custom: "data" },
      })

      expect(listener.listenerId).toBe("listener-1")
      expect(listener.intentName).toBe("ViewChart")
      expect(listener.instanceId).toBe("instance-1")
      expect(listener.appId).toBe("test-app-1")
      expect(listener.contextTypes).toEqual(["fdc3.instrument", "fdc3.portfolio"])
      expect(listener.resultType).toBe("channel")
      expect(listener.active).toBe(true)
      expect(listener.metadata?.custom).toBe("data")
      expect(listener.registeredAt).toBeInstanceOf(Date)
      expect(listener.lastActivity).toBeInstanceOf(Date)
    })

    it("should register listener with default context types", () => {
      const listener = registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
      })

      expect(listener.contextTypes).toEqual([])
    })

    it("should throw error when registering duplicate listener", () => {
      const params = {
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
      }

      registry.registerListener(params)

      expect(() => {
        registry.registerListener(params)
      }).toThrow("Intent listener listener-1 already exists")
    })

    it("should unregister intent listener", () => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: ["fdc3.instrument"],
      })

      expect(registry.getListener("listener-1")).toBeTruthy()
      expect(registry.queryListeners({ intentName: "ViewChart" })).toHaveLength(1)

      const unregistered = registry.unregisterListener("listener-1")

      expect(unregistered).toBe(true)
      expect(registry.getListener("listener-1")).toBeUndefined()
      expect(registry.queryListeners({ intentName: "ViewChart" })).toHaveLength(0)
    })

    it("should return false when unregistering non-existent listener", () => {
      const unregistered = registry.unregisterListener("non-existent")
      expect(unregistered).toBe(false)
    })

    it("should get listener by ID", () => {
      const registered = registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
      })

      const retrieved = registry.getListener("listener-1")
      expect(retrieved).toEqual(registered)
    })

    it("should return undefined for non-existent listener", () => {
      const listener = registry.getListener("non-existent")
      expect(listener).toBeUndefined()
    })

    it("should get all listeners", () => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
      })

      registry.registerListener({
        listenerId: "listener-2",
        intentName: "ViewNews",
        instanceId: "instance-2",
        appId: "test-app-2",
      })

      const allListeners = registry.getAllListeners()
      expect(allListeners).toHaveLength(2)
      expect(allListeners.map(l => l.listenerId)).toEqual(["listener-1", "listener-2"])
    })

    it("should update listener activity", () => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
      })

      const originalActivity = registry.getListener("listener-1")?.lastActivity

      const updated = registry.updateListenerActivity("listener-1")
      expect(updated).toBe(true)

      const newActivity = registry.getListener("listener-1")?.lastActivity
      expect(newActivity?.getTime()).toBeGreaterThanOrEqual(originalActivity?.getTime() || 0)
    })

    it("should set listener active status", () => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
      })

      expect(registry.getListener("listener-1")?.active).toBe(true)

      const updated = registry.setListenerActive("listener-1", false)
      expect(updated).toBe(true)
      expect(registry.getListener("listener-1")?.active).toBe(false)
    })

    it("should remove all listeners for instance", () => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
      })

      registry.registerListener({
        listenerId: "listener-2",
        intentName: "ViewNews",
        instanceId: "instance-1",
        appId: "test-app-1",
      })

      registry.registerListener({
        listenerId: "listener-3",
        intentName: "ViewChart",
        instanceId: "instance-2",
        appId: "test-app-1",
      })

      expect(registry.getAllListeners()).toHaveLength(3)

      const removedCount = registry.removeInstanceListeners("instance-1")
      expect(removedCount).toBe(2)
      expect(registry.getAllListeners()).toHaveLength(1)
      expect(registry.getListener("listener-3")).toBeTruthy()
    })
  })

  describe("Listener Query Functionality", () => {
    beforeEach(() => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: ["fdc3.instrument"],
        resultType: "channel",
      })

      registry.registerListener({
        listenerId: "listener-2",
        intentName: "ViewChart",
        instanceId: "instance-2",
        appId: "test-app-2",
        contextTypes: ["fdc3.portfolio"],
      })

      registry.registerListener({
        listenerId: "listener-3",
        intentName: "ViewNews",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: [], // Accepts all context types
      })

      registry.setListenerActive("listener-2", false)
    })

    it("should query by intent name", () => {
      const query: IntentQuery = { intentName: "ViewChart" }
      const results = registry.queryListeners(query)

      expect(results).toHaveLength(2)
      expect(results.every(l => l.intentName === "ViewChart")).toBe(true)
    })

    it("should query by app ID", () => {
      const query: IntentQuery = { appId: "test-app-1" }
      const results = registry.queryListeners(query)

      expect(results).toHaveLength(2)
      expect(results.every(l => l.appId === "test-app-1")).toBe(true)
    })

    it("should query by instance ID", () => {
      const query: IntentQuery = { instanceId: "instance-1" }
      const results = registry.queryListeners(query)

      expect(results).toHaveLength(2)
      expect(results.every(l => l.instanceId === "instance-1")).toBe(true)
    })

    it("should query by context type support", () => {
      const query: IntentQuery = { contextType: "fdc3.instrument" }
      const results = registry.queryListeners(query)

      expect(results).toHaveLength(2) // listener-1 (explicit) and listener-3 (accepts all)
      expect(results.map(l => l.listenerId)).toEqual(["listener-1", "listener-3"])
    })

    it("should query by result type", () => {
      const query: IntentQuery = { resultType: "channel" }
      const results = registry.queryListeners(query)

      expect(results).toHaveLength(1)
      expect(results[0].listenerId).toBe("listener-1")
    })

    it("should query by active status", () => {
      const activeQuery: IntentQuery = { active: true }
      const activeResults = registry.queryListeners(activeQuery)

      expect(activeResults).toHaveLength(2)
      expect(activeResults.every(l => l.active)).toBe(true)

      const inactiveQuery: IntentQuery = { active: false }
      const inactiveResults = registry.queryListeners(inactiveQuery)

      expect(inactiveResults).toHaveLength(1)
      expect(inactiveResults[0].listenerId).toBe("listener-2")
    })

    it("should query with multiple filters", () => {
      const query: IntentQuery = {
        intentName: "ViewChart",
        appId: "test-app-1",
        contextType: "fdc3.instrument",
        active: true,
      }
      const results = registry.queryListeners(query)

      expect(results).toHaveLength(1)
      expect(results[0].listenerId).toBe("listener-1")
    })

    it("should return empty array when no matches", () => {
      const query: IntentQuery = { intentName: "NonExistentIntent" }
      const results = registry.queryListeners(query)

      expect(results).toHaveLength(0)
    })
  })

  describe("App Capability Management", () => {
    it("should register app capabilities", () => {
      const capabilities = {
        ViewChart: {
          intentName: "ViewChart",
          appId: "test-app-1",
          contextTypes: ["fdc3.instrument", "fdc3.portfolio"],
          resultType: "channel",
          displayName: "View Chart",
        },
        ViewNews: {
          intentName: "ViewNews",
          appId: "test-app-1",
          contextTypes: ["fdc3.instrument"],
          displayName: "View News",
        },
      }

      registry.registerAppCapabilities("test-app-1", capabilities)

      const viewChartCap = registry.getAppCapability("test-app-1", "ViewChart")
      expect(viewChartCap).toBeTruthy()
      expect(viewChartCap?.displayName).toBe("View Chart")
      expect(viewChartCap?.contextTypes).toEqual(["fdc3.instrument", "fdc3.portfolio"])

      const appCaps = registry.getAppCapabilities("test-app-1")
      expect(appCaps).toHaveLength(2)
    })

    it("should replace existing capabilities when re-registering", () => {
      const initialCapabilities = {
        ViewChart: {
          intentName: "ViewChart",
          appId: "test-app-1",
          contextTypes: ["fdc3.instrument"],
        },
      }

      const newCapabilities = {
        ViewNews: {
          intentName: "ViewNews",
          appId: "test-app-1",
          contextTypes: ["fdc3.contact"],
        },
      }

      registry.registerAppCapabilities("test-app-1", initialCapabilities)
      expect(registry.getAppCapabilities("test-app-1")).toHaveLength(1)
      expect(registry.getAppCapability("test-app-1", "ViewChart")).toBeTruthy()

      registry.registerAppCapabilities("test-app-1", newCapabilities)
      expect(registry.getAppCapabilities("test-app-1")).toHaveLength(1)
      expect(registry.getAppCapability("test-app-1", "ViewChart")).toBeUndefined()
      expect(registry.getAppCapability("test-app-1", "ViewNews")).toBeTruthy()
    })

    it("should remove app capabilities", () => {
      const capabilities = {
        ViewChart: {
          intentName: "ViewChart",
          appId: "test-app-1",
          contextTypes: ["fdc3.instrument"],
        },
      }

      registry.registerAppCapabilities("test-app-1", capabilities)
      expect(registry.getAppCapabilities("test-app-1")).toHaveLength(1)

      registry.removeAppCapabilities("test-app-1")
      expect(registry.getAppCapabilities("test-app-1")).toHaveLength(0)
    })

    it("should get apps for intent", () => {
      const cap1 = {
        ViewChart: {
          intentName: "ViewChart",
          appId: "test-app-1",
          contextTypes: ["fdc3.instrument"],
        },
      }

      const cap2 = {
        ViewChart: {
          intentName: "ViewChart",
          appId: "test-app-2",
          contextTypes: ["fdc3.portfolio"],
        },
      }

      registry.registerAppCapabilities("test-app-1", cap1)
      registry.registerAppCapabilities("test-app-2", cap2)

      const appsForIntent = registry.getAppsForIntent("ViewChart")
      expect(appsForIntent).toHaveLength(2)
      expect(appsForIntent.map(c => c.appId)).toEqual(["test-app-1", "test-app-2"])
    })
  })

  describe("Intent Resolution", () => {
    beforeEach(() => {
      // Register some listeners
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: ["fdc3.instrument"],
        active: true,
      })

      registry.registerListener({
        listenerId: "listener-2",
        intentName: "ViewChart",
        instanceId: "instance-2",
        appId: "test-app-2",
        contextTypes: ["fdc3.instrument"],
        active: false, // Inactive
      })

      // Register app capabilities
      const capabilities = {
        ViewChart: {
          intentName: "ViewChart",
          appId: "test-app-3",
          contextTypes: ["fdc3.instrument"],
        },
      }
      registry.registerAppCapabilities("test-app-3", capabilities)
    })

    it("should find intent handlers", () => {
      const request: IntentResolutionRequest = {
        intent: "ViewChart",
        context: mockContext,
        source: mockAppIdentifier,
        requestId: "req-1",
      }

      const handlers = registry.findIntentHandlers(request)

      expect(handlers.runningListeners).toHaveLength(1) // Only active listener
      expect(handlers.runningListeners[0].listenerId).toBe("listener-1")

      expect(handlers.availableApps).toHaveLength(1)
      expect(handlers.availableApps[0].appId).toBe("test-app-3")

      expect(handlers.compatibleApps).toHaveLength(2) // Running listener + available app
    })

    it("should filter by target app", () => {
      const request: IntentResolutionRequest = {
        intent: "ViewChart",
        context: mockContext,
        target: { appId: "test-app-1" },
        source: mockAppIdentifier,
        requestId: "req-1",
      }

      const handlers = registry.findIntentHandlers(request)

      expect(handlers.runningListeners).toHaveLength(1)
      expect(handlers.runningListeners[0].appId).toBe("test-app-1")

      expect(handlers.availableApps).toHaveLength(0) // test-app-3 filtered out
      expect(handlers.compatibleApps).toHaveLength(1)
    })

    it("should filter by context type compatibility", () => {
      // Add listener that doesn't support the context type
      registry.registerListener({
        listenerId: "listener-3",
        intentName: "ViewChart",
        instanceId: "instance-3",
        appId: "test-app-4",
        contextTypes: ["fdc3.contact"], // Different context type
        active: true,
      })

      const request: IntentResolutionRequest = {
        intent: "ViewChart",
        context: mockContext, // fdc3.instrument
        source: mockAppIdentifier,
        requestId: "req-1",
      }

      const handlers = registry.findIntentHandlers(request)

      expect(handlers.runningListeners).toHaveLength(1) // Only listener-1 (supports fdc3.instrument)
      expect(handlers.runningListeners[0].listenerId).toBe("listener-1")
    })

    it("should create AppIntent objects", () => {
      const appIntents = registry.createAppIntents("ViewChart", "fdc3.instrument")

      expect(appIntents).toHaveLength(1) // Only test-app-3 from capabilities
      expect(appIntents[0].intent.name).toBe("ViewChart")
      expect(appIntents[0].apps).toHaveLength(1)
      expect(appIntents[0].apps[0].appId).toBe("test-app-3")
    })

    it("should record and retrieve resolution results", () => {
      const result = {
        requestId: "req-1",
        selectedApp: mockAppMetadata,
        selectedInstanceId: "instance-1",
        wasLaunched: false,
        resolvedAt: new Date(),
      }

      registry.recordResolution(result)

      const retrieved = registry.getResolution("req-1")
      expect(retrieved).toEqual(result)

      const history = registry.getResolutionHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual(result)
    })
  })

  describe("Query and Discovery", () => {
    beforeEach(() => {
      // Register listeners
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: ["fdc3.instrument"],
        active: true,
      })

      registry.registerListener({
        listenerId: "listener-2",
        intentName: "ViewNews",
        instanceId: "instance-2",
        appId: "test-app-2",
        contextTypes: [], // Accepts all context types
        active: true,
      })

      // Register capabilities
      const capabilities = {
        ViewChart: {
          intentName: "ViewChart",
          appId: "test-app-3",
          contextTypes: ["fdc3.portfolio"],
          displayName: "Chart Viewer",
        },
        SendEmail: {
          intentName: "SendEmail",
          appId: "test-app-3",
          contextTypes: ["fdc3.contact"],
        },
      }
      registry.registerAppCapabilities("test-app-3", capabilities)
    })

    it("should get available intents", () => {
      const intents = registry.getAvailableIntents()

      expect(intents).toHaveLength(3)
      expect(intents).toEqual(["SendEmail", "ViewChart", "ViewNews"]) // Sorted
    })

    it("should get intent metadata", () => {
      const metadata = registry.getIntentMetadata("ViewChart")

      expect(metadata).toBeTruthy()
      expect(metadata?.name).toBe("ViewChart")
      expect(metadata?.displayName).toBe("Chart Viewer") // From capability
    })

    it("should return undefined for non-existent intent metadata", () => {
      const metadata = registry.getIntentMetadata("NonExistentIntent")
      expect(metadata).toBeUndefined()
    })

    it("should find intents by context type", () => {
      const intents = registry.findIntentsByContext("fdc3.instrument")

      expect(intents).toHaveLength(2) // ViewChart and ViewNews (accepts all)
      expect(intents.map(i => i.name).sort()).toEqual(["ViewChart", "ViewNews"])
    })

    it("should find intents by context - specific type only", () => {
      const intents = registry.findIntentsByContext("fdc3.contact")

      expect(intents).toHaveLength(2) // SendEmail and ViewNews (accepts all)
      expect(intents.map(i => i.name).sort()).toEqual(["SendEmail", "ViewNews"])
    })
  })

  describe("Statistics and Utilities", () => {
    beforeEach(() => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        active: true,
      })

      registry.registerListener({
        listenerId: "listener-2",
        intentName: "ViewChart",
        instanceId: "instance-2",
        appId: "test-app-2",
        active: false,
      })

      registry.registerListener({
        listenerId: "listener-3",
        intentName: "ViewNews",
        instanceId: "instance-1",
        appId: "test-app-1",
        active: true,
      })

      const capabilities = {
        ViewChart: {
          intentName: "ViewChart",
          appId: "test-app-3",
          contextTypes: ["fdc3.instrument"],
        },
      }
      registry.registerAppCapabilities("test-app-3", capabilities)
    })

    it("should provide registry statistics", () => {
      const stats = registry.getStats()

      expect(stats.totalListeners).toBe(3)
      expect(stats.activeListeners).toBe(2)
      expect(stats.uniqueIntents).toBe(2)
      expect(stats.uniqueApps).toBe(2)
      expect(stats.appCapabilities).toBe(1)
      expect(stats.resolutionHistory).toBe(0)
      expect(stats.intentBreakdown.ViewChart).toBe(2)
      expect(stats.intentBreakdown.ViewNews).toBe(1)
      expect(stats.appBreakdown["test-app-1"]).toBe(2)
      expect(stats.appBreakdown["test-app-2"]).toBe(1)
    })

    it("should clear all data", () => {
      expect(registry.getAllListeners()).toHaveLength(3)
      expect(registry.getAppCapabilities("test-app-3")).toHaveLength(1)

      registry.clear()

      expect(registry.getAllListeners()).toHaveLength(0)
      expect(registry.getAppCapabilities("test-app-3")).toHaveLength(0)

      const stats = registry.getStats()
      expect(stats.totalListeners).toBe(0)
      expect(stats.appCapabilities).toBe(0)
    })
  })

  describe("Context Type Compatibility", () => {
    it("should handle listeners with no context types (accepts all)", () => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: [], // Accepts all
        active: true,
      })

      const request: IntentResolutionRequest = {
        intent: "ViewChart",
        context: mockContext, // fdc3.instrument
        source: mockAppIdentifier,
        requestId: "req-1",
      }

      const handlers = registry.findIntentHandlers(request)
      expect(handlers.runningListeners).toHaveLength(1)
    })

    it("should handle wildcard context type support", () => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: ["*"], // Wildcard
        active: true,
      })

      const request: IntentResolutionRequest = {
        intent: "ViewChart",
        context: mockContext,
        source: mockAppIdentifier,
        requestId: "req-1",
      }

      const handlers = registry.findIntentHandlers(request)
      expect(handlers.runningListeners).toHaveLength(1)
    })

    it("should match exact context types", () => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: ["fdc3.instrument", "fdc3.portfolio"],
        active: true,
      })

      const request: IntentResolutionRequest = {
        intent: "ViewChart",
        context: mockContext, // fdc3.instrument
        source: mockAppIdentifier,
        requestId: "req-1",
      }

      const handlers = registry.findIntentHandlers(request)
      expect(handlers.runningListeners).toHaveLength(1)
    })

    it("should not match incompatible context types", () => {
      registry.registerListener({
        listenerId: "listener-1",
        intentName: "ViewChart",
        instanceId: "instance-1",
        appId: "test-app-1",
        contextTypes: ["fdc3.contact"], // Different type
        active: true,
      })

      const request: IntentResolutionRequest = {
        intent: "ViewChart",
        context: mockContext, // fdc3.instrument
        source: mockAppIdentifier,
        requestId: "req-1",
      }

      const handlers = registry.findIntentHandlers(request)
      expect(handlers.runningListeners).toHaveLength(0)
    })
  })
})
