/**

 * BrowserAppConnection Tests

 *

 * Tests the WCP (Web Connection Protocol) browser connection backend that handles

 * FDC3 app connections via MessagePorts and window.postMessage.

 *

 * @vitest-environment jsdom

 */

import { describe, it, expect, afterEach, vi } from "vite-plus/test"

import { BrowserAppConnection } from "../../app-connection/browser-app-connection"

import type { BrowserTypes } from "@finos/fdc3"

import { createMessageEvent, createWCP1Hello } from "./wcp-connector-test-helpers"

describe("BrowserAppConnection", () => {
  let connector: BrowserAppConnection

  afterEach(() => {
    if (connector?.getIsStarted()) {
      connector.stop()
    }
  })

  describe("constructor", () => {
    it("should create connector with default options", () => {
      connector = new BrowserAppConnection()

      expect(connector).toBeInstanceOf(BrowserAppConnection)

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

      connector = new BrowserAppConnection(options)

      expect(connector).toBeInstanceOf(BrowserAppConnection)
    })

    it("should use false for UI URLs by default", () => {
      connector = new BrowserAppConnection()

      expect(connector).toBeInstanceOf(BrowserAppConnection)
    })
  })

  describe("start/stop", () => {
    it("should start listening for window messages", () => {
      connector = new BrowserAppConnection()

      const addEventListenerSpy = vi.spyOn(window, "addEventListener")

      connector.start()

      expect(connector.getIsStarted()).toBe(true)

      expect(addEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))

      addEventListenerSpy.mockRestore()
    })

    it("should throw if started twice", () => {
      connector = new BrowserAppConnection()

      connector.start()

      expect(() => connector.start()).toThrow("BrowserAppConnection is already started")
    })

    it("should throw if window is not available", () => {
      const originalWindow = global.window

      // @ts-expect-error - Testing runtime check

      delete global.window

      connector = new BrowserAppConnection()

      expect(() => connector.start()).toThrow("BrowserAppConnection requires a browser environment")

      global.window = originalWindow
    })

    it("should stop and clean up connections", () => {
      connector = new BrowserAppConnection()

      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

      connector.start()

      connector.stop()

      expect(connector.getIsStarted()).toBe(false)

      expect(removeEventListenerSpy).toHaveBeenCalledWith("message", expect.any(Function))

      expect(connector.getConnections()).toEqual([])

      removeEventListenerSpy.mockRestore()
    })

    it("should be idempotent when stopping", () => {
      connector = new BrowserAppConnection()

      connector.start()

      connector.stop()

      connector.stop()

      expect(connector.getIsStarted()).toBe(false)
    })
  })

  describe("WCP1Hello handling", () => {
    it("should handle WCP1Hello and send WCP3Handshake", () => {
      return new Promise<void>(resolve => {
        connector = new BrowserAppConnection({
          getIntentResolverUrl: instanceId => `/resolver?id=${instanceId}`,

          getChannelSelectorUrl: instanceId => `/selector?id=${instanceId}`,

          fdc3Version: "2.2",
        })

        const postMessageSpy = vi.spyOn(window, "postMessage")

        connector.start()

        const wcp1Hello = createWCP1Hello("test-connection-uuid")

        const event = createMessageEvent(wcp1Hello)

        window.dispatchEvent(event)

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
      connector = new BrowserAppConnection()

      const postMessageSpy = vi.spyOn(window, "postMessage")

      connector.start()

      const event = createMessageEvent({ type: "SomeOtherMessage" })

      window.dispatchEvent(event)

      expect(postMessageSpy).not.toHaveBeenCalled()

      postMessageSpy.mockRestore()
    })

    it("should ignore WCP1Hello with null source", () => {
      connector = new BrowserAppConnection()

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      connector.start()

      const wcp1Hello = createWCP1Hello()

      const event = new MessageEvent("message", {
        data: wcp1Hello,

        source: null,

        origin: "https://example.com",
      })

      window.dispatchEvent(event)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("WCP1Hello received from null source, ignoring"),
      )

      consoleWarnSpy.mockRestore()
    })

    it("should create temporary instanceId for new connections", () => {
      return new Promise<void>(resolve => {
        connector = new BrowserAppConnection()

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
        connector = new BrowserAppConnection()

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
      connector = new BrowserAppConnection()

      const appConnectedHandler = vi.fn()

      connector.on("appConnected", appConnectedHandler)

      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")

      const event = createMessageEvent(wcp1Hello)

      window.dispatchEvent(event)

      connector.updateConnectionMetadata(
        "temp-test-uuid",

        "actual-instance-123",

        "app.example.test",
      )

      expect(appConnectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: "actual-instance-123",

          appId: "app.example.test",

          connectionAttemptUuid: "test-uuid",
        }),
      )
    })

    it("should emit appDisconnected event when app disconnects", async () => {
      connector = new BrowserAppConnection()

      const appDisconnectedHandler = vi.fn()

      connector.on("appDisconnected", appDisconnectedHandler)

      connector.start()

      const wcp1Hello = createWCP1Hello("test-uuid")

      const event = createMessageEvent(wcp1Hello)

      window.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 50))

      const connections = connector.getConnections()

      const instanceId = connections[0].instanceId

      connector.stop()

      expect(appDisconnectedHandler).toHaveBeenCalledTimes(1)

      expect(appDisconnectedHandler).toHaveBeenCalledWith(instanceId)
    })

    it("should emit handshakeFailed event on error", () => {
      connector = new BrowserAppConnection()

      const handshakeFailedHandler = vi.fn()

      connector.on("handshakeFailed", handshakeFailedHandler)

      connector.start()

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

      global.MessageChannel = originalMessageChannel
    })

    it("should handle errors in event handlers gracefully", () => {
      connector = new BrowserAppConnection()

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

        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })

    it("should support removing event handlers", () => {
      connector = new BrowserAppConnection()

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
})
