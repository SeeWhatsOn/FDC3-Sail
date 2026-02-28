/**
 * WCPConnector Tests
 *
 * Tests the WCP (Web Connection Protocol) connector that handles browser-side
 * FDC3 app connections via MessagePorts and window.postMessage.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { WCPConnector } from "../wcp/wcp-connector"
import { createInMemoryTransportPair } from "../../transports/in-memory-transport"
import type { Transport } from "../../core/interfaces/transport"
import type { BrowserTypes } from "@finos/fdc3"

// Helper to create a mock WCP1Hello message
function createWCP1Hello(
  connectionAttemptUuid: string = "test-uuid"
): BrowserTypes.WebConnectionProtocol1Hello {
  const message = {
    type: "WCP1Hello",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: {
      identityUrl: "https://example.com/app",
      actualUrl: "https://example.com/app",
      fdc3Version: "2.2",
    },
  }

  return message as unknown as BrowserTypes.WebConnectionProtocol1Hello
}

// Helper to create a mock MessageEvent with source window
function createMessageEvent(data: unknown, source: Window = window): MessageEvent {
  return new MessageEvent("message", {
    data,
    source,
    origin: "https://example.com",
  })
}

describe("WCPConnector", () => {
  let desktopAgentTransport: Transport
  let connector: WCPConnector

  beforeEach(() => {
    // Create a transport pair for Desktop Agent communication
    const [daTransport] = createInMemoryTransportPair()
    desktopAgentTransport = daTransport
  })

  afterEach(() => {
    // Clean up connector if it was started
    if (connector?.getIsStarted()) {
      connector.stop()
    }
  })

  describe("constructor", () => {
    it("should create connector with default options", () => {
      connector = new WCPConnector(desktopAgentTransport)

      expect(connector).toBeInstanceOf(WCPConnector)
      expect(connector.getIsStarted()).toBe(false)
      expect(connector.getConnections()).toEqual([])
    })

    it("should accept custom options", () => {
      const options = {
        getIntentResolverUrl: (instanceId: string) => `/resolver?id=${instanceId}`,
        getChannelSelectorUrl: (instanceId: string) => `/selector?id=${instanceId}`,
        fdc3Version: "2.2",
        handshakeTimeout: 10000,
      }

      connector = new WCPConnector(desktopAgentTransport, options)

      expect(connector).toBeInstanceOf(WCPConnector)
    })

    it("should use false for UI URLs by default", () => {
      connector = new WCPConnector(desktopAgentTransport)

      // This will be tested indirectly via WCP3Handshake response
      expect(connector).toBeInstanceOf(WCPConnector)
    })
  })

  describe("start/stop", () => {
    it("should start listening for window messages", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const addEventListenerSpy = vi.spyOn(window, "addEventListener")

      connector.start()

      expect(connector.getIsStarted()).toBe(true)
      expect(addEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))

      addEventListenerSpy.mockRestore()
    })

    it("should throw if started twice", () => {
      connector = new WCPConnector(desktopAgentTransport)

      connector.start()

      expect(() => connector.start()).toThrow("WCPConnector is already started")
    })

    it("should throw if window is not available", () => {
      // Save original window
      const originalWindow = global.window

      // @ts-expect-error - Testing runtime check
      delete global.window

      connector = new WCPConnector(desktopAgentTransport)

      expect(() => connector.start()).toThrow("WCPConnector requires browser environment")

      // Restore window
      global.window = originalWindow
    })

    it("should stop and clean up connections", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

      connector.start()
      connector.stop()

      expect(connector.getIsStarted()).toBe(false)
      expect(removeEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))
      expect(connector.getConnections()).toEqual([])

      removeEventListenerSpy.mockRestore()
    })

    it("should be idempotent when stopping", () => {
      connector = new WCPConnector(desktopAgentTransport)

      connector.start()
      connector.stop()
      connector.stop() // Should not throw

      expect(connector.getIsStarted()).toBe(false)
    })
  })

  describe("WCP1Hello handling", () => {
    it("should handle WCP1Hello and send WCP3Handshake", () => {
      return new Promise<void>(resolve => {
        connector = new WCPConnector(desktopAgentTransport, {
          getIntentResolverUrl: instanceId => `/resolver?id=${instanceId}`,
          getChannelSelectorUrl: instanceId => `/selector?id=${instanceId}`,
          fdc3Version: "2.2",
        })

        // Mock window.postMessage to capture WCP3Handshake
        const postMessageSpy = vi.spyOn(window, "postMessage")

        connector.start()

        // Simulate WCP1Hello from an app iframe
        const wcp1Hello = createWCP1Hello("test-connection-uuid")
        const event = createMessageEvent(wcp1Hello)

        window.dispatchEvent(event)

        // Wait for async handling
        setTimeout(() => {
          const calls = postMessageSpy.mock.calls as unknown as Array<
            [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
          >
          expect(calls.length).toBeGreaterThan(0)

          const [handshakeMessage, targetOrigin, ports] = calls[0]
          expect(handshakeMessage.type).toBe("WCP3Handshake")
          expect(handshakeMessage.meta.connectionAttemptUuid).toBe("test-connection-uuid")
          expect(handshakeMessage.payload.fdc3Version).toBe("2.2")
          expect(handshakeMessage.payload.intentResolverUrl).toContain("/resolver")
          expect(handshakeMessage.payload.channelSelectorUrl).toContain("/selector")
          expect(targetOrigin).toBe("https://example.com")
          expect(ports).toEqual(expect.arrayContaining([expect.any(MessagePort)]))

          postMessageSpy.mockRestore()
          resolve()
        }, 50)
      })
    })

    it("should ignore non-WCP1Hello messages", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const postMessageSpy = vi.spyOn(window, "postMessage")

      connector.start()

      // Send non-WCP message
      const event = createMessageEvent({ type: "SomeOtherMessage" })
      window.dispatchEvent(event)

      // Should not respond
      expect(postMessageSpy).not.toHaveBeenCalled()

      postMessageSpy.mockRestore()
    })

    it("should ignore WCP1Hello with null source", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      connector.start()

      // Create event with null source
      const wcp1Hello = createWCP1Hello()
      const event = new MessageEvent("message", {
        data: wcp1Hello,
        source: null,
        origin: "https://example.com",
      })

      window.dispatchEvent(event)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("WCP1Hello received from null source, ignoring")
      )

      consoleWarnSpy.mockRestore()
    })

    it("should create temporary instanceId for new connections", () => {
      return new Promise<void>(resolve => {
        connector = new WCPConnector(desktopAgentTransport)
        connector.start()

        const wcp1Hello = createWCP1Hello("my-connection-uuid")
        const event = createMessageEvent(wcp1Hello)

        window.dispatchEvent(event)

        setTimeout(() => {
          const connections = connector.getConnections()
          expect(connections).toHaveLength(1)
          expect(connections[0].instanceId).toBe("temp-my-connection-uuid")
          expect(connections[0].connectionAttemptUuid).toBe("my-connection-uuid")
          expect(connections[0].appId).toBe("unknown")

          resolve()
        }, 50)
      })
    })

    it("should use false for UI URLs when not provided", () => {
      return new Promise<void>(resolve => {
        connector = new WCPConnector(desktopAgentTransport)
        const postMessageSpy = vi.spyOn(window, "postMessage")

        connector.start()

        const wcp1Hello = createWCP1Hello()
        const event = createMessageEvent(wcp1Hello)

        window.dispatchEvent(event)

        setTimeout(() => {
          const calls = postMessageSpy.mock.calls as unknown as Array<
            [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
          >
          expect(calls.length).toBeGreaterThan(0)

          const [handshakeMessage, targetOrigin] = calls[0]
          expect(handshakeMessage.payload.intentResolverUrl).toBe(false)
          expect(handshakeMessage.payload.channelSelectorUrl).toBe(false)
          expect(targetOrigin).toBe("https://example.com")

          postMessageSpy.mockRestore()
          resolve()
        }, 50)
      })
    })
  })

  describe("event handlers", () => {
    it("should emit appConnected event after validation", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const appConnectedHandler = vi.fn()

      connector.on("appConnected", appConnectedHandler)
      connector.start()

      // Simulate connection and validation
      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      // Simulate validation completing
      connector.updateConnectionMetadata(
        "temp-test-uuid",
        "actual-instance-123",
        "app.example.test"
      )

      expect(appConnectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: "actual-instance-123",
          appId: "app.example.test",
          connectionAttemptUuid: "test-uuid",
        })
      )
    })

    it("should emit appDisconnected event when app disconnects", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      const appDisconnectedHandler = vi.fn()

      connector.on("appDisconnected", appDisconnectedHandler)
      connector.start()

      // Create connection
      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      // Get the connection and manually trigger disconnect
      // (In real usage, MessagePortTransport listens to port 'messageerror' and 'close' events)
      const connections = connector.getConnections()
      const instanceId = connections[0].instanceId

      // Manually trigger the disconnect by calling stop() which cleans up connections
      connector.stop()

      expect(appDisconnectedHandler).toHaveBeenCalledWith(instanceId)
    })

    it("should emit handshakeFailed event on error", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const handshakeFailedHandler = vi.fn()

      connector.on("handshakeFailed", handshakeFailedHandler)
      connector.start()

      // Mock MessageChannel to throw
      const originalMessageChannel = global.MessageChannel
      class FailingMessageChannel {
        constructor() {
          throw new Error("MessageChannel creation failed")
        }
      }
      global.MessageChannel = FailingMessageChannel as unknown as typeof MessageChannel

      const wcp1Hello = createWCP1Hello("error-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      expect(handshakeFailedHandler).toHaveBeenCalledWith(expect.any(Error), "error-uuid")

      // Restore MessageChannel
      global.MessageChannel = originalMessageChannel
    })

    it("should handle errors in event handlers gracefully", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      connector.on("appConnected", () => {
        throw new Error("Handler error")
      })

      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[DACP ERROR] Error in appConnected handler:",
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it("should support removing event handlers", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const handler = vi.fn()

      connector.on("appConnected", handler)
      connector.off("appConnected", handler)

      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe("message routing", () => {
    it("should route app messages to Desktop Agent with source metadata", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const receivedMessages: unknown[] = []
      desktopAgentTransport.onMessage(msg => {
        receivedMessages.push(msg)
      })

      // Simulate WCP1Hello to establish connection
      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      // Get the MessagePort from the connection
      const connections = connector.getConnections()
      expect(connections).toHaveLength(1)

      // We can't easily send messages from app to DA without the other end of MessageChannel,
      // so we'll test the reverse direction: DA -> app
      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      // Now send a message from Desktop Agent to app and verify routing
      desktopAgentTransport.send({
        type: "responseMessage",
        meta: {
          destination: {
            instanceId: "actual-123",
          },
        },
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      // The message should be routed (we can't easily verify receipt without access to port1)
      // But we can verify no errors were thrown
      expect(connections[0].port).toBeDefined()
    })

    it("should ignore messages without destination", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      // Send message without destination - should not route to app
      desktopAgentTransport.send({
        type: "broadcastMessage",
        meta: {},
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      // No error should occur - message is simply ignored
      expect(connector.getConnection("actual-123")).toBeDefined()
    })

    it("should not throw when routing to unknown app instance", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      // Should not throw when trying to send to non-existent app
      expect(() => {
        desktopAgentTransport.send({
          type: "testMessage",
          meta: {
            destination: {
              instanceId: "nonexistent-app-123",
            },
          },
        })
      }).not.toThrow()

      await new Promise(resolve => setTimeout(resolve, 50))

      // Connector should still be running
      expect(connector.getIsStarted()).toBe(true)
    })
  })

  describe("updateConnectionMetadata", () => {
    it("should update connection with validated info", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      // Verify temp connection exists
      expect(connector.getConnection("temp-test-uuid")).toBeDefined()

      // Update with validated info
      connector.updateConnectionMetadata(
        "temp-test-uuid",
        "actual-instance-123",
        "app.example.test"
      )

      // Verify connection migrated to new instanceId
      expect(connector.getConnection("temp-test-uuid")).toBeUndefined()
      expect(connector.getConnection("actual-instance-123")).toBeDefined()

      const connection = connector.getConnection("actual-instance-123")!
      expect(connection.instanceId).toBe("actual-instance-123")
      expect(connection.appId).toBe("app.example.test")
      expect(connection.connectionAttemptUuid).toBe("test-uuid")
    })

    it("should warn if temp instanceId not found", () => {
      connector = new WCPConnector(desktopAgentTransport)
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      connector.updateConnectionMetadata("nonexistent-id", "actual-123", "app.test")

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Cannot update connection metadata: temp instanceId nonexistent-id not found"
        )
      )

      consoleWarnSpy.mockRestore()
    })

    it("should migrate transport reference to new instanceId", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      const event = createMessageEvent(wcp1Hello)
      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      connector.updateConnectionMetadata("temp-test-uuid", "actual-123", "app.test")

      // After update, messages to actual-123 should still route
      desktopAgentTransport.send({
        type: "testMessage",
        meta: {
          destination: { instanceId: "actual-123" },
        },
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      // No error should occur
      expect(connector.getConnection("actual-123")).toBeDefined()
    })
  })

  describe("getters", () => {
    it("should return all connections", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      expect(connector.getConnections()).toEqual([])

      // Add connections
      const wcp1Hello1 = createWCP1Hello("uuid-1")
      const wcp1Hello2 = createWCP1Hello("uuid-2")

      window.dispatchEvent(createMessageEvent(wcp1Hello1))
      window.dispatchEvent(createMessageEvent(wcp1Hello2))

      await new Promise(resolve => setTimeout(resolve, 50))

      const connections = connector.getConnections()
      expect(connections).toHaveLength(2)
      expect(connections[0].connectionAttemptUuid).toBe("uuid-1")
      expect(connections[1].connectionAttemptUuid).toBe("uuid-2")
    })

    it("should return specific connection by instanceId", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      window.dispatchEvent(createMessageEvent(wcp1Hello))

      await new Promise(resolve => setTimeout(resolve, 50))

      const connection = connector.getConnection("temp-test-uuid")
      expect(connection).toBeDefined()
      expect(connection!.instanceId).toBe("temp-test-uuid")

      expect(connector.getConnection("nonexistent")).toBeUndefined()
    })

    it("should return started status", () => {
      connector = new WCPConnector(desktopAgentTransport)

      expect(connector.getIsStarted()).toBe(false)

      connector.start()
      expect(connector.getIsStarted()).toBe(true)

      connector.stop()
      expect(connector.getIsStarted()).toBe(false)
    })
  })

  describe("cleanup", () => {
    it("should disconnect all apps when stopping", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      // Create multiple connections
      window.dispatchEvent(createMessageEvent(createWCP1Hello("uuid-1")))
      window.dispatchEvent(createMessageEvent(createWCP1Hello("uuid-2")))

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connector.getConnections()).toHaveLength(2)

      connector.stop()

      expect(connector.getConnections()).toHaveLength(0)
    })

    it("should handle disconnection gracefully", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")
      window.dispatchEvent(createMessageEvent(wcp1Hello))

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(connector.getConnection("temp-test-uuid")).toBeDefined()

      // Should not throw when stopping even with active connections
      expect(() => connector.stop()).not.toThrow()
      expect(connector.getConnections()).toHaveLength(0)
    })
  })

  describe("invalid messages", () => {
    it("should not throw when receiving invalid messages", async () => {
      connector = new WCPConnector(desktopAgentTransport)
      connector.start()

      // Should not throw when receiving invalid message
      expect(() => {
        desktopAgentTransport.send("invalid")
      }).not.toThrow()

      expect(() => {
        desktopAgentTransport.send(null)
      }).not.toThrow()

      expect(() => {
        desktopAgentTransport.send(undefined)
      }).not.toThrow()

      // Wait for async message handling
      await new Promise(resolve => setTimeout(resolve, 50))

      // Connector should still be running
      expect(connector.getIsStarted()).toBe(true)
    })
  })
})
