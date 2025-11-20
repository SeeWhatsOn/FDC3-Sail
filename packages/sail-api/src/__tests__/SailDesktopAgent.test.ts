import { describe, it, expect, vi } from "vitest"
import { SailDesktopAgent } from "../SailDesktopAgent"
import { InMemoryTransport } from "@finos/fdc3-sail-desktop-agent/transports"

describe("SailDesktopAgent", () => {
  it("should support InMemoryTransport", async () => {
    const transport = new InMemoryTransport()
    const agent = new SailDesktopAgent({ transport })

    expect(agent.getTransport()).toBe(transport)
    expect(agent.getAgent()).toBeDefined()
  })

  it("should apply middleware", async () => {
    const transport = new InMemoryTransport()
    const agent = new SailDesktopAgent({ transport })

    const middleware = vi.fn(async (_ctx, next) => {
      await next()
    })

    agent.use(middleware)
    agent.start()

    // Simulate incoming message
    // We need a peer transport to send a message
    const peerTransport = new InMemoryTransport()
    transport.setPeer(peerTransport)
    peerTransport.setPeer(transport)

    const message = { type: "test" }
    peerTransport.send(message)

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(middleware).toHaveBeenCalled()
  })
})
