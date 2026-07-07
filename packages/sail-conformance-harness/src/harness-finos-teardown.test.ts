import { describe, expect, it, vi } from "vite-plus/test"

import {
  createHarnessFinOsTeardownObserver,
  installHarnessInboundAppMessageObserver,
  parseMockAppControlTeardownBroadcast,
} from "./harness-finos-teardown"
import type { HarnessInstanceCleanup } from "./harness-instance-lifecycle"

describe("parseMockAppControlTeardownBroadcast", () => {
  it("detects mock app-control windowClosed teardown from a mock app", () => {
    expect(
      parseMockAppControlTeardownBroadcast({
        type: "broadcastRequest",
        meta: {
          source: { appId: "ChannelsAppId", instanceId: "mock-instance-1" },
        },
        payload: {
          channelId: "app-control",
          context: { type: "windowClosed" },
        },
      }),
    ).toEqual({ appId: "ChannelsAppId", instanceId: "mock-instance-1" })
  })

  it("ignores Conformance1 teardown broadcasts", () => {
    expect(
      parseMockAppControlTeardownBroadcast({
        type: "broadcastRequest",
        meta: {
          source: { appId: "Conformance1", instanceId: "conformance-1" },
        },
        payload: {
          channelId: "app-control",
          context: { type: "windowClosed" },
        },
      }),
    ).toBeUndefined()
  })

  it("ignores non app-control channels", () => {
    expect(
      parseMockAppControlTeardownBroadcast({
        type: "broadcastRequest",
        meta: {
          source: { appId: "ChannelsAppId", instanceId: "mock-instance-1" },
        },
        payload: {
          channelId: "custom-app-channel",
          context: { type: "windowClosed" },
        },
      }),
    ).toBeUndefined()
  })
})

describe("createHarnessFinOsTeardownObserver", () => {
  it("disconnects mock instance after FINOS teardown broadcast (deferred)", async () => {
    vi.useFakeTimers()

    const disconnectHarnessInstance = vi.fn()
    const instanceCleanup = {
      disconnectHarnessInstance,
    } as HarnessInstanceCleanup

    const observer = createHarnessFinOsTeardownObserver({ instanceCleanup })

    observer({
      type: "broadcastRequest",
      meta: {
        source: { appId: "ChannelsAppId", instanceId: "mock-instance-2" },
      },
      payload: {
        channelId: "app-control",
        context: { type: "windowClosed" },
      },
    })

    expect(disconnectHarnessInstance).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(disconnectHarnessInstance).toHaveBeenCalledWith("mock-instance-2")

    vi.useRealTimers()
  })
})

describe("installHarnessInboundAppMessageObserver", () => {
  it("observes inbound app messages before forwarding to the desktop agent handler", () => {
    let registeredHandler: ((message: unknown) => void | Promise<void>) | undefined
    const appConnection = {
      onAppMessage(handler: (message: unknown) => void | Promise<void>) {
        registeredHandler = handler
      },
    }
    const observer = vi.fn()
    const agentHandler = vi.fn()
    const message = { type: "broadcastRequest" }

    installHarnessInboundAppMessageObserver(appConnection, observer)
    appConnection.onAppMessage(agentHandler)
    registeredHandler?.(message)

    expect(observer).toHaveBeenCalledWith(message)
    expect(agentHandler).toHaveBeenCalledWith(message)
    expect(observer.mock.invocationCallOrder[0]).toBeLessThan(
      agentHandler.mock.invocationCallOrder[0],
    )
  })
})
