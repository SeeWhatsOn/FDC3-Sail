/**
 * MessagePortTransport Tests
 *
 * These tests use JSDOM to provide browser APIs (MessagePort, MessageChannel)
 * in the Node.js test environment.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { MessagePortTransport } from "../message-port-transport"

describe("MessagePortTransport", () => {
  let channel: MessageChannel
  let port1: MessagePort
  let port2: MessagePort

  beforeEach(() => {
    // Create a MessageChannel for testing
    channel = new MessageChannel()
    port1 = channel.port1
    port2 = channel.port2
  })

  describe("constructor", () => {
    it("should create transport with MessagePort", () => {
      const transport = new MessagePortTransport(port1)

      expect(transport).toBeInstanceOf(MessagePortTransport)
      expect(transport.isConnected()).toBe(true)
    })

    it("should start the port automatically", () => {
      // MessagePort.start() should be called in constructor
      const startSpy = vi.spyOn(port1, "start")
      new MessagePortTransport(port1)

      expect(startSpy).toHaveBeenCalled()
    })
  })

  describe("send", () => {
    it("should send message through MessagePort", () => {
      const transport = new MessagePortTransport(port1)
      const message = { type: "test", payload: "data" }

      const postMessageSpy = vi.spyOn(port1, "postMessage")
      transport.send(message)

      expect(postMessageSpy).toHaveBeenCalledWith(message)
    })

    it("should throw if transport is disconnected", () => {
      const transport = new MessagePortTransport(port1)
      transport.disconnect()

      expect(() => transport.send({ type: "test" })).toThrow(
        "Cannot send message: MessagePort is disconnected"
      )
    })

    it("should handle postMessage errors", () => {
      const transport = new MessagePortTransport(port1)

      // Mock postMessage to throw
      vi.spyOn(port1, "postMessage").mockImplementation(() => {
        throw new Error("postMessage failed")
      })

      expect(() => transport.send({ type: "test" })).toThrow("postMessage failed")
      // Should mark as disconnected
      expect(transport.isConnected()).toBe(false)
    })
  })

  describe("onMessage", () => {
    it("should register message handler", () => {
      return new Promise<void>((resolve) => {
        const transport1 = new MessagePortTransport(port1)
        const transport2 = new MessagePortTransport(port2)

        const testMessage = { type: "test", payload: "hello" }

        transport2.onMessage((msg) => {
          expect(msg).toEqual(testMessage)
          resolve()
        })

        transport1.send(testMessage)
      })
    })

    it("should handle multiple messages", () => {
      return new Promise<void>((resolve) => {
        const transport1 = new MessagePortTransport(port1)
        const transport2 = new MessagePortTransport(port2)

        const messages: unknown[] = []
        const expectedMessages = [
          { type: "msg1" },
          { type: "msg2" },
          { type: "msg3" }
        ]

        transport2.onMessage((msg) => {
          messages.push(msg)
          if (messages.length === expectedMessages.length) {
            expect(messages).toEqual(expectedMessages)
            resolve()
          }
        })

        expectedMessages.forEach(msg => transport1.send(msg))
      })
    })

    it("should catch errors in message handler", async () => {
      const transport1 = new MessagePortTransport(port1)
      const transport2 = new MessagePortTransport(port2)

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      transport2.onMessage(() => {
        throw new Error("Handler error")
      })

      transport1.send({ type: "test" })

      // Give time for message to be processed
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in message handler:",
        expect.any(Error)
      )
      consoleErrorSpy.mockRestore()
    })

    it("should not process messages after disconnect", async () => {
      const transport1 = new MessagePortTransport(port1)
      const transport2 = new MessagePortTransport(port2)

      const handler = vi.fn()
      transport2.onMessage(handler)

      transport2.disconnect()
      transport1.send({ type: "test" })

      // Give time for message (should not arrive)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe("onDisconnect", () => {
    it("should register disconnect handler", () => {
      const transport = new MessagePortTransport(port1)
      const handler = vi.fn()

      transport.onDisconnect(handler)
      transport.disconnect()

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("should catch errors in disconnect handler", () => {
      const transport = new MessagePortTransport(port1)
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      transport.onDisconnect(() => {
        throw new Error("Disconnect handler error")
      })

      transport.disconnect()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in disconnect handler:",
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe("isConnected", () => {
    it("should return true when connected", () => {
      const transport = new MessagePortTransport(port1)

      expect(transport.isConnected()).toBe(true)
    })

    it("should return false after disconnect", () => {
      const transport = new MessagePortTransport(port1)

      transport.disconnect()

      expect(transport.isConnected()).toBe(false)
    })
  })

  describe("disconnect", () => {
    it("should close the MessagePort", () => {
      const transport = new MessagePortTransport(port1)
      const closeSpy = vi.spyOn(port1, "close")

      transport.disconnect()

      expect(closeSpy).toHaveBeenCalled()
    })

    it("should set connected to false", () => {
      const transport = new MessagePortTransport(port1)

      transport.disconnect()

      expect(transport.isConnected()).toBe(false)
    })

    it("should be idempotent", () => {
      const transport = new MessagePortTransport(port1)
      const handler = vi.fn()
      transport.onDisconnect(handler)

      transport.disconnect()
      transport.disconnect()
      transport.disconnect()

      // Should only call handler once
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("should call disconnect handler", () => {
      const transport = new MessagePortTransport(port1)
      const handler = vi.fn()

      transport.onDisconnect(handler)
      transport.disconnect()

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe("bidirectional communication", () => {
    it("should support bidirectional message exchange", () => {
      return new Promise<void>((resolve) => {
        const transport1 = new MessagePortTransport(port1)
        const transport2 = new MessagePortTransport(port2)

        const messages1: unknown[] = []
        const messages2: unknown[] = []

        const checkComplete = () => {
          if (messages1.length === 2 && messages2.length === 2) {
            expect(messages1).toEqual([{ from: 2, count: 1 }, { from: 2, count: 2 }])
            expect(messages2).toEqual([{ from: 1, count: 1 }, { from: 1, count: 2 }])
            resolve()
          }
        }

        transport1.onMessage((msg) => {
          messages1.push(msg)
          checkComplete()
        })

        transport2.onMessage((msg) => {
          messages2.push(msg)
          checkComplete()
        })

        transport1.send({ from: 1, count: 1 })
        transport2.send({ from: 2, count: 1 })
        transport1.send({ from: 1, count: 2 })
        transport2.send({ from: 2, count: 2 })
      })
    })
  })

  describe("structured clone behavior", () => {
    it("should clone complex objects", () => {
      return new Promise<void>((resolve) => {
        const transport1 = new MessagePortTransport(port1)
        const transport2 = new MessagePortTransport(port2)

        const complexMessage = {
          nested: {
            deep: {
              value: "test",
              array: [1, 2, 3],
              date: new Date("2024-01-01")
            }
          }
        }

        transport2.onMessage((msg: any) => {
          expect(msg).toEqual(complexMessage)
          // Date should be cloned
          expect(msg.nested.deep.date).toBeInstanceOf(Date)
          expect(msg.nested.deep.date.getTime()).toBe(complexMessage.nested.deep.date.getTime())
          resolve()
        })

        transport1.send(complexMessage)
      })
    })

    it("should prevent shared references", () => {
      return new Promise<void>((resolve) => {
        const transport1 = new MessagePortTransport(port1)
        const transport2 = new MessagePortTransport(port2)

        const original = { nested: { value: "original" } }

        transport2.onMessage((msg: any) => {
          // Modify received message
          msg.nested.value = "modified"

          // Original should be unchanged (because structuredClone creates a copy)
          expect(original.nested.value).toBe("original")
          resolve()
        })

        transport1.send(original)
      })
    })
  })
})
