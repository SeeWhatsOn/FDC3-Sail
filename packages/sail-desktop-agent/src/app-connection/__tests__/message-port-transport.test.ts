import { describe, expect, it, vi } from "vitest"
import { MessagePortTransport } from "../message-port"

describe("MessagePortTransport", () => {
  it("starts connected and can send", () => {
    const channel = new MessageChannel()
    const transport = new MessagePortTransport(channel.port1)
    const spy = vi.spyOn(channel.port1, "postMessage")

    expect(transport.isConnected()).toBe(true)
    transport.send({ type: "test" })
    expect(spy).toHaveBeenCalledWith({ type: "test" })

    transport.disconnect()
  })

  it("throws after disconnect", () => {
    const channel = new MessageChannel()
    const transport = new MessagePortTransport(channel.port1)
    transport.disconnect()
    expect(() => transport.send({ type: "test" })).toThrow(/disconnected/)
  })

  it("delivers messages to onMessage handler", async () => {
    const channel = new MessageChannel()
    const transport = new MessagePortTransport(channel.port2)
    const received: unknown[] = []
    transport.onMessage((msg) => {
      received.push(msg)
    })

    channel.port1.start()
    channel.port1.postMessage({ type: "hello" })

    await vi.waitFor(() => {
      expect(received).toEqual([{ type: "hello" }])
    })

    transport.disconnect()
    channel.port1.close()
  })
})
