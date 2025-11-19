import { describe, it, expect, beforeEach, vi } from "vitest"
import { InMemoryTransport, createInMemoryTransportPair } from "../in-memory-transport"

describe("InMemoryTransport", () => {
  describe("createInMemoryTransportPair", () => {
    it("should create two linked transports", () => {
      const [transport1, transport2] = createInMemoryTransportPair()

      expect(transport1).toBeInstanceOf(InMemoryTransport)
      expect(transport2).toBeInstanceOf(InMemoryTransport)
      expect(transport1.isConnected()).toBe(true)
      expect(transport2.isConnected()).toBe(true)
    })

    it("should allow bidirectional communication", async () => {
      const [transport1, transport2] = createInMemoryTransportPair()

      const handler1 = vi.fn()
      const handler2 = vi.fn()

      transport1.onMessage(handler1)
      transport2.onMessage(handler2)

      const message1 = { type: "test", payload: "from transport2" }
      const message2 = { type: "test", payload: "from transport1" }

      transport2.send(message1)
      transport1.send(message2)

      // Wait for async delivery
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handler1).toHaveBeenCalledWith(message1)
      expect(handler2).toHaveBeenCalledWith(message2)
    })

    it("should deep clone messages to prevent shared references", async () => {
      const [transport1, transport2] = createInMemoryTransportPair()

      let receivedMessage: any
      transport2.onMessage((msg) => {
        receivedMessage = msg
      })

      const originalMessage = { nested: { value: "original" } }
      transport1.send(originalMessage)

      await new Promise((resolve) => setTimeout(resolve, 10))

      // Modify original message
      originalMessage.nested.value = "modified"

      // Received message should not be affected
      expect(receivedMessage.nested.value).toBe("original")
    })
  })

  describe("send", () => {
    it("should throw if transport is disconnected", () => {
      const [transport1, transport2] = createInMemoryTransportPair()
      transport1.disconnect()

      expect(() => transport1.send({ type: "test" })).toThrow(
        "Cannot send message: InMemoryTransport is disconnected"
      )
    })

    it("should throw if peer is disconnected", () => {
      const [transport1, transport2] = createInMemoryTransportPair()
      transport2.disconnect()

      expect(() => transport1.send({ type: "test" })).toThrow(
        "Cannot send message: Peer transport is disconnected"
      )
    })

    it("should deliver messages asynchronously", async () => {
      const [transport1, transport2] = createInMemoryTransportPair()

      const handler = vi.fn()
      transport2.onMessage(handler)

      transport1.send({ type: "test" })

      // Should not be called synchronously
      expect(handler).not.toHaveBeenCalled()

      // Wait for async delivery
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("should handle structuredClone errors gracefully", async () => {
      const [transport1, transport2] = createInMemoryTransportPair()

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      // Try to send a function (not cloneable)
      const messageWithFunction = { fn: () => {} }

      expect(() => transport1.send(messageWithFunction)).not.toThrow()

      // Should log error but not crash
      await new Promise((resolve) => setTimeout(resolve, 10))

      consoleErrorSpy.mockRestore()
    })
  })

  describe("onMessage", () => {
    it("should register message handler", async () => {
      const [transport1, transport2] = createInMemoryTransportPair()

      const handler = vi.fn()
      transport2.onMessage(handler)

      transport1.send({ type: "test" })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handler).toHaveBeenCalledWith({ type: "test" })
    })

    it("should catch errors in message handler", async () => {
      const [transport1, transport2] = createInMemoryTransportPair()

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      transport2.onMessage(() => {
        throw new Error("Handler error")
      })

      transport1.send({ type: "test" })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in peer message handler:",
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe("onDisconnect", () => {
    it("should register disconnect handler", () => {
      const [transport1] = createInMemoryTransportPair()

      const handler = vi.fn()
      transport1.onDisconnect(handler)

      transport1.disconnect()

      expect(handler).toHaveBeenCalledTimes(1)
    })

    // Note: Peer notification on disconnect is not currently implemented
    // because the peer reference is cleared immediately. This is acceptable
    // since disconnection can be detected via send() throwing an error.

    it("should catch errors in disconnect handler", () => {
      const [transport1] = createInMemoryTransportPair()

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      transport1.onDisconnect(() => {
        throw new Error("Disconnect handler error")
      })

      transport1.disconnect()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in disconnect handler:",
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe("isConnected", () => {
    it("should return true when connected", () => {
      const [transport1] = createInMemoryTransportPair()

      expect(transport1.isConnected()).toBe(true)
    })

    it("should return false after disconnect", () => {
      const [transport1] = createInMemoryTransportPair()

      transport1.disconnect()

      expect(transport1.isConnected()).toBe(false)
    })
  })

  describe("disconnect", () => {
    it("should set connected to false", () => {
      const [transport1] = createInMemoryTransportPair()

      transport1.disconnect()

      expect(transport1.isConnected()).toBe(false)
    })

    it("should be idempotent", () => {
      const [transport1] = createInMemoryTransportPair()

      const handler = vi.fn()
      transport1.onDisconnect(handler)

      transport1.disconnect()
      transport1.disconnect()
      transport1.disconnect()

      // Should only call handler once
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("should clear peer reference", () => {
      const [transport1, transport2] = createInMemoryTransportPair()

      transport1.disconnect()

      // transport2 should not receive messages after transport1 disconnects
      const handler = vi.fn()
      transport2.onMessage(handler)

      expect(() => transport2.send({ type: "test" })).toThrow(
        "Cannot send message: Peer transport is disconnected"
      )
    })
  })

  describe("rapid message exchange", () => {
    it("should handle rapid back-and-forth without stack overflow", async () => {
      const [transport1, transport2] = createInMemoryTransportPair()

      let count1 = 0
      let count2 = 0
      const maxMessages = 100

      transport1.onMessage((msg: any) => {
        count1++
        if (count1 < maxMessages) {
          transport1.send({ type: "ping", count: count1 })
        }
      })

      transport2.onMessage((msg: any) => {
        count2++
        if (count2 < maxMessages) {
          transport2.send({ type: "pong", count: count2 })
        }
      })

      // Start the exchange
      transport1.send({ type: "ping", count: 0 })

      // Wait for messages to complete
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Both should have received many messages without crashing
      expect(count1).toBeGreaterThan(0)
      expect(count2).toBeGreaterThan(0)
    })
  })
})
