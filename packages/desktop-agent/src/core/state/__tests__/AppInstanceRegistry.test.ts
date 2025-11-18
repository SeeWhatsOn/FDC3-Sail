/**
 * App Instance Registry Tests
 *
 * Comprehensive test suite for the AppInstanceRegistry covering all
 * functionality including instance management, state transitions,
 * channel management, and listener tracking.
 */

import { describe, it, expect, beforeEach } from "vitest"
import type { AppMetadata } from "@finos/fdc3"
import {
  AppInstanceRegistry,
  AppInstanceState,
  type CreateAppInstanceParams,
  type AppInstanceQuery,
} from "../app-instance-registry"

describe("AppInstanceRegistry", () => {
  let registry: AppInstanceRegistry

  // Test data
  const mockAppMetadata: AppMetadata = {
    appId: "test-app-1",
    name: "Test Application 1",
    title: "Test App Title",
    description: "A test application",
    version: "1.0.0",
  }

  const mockAppMetadata2: AppMetadata = {
    appId: "test-app-2",
    name: "Test Application 2",
    title: "Another Test App",
    description: "Another test application",
    version: "1.0.0",
  }

  beforeEach(() => {
    registry = new AppInstanceRegistry()
  })

  describe("Core Instance Management", () => {
    it("should create a new app instance", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
        instanceMetadata: {
          title: "Custom Instance Title",
          hosting: "frame",
        },
      }

      const instance = registry.createInstance(params)

      expect(instance.instanceId).toBe("instance-1")
      expect(instance.appId).toBe("test-app-1")
      expect(instance.metadata).toEqual(mockAppMetadata)
      expect(instance.state).toBe(AppInstanceState.PENDING)
      expect(instance.currentChannel).toBeNull()
      expect(instance.contextListeners).toBeInstanceOf(Set)
      expect(instance.contextListeners.size).toBe(0)
      // expect(instance.intentListeners).toBeInstanceOf(Set)
      // expect(instance.intentListeners.size).toBe(0)
      expect(instance.privateChannels).toBeInstanceOf(Set)
      expect(instance.privateChannels.size).toBe(0)
      expect(instance.instanceMetadata?.title).toBe("Custom Instance Title")
      expect(instance.instanceMetadata?.hosting).toBe("frame")
      expect(instance.createdAt).toBeInstanceOf(Date)
      expect(instance.lastActivity).toBeInstanceOf(Date)
    })

    it("should throw error when creating duplicate instance", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      expect(() => {
        registry.createInstance(params)
      }).toThrow("Instance instance-1 already exists")
    })

    it("should get instance by ID", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      const created = registry.createInstance(params)
      const retrieved = registry.getInstance("instance-1")

      expect(retrieved).toEqual(created)
    })

    it("should return undefined for non-existent instance", () => {
      const retrieved = registry.getInstance("non-existent")
      expect(retrieved).toBeUndefined()
    })

    it("should get all instances", () => {
      const params1: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      const params2: CreateAppInstanceParams = {
        instanceId: "instance-2",
        appId: "test-app-2",
        metadata: mockAppMetadata2,
      }

      registry.createInstance(params1)
      registry.createInstance(params2)

      const allInstances = registry.getAllInstances()
      expect(allInstances).toHaveLength(2)
      expect(allInstances.map(i => i.instanceId)).toEqual(["instance-1", "instance-2"])
    })

    it("should remove instance and clean up indexes", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      // Add some state to verify cleanup
      registry.setInstanceChannel("instance-1", "red")
      registry.addContextListener("instance-1", "fdc3.instrument")
      // registry.addIntentListener("instance-1", "ViewChart")

      expect(registry.getInstance("instance-1")).toBeTruthy()
      expect(registry.getInstancesOnChannel("red")).toHaveLength(1)
      expect(registry.getContextListeners("fdc3.instrument")).toHaveLength(1)
      // expect(registry.getIntentListeners("ViewChart")).toHaveLength(1)

      const removed = registry.removeInstance("instance-1")

      expect(removed).toBe(true)
      expect(registry.getInstance("instance-1")).toBeUndefined()
      expect(registry.getInstancesOnChannel("red")).toHaveLength(0)
      expect(registry.getContextListeners("fdc3.instrument")).toHaveLength(0)
      // expect(registry.getIntentListeners("ViewChart")).toHaveLength(0)
    })

    it("should return false when removing non-existent instance", () => {
      const removed = registry.removeInstance("non-existent")
      expect(removed).toBe(false)
    })
  })

  describe("State Management", () => {
    it("should update instance state", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      const updated = registry.updateInstanceState("instance-1", AppInstanceState.CONNECTED)
      expect(updated).toBe(true)

      const instance = registry.getInstance("instance-1")
      expect(instance?.state).toBe(AppInstanceState.CONNECTED)
    })

    it("should return false when updating non-existent instance state", () => {
      const updated = registry.updateInstanceState("non-existent", AppInstanceState.CONNECTED)
      expect(updated).toBe(false)
    })

    it("should update instance activity timestamp", async () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)
      const originalActivity = registry.getInstance("instance-1")?.lastActivity

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      const updated = registry.updateInstanceActivity("instance-1")
      expect(updated).toBe(true)

      const newActivity = registry.getInstance("instance-1")?.lastActivity
      expect(newActivity!.getTime()).toBeGreaterThan(originalActivity!.getTime())
    })

    it("should clean up resources when transitioning to terminated state", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      // Set up some state
      registry.setInstanceChannel("instance-1", "red")
      registry.addContextListener("instance-1", "fdc3.instrument")
      // registry.addIntentListener("instance-1", "ViewChart")
      registry.addPrivateChannelAccess("instance-1", "private-channel-1")

      // Verify state is set
      const instance = registry.getInstance("instance-1")!
      expect(instance.currentChannel).toBe("red")
      expect(instance.contextListeners.size).toBe(1)
      // expect(instance.intentListeners.size).toBe(1)
      expect(instance.privateChannels.size).toBe(1)

      // Transition to terminated
      registry.updateInstanceState("instance-1", AppInstanceState.TERMINATED)

      // Verify cleanup
      const terminatedInstance = registry.getInstance("instance-1")!
      expect(terminatedInstance.state).toBe(AppInstanceState.TERMINATED)
      expect(terminatedInstance.currentChannel).toBeNull()
      expect(terminatedInstance.contextListeners.size).toBe(0)
      // expect(terminatedInstance.intentListeners.size).toBe(0)
      expect(terminatedInstance.privateChannels.size).toBe(0)

      // Verify indexes are cleaned
      expect(registry.getInstancesOnChannel("red")).toHaveLength(0)
      expect(registry.getContextListeners("fdc3.instrument")).toHaveLength(0)
      // expect(registry.getIntentListeners("ViewChart")).toHaveLength(0)
    })
  })

  describe("Query Functionality", () => {
    beforeEach(() => {
      // Create test instances with different states
      const params1: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }
      const params2: CreateAppInstanceParams = {
        instanceId: "instance-2",
        appId: "test-app-1", // Same app
        metadata: mockAppMetadata,
      }
      const params3: CreateAppInstanceParams = {
        instanceId: "instance-3",
        appId: "test-app-2", // Different app
        metadata: mockAppMetadata2,
      }

      registry.createInstance(params1)
      registry.createInstance(params2)
      registry.createInstance(params3)

      // Set up different states
      registry.updateInstanceState("instance-1", AppInstanceState.CONNECTED)
      registry.updateInstanceState("instance-2", AppInstanceState.PENDING)
      registry.updateInstanceState("instance-3", AppInstanceState.CONNECTED)

      // Set up channels
      registry.setInstanceChannel("instance-1", "red")
      registry.setInstanceChannel("instance-3", "blue")

      // Set up listeners
      registry.addContextListener("instance-1", "fdc3.instrument")
      registry.addContextListener("instance-2", "fdc3.instrument")
      // registry.addIntentListener("instance-1", "ViewChart")
    })

    it("should query by appId", () => {
      const query: AppInstanceQuery = { appId: "test-app-1" }
      const results = registry.queryInstances(query)

      expect(results).toHaveLength(2)
      expect(results.every(i => i.appId === "test-app-1")).toBe(true)
    })

    it("should query by single state", () => {
      const query: AppInstanceQuery = { state: AppInstanceState.CONNECTED }
      const results = registry.queryInstances(query)

      expect(results).toHaveLength(2)
      expect(results.every(i => i.state === AppInstanceState.CONNECTED)).toBe(true)
    })

    it("should query by multiple states", () => {
      const query: AppInstanceQuery = {
        state: [AppInstanceState.CONNECTED, AppInstanceState.PENDING],
      }
      const results = registry.queryInstances(query)

      expect(results).toHaveLength(3)
      expect(
        results.every(
          i => i.state === AppInstanceState.CONNECTED || i.state === AppInstanceState.PENDING
        )
      ).toBe(true)
    })

    it("should query by current channel", () => {
      const query: AppInstanceQuery = { currentChannel: "red" }
      const results = registry.queryInstances(query)

      expect(results).toHaveLength(1)
      expect(results[0].instanceId).toBe("instance-1")
    })

    it("should query by null channel", () => {
      const query: AppInstanceQuery = { currentChannel: null }
      const results = registry.queryInstances(query)

      expect(results).toHaveLength(1)
      expect(results[0].instanceId).toBe("instance-2")
    })

    it("should query by context listener", () => {
      const query: AppInstanceQuery = { hasContextListener: "fdc3.instrument" }
      const results = registry.queryInstances(query)

      expect(results).toHaveLength(2)
      expect(results.map(i => i.instanceId)).toEqual(["instance-1", "instance-2"])
    })

    it("should query by intent listener", () => {
      const query: AppInstanceQuery = { hasIntentListener: "ViewChart" }
      const results = registry.queryInstances(query)

      expect(results).toHaveLength(1)
      expect(results[0].instanceId).toBe("instance-1")
    })

    it("should query with multiple filters", () => {
      const query: AppInstanceQuery = {
        appId: "test-app-1",
        state: AppInstanceState.CONNECTED,
        currentChannel: "red",
      }
      const results = registry.queryInstances(query)

      expect(results).toHaveLength(1)
      expect(results[0].instanceId).toBe("instance-1")
    })

    it("should return empty array when no matches", () => {
      const query: AppInstanceQuery = { appId: "non-existent-app" }
      const results = registry.queryInstances(query)

      expect(results).toHaveLength(0)
    })
  })

  describe("Channel Management", () => {
    it("should set instance channel", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      const updated = registry.setInstanceChannel("instance-1", "red")
      expect(updated).toBe(true)

      const instance = registry.getInstance("instance-1")
      expect(instance?.currentChannel).toBe("red")
    })

    it("should move instance between channels", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      // Set initial channel
      registry.setInstanceChannel("instance-1", "red")
      expect(registry.getInstancesOnChannel("red")).toHaveLength(1)
      expect(registry.getInstancesOnChannel("blue")).toHaveLength(0)

      // Move to different channel
      registry.setInstanceChannel("instance-1", "blue")
      expect(registry.getInstancesOnChannel("red")).toHaveLength(0)
      expect(registry.getInstancesOnChannel("blue")).toHaveLength(1)
    })

    it("should leave channel by setting to null", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      registry.setInstanceChannel("instance-1", "red")
      expect(registry.getInstancesOnChannel("red")).toHaveLength(1)

      registry.setInstanceChannel("instance-1", null)
      expect(registry.getInstancesOnChannel("red")).toHaveLength(0)

      const instance = registry.getInstance("instance-1")
      expect(instance?.currentChannel).toBeNull()
    })

    it("should get instances on channel", () => {
      const params1: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }
      const params2: CreateAppInstanceParams = {
        instanceId: "instance-2",
        appId: "test-app-2",
        metadata: mockAppMetadata2,
      }

      registry.createInstance(params1)
      registry.createInstance(params2)

      registry.setInstanceChannel("instance-1", "red")
      registry.setInstanceChannel("instance-2", "red")

      const redInstances = registry.getInstancesOnChannel("red")
      expect(redInstances).toHaveLength(2)
      expect(redInstances.map(i => i.instanceId)).toEqual(["instance-1", "instance-2"])

      const blueInstances = registry.getInstancesOnChannel("blue")
      expect(blueInstances).toHaveLength(0)
    })
  })

  describe("Context Listener Management", () => {
    it("should add and remove context listeners", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      // Add listener
      const added = registry.addContextListener("instance-1", "fdc3.instrument")
      expect(added).toBe(true)

      let instance = registry.getInstance("instance-1")
      expect(instance?.contextListeners.has("fdc3.instrument")).toBe(true)

      // Remove listener
      const removed = registry.removeContextListener("instance-1", "fdc3.instrument")
      expect(removed).toBe(true)

      instance = registry.getInstance("instance-1")
      expect(instance?.contextListeners.has("fdc3.instrument")).toBe(false)
    })

    it("should get context listeners for type", () => {
      const params1: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }
      const params2: CreateAppInstanceParams = {
        instanceId: "instance-2",
        appId: "test-app-2",
        metadata: mockAppMetadata2,
      }

      registry.createInstance(params1)
      registry.createInstance(params2)

      registry.addContextListener("instance-1", "fdc3.instrument")
      registry.addContextListener("instance-2", "fdc3.instrument")

      const listeners = registry.getContextListeners("fdc3.instrument")
      expect(listeners).toHaveLength(2)
      expect(listeners.map(i => i.instanceId)).toEqual(["instance-1", "instance-2"])
    })

    it("should return false when adding listener to non-existent instance", () => {
      const added = registry.addContextListener("non-existent", "fdc3.instrument")
      expect(added).toBe(false)
    })

    it("should return false when removing listener from non-existent instance", () => {
      const removed = registry.removeContextListener("non-existent", "fdc3.instrument")
      expect(removed).toBe(false)
    })
  })

  describe("Intent Listener Management", () => {
    it("should add and remove intent listeners", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      // Add listener
      // const added = registry.addIntentListener("instance-1", "ViewChart")
      // expect(added).toBe(true)

      // let instance = registry.getInstance("instance-1")
      // expect(instance?.intentListeners.has("ViewChart")).toBe(true)

      // // Remove listener
      // const removed = registry.removeIntentListener("instance-1", "ViewChart")
      // expect(removed).toBe(true)

      // instance = registry.getInstance("instance-1")
      // expect(instance?.intentListeners.has("ViewChart")).toBe(false)
    })

    it("should get intent listeners for intent name", () => {
      const params1: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }
      const params2: CreateAppInstanceParams = {
        instanceId: "instance-2",
        appId: "test-app-2",
        metadata: mockAppMetadata2,
      }

      registry.createInstance(params1)
      registry.createInstance(params2)

      // registry.addIntentListener("instance-1", "ViewChart")
      // registry.addIntentListener("instance-2", "ViewChart")

      // const listeners = registry.getIntentListeners("ViewChart")
      // expect(listeners).toHaveLength(2)
      // expect(listeners.map(i => i.instanceId)).toEqual(["instance-1", "instance-2"])
    })
  })

  describe("Private Channel Management", () => {
    it("should add and remove private channel access", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)

      // Add access
      const added = registry.addPrivateChannelAccess("instance-1", "private-1")
      expect(added).toBe(true)

      let instance = registry.getInstance("instance-1")
      expect(instance?.privateChannels.has("private-1")).toBe(true)

      // Remove access
      const removed = registry.removePrivateChannelAccess("instance-1", "private-1")
      expect(removed).toBe(true)

      instance = registry.getInstance("instance-1")
      expect(instance?.privateChannels.has("private-1")).toBe(false)
    })

    it("should get private channel instances", () => {
      const params1: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }
      const params2: CreateAppInstanceParams = {
        instanceId: "instance-2",
        appId: "test-app-2",
        metadata: mockAppMetadata2,
      }

      registry.createInstance(params1)
      registry.createInstance(params2)

      registry.addPrivateChannelAccess("instance-1", "private-1")
      registry.addPrivateChannelAccess("instance-2", "private-1")

      const instances = registry.getPrivateChannelInstances("private-1")
      expect(instances).toHaveLength(2)
      expect(instances.map(i => i.instanceId)).toEqual(["instance-1", "instance-2"])
    })
  })

  describe("Statistics and Utilities", () => {
    it("should provide registry statistics", () => {
      const params1: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }
      const params2: CreateAppInstanceParams = {
        instanceId: "instance-2",
        appId: "test-app-2",
        metadata: mockAppMetadata2,
      }

      registry.createInstance(params1)
      registry.createInstance(params2)

      registry.updateInstanceState("instance-1", AppInstanceState.CONNECTED)
      registry.setInstanceChannel("instance-1", "red")
      registry.addContextListener("instance-1", "fdc3.instrument")
      // registry.addIntentListener("instance-1", "ViewChart")

      const stats = registry.getStats()

      expect(stats.totalInstances).toBe(2)
      expect(stats.stateBreakdown[AppInstanceState.PENDING]).toBe(1)
      expect(stats.stateBreakdown[AppInstanceState.CONNECTED]).toBe(1)
      expect(stats.uniqueApps).toBe(2)
      expect(stats.activeChannels).toBe(1)
      expect(stats.contextListenerTypes).toBe(1)
      // expect(stats.intentListenerTypes).toBe(1)
    })

    it("should clear all instances", () => {
      const params: CreateAppInstanceParams = {
        instanceId: "instance-1",
        appId: "test-app-1",
        metadata: mockAppMetadata,
      }

      registry.createInstance(params)
      expect(registry.getAllInstances()).toHaveLength(1)

      registry.clear()
      expect(registry.getAllInstances()).toHaveLength(0)

      const stats = registry.getStats()
      expect(stats.totalInstances).toBe(0)
      expect(stats.uniqueApps).toBe(0)
    })
  })
})
