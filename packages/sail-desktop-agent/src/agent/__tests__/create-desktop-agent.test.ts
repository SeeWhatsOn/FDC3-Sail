import { describe, expect, it, vi } from "vitest"
import { State } from "../../AppRegistration"
import type { DirectoryApp } from "../../app-directory/DirectoryInterface"
import { ChannelType } from "../../DacpRuntime"
import {
  createDesktopAgent,
  getDesktopAgentInternals,
} from "../create-desktop-agent"

function makeWebApp(appId: string, url: string): DirectoryApp {
  return {
    appId,
    name: appId,
    title: appId,
    type: "web",
    details: { url },
  } as DirectoryApp
}

function makeWcp1Hello(connectionAttemptUuid: string) {
  return {
    type: "WCP1Hello",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: {
      actualUrl: "https://app.example/page",
      identityUrl: "https://app.example/page",
      fdc3Version: "2.2",
      intentResolver: false,
      channelSelector: false,
    },
  }
}

function makeWcp4(connectionAttemptUuid: string, identityUrl: string) {
  return {
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: { identityUrl, actualUrl: identityUrl },
  }
}

describe("createDesktopAgent", () => {
  it("starts and completes WCP1→5 without throwing", async () => {
    const apps = [makeWebApp("demo-app", "https://app.example/page")]
    const agent = await createDesktopAgent({
      directories: [{ type: "local", data: apps }],
      openApp: async () => ({ instanceId: "host-1" }),
    })

    const target = new EventTarget()
    agent.start(target)

    const source = {
      name: "",
      postMessage: vi.fn(),
    }
    const event = new MessageEvent("message", {
      data: makeWcp1Hello("attempt-da"),
      origin: "https://app.example",
    })
    Object.defineProperty(event, "source", {
      value: source,
      configurable: true,
    })
    target.dispatchEvent(event)

    expect(source.postMessage).toHaveBeenCalled()
    const [, , transfer] = source.postMessage.mock.calls[0]
    const appPort = transfer[0] as MessagePort
    appPort.start()

    const responses: unknown[] = []
    appPort.addEventListener("message", (e) => {
      responses.push((e as MessageEvent).data)
    })

    appPort.postMessage(makeWcp4("attempt-da", "https://app.example/page"))

    await vi.waitFor(() => {
      expect(responses).toHaveLength(1)
    })

    expect((responses[0] as { type: string }).type).toBe(
      "WCP5ValidateAppIdentityResponse",
    )

    const instanceId = (responses[0] as { payload: { instanceId: string } })
      .payload.instanceId
    const registrations = await agent.getAppRegistrations()
    expect(registrations.find((r) => r.instanceId === instanceId)?.state).toBe(
      State.Connected,
    )

    agent.stop()
    appPort.close()
  })

  it("adopts host-pre-registered pending instance via window.name", async () => {
    const apps = [makeWebApp("demo-app", "https://app.example/page")]
    const agent = await createDesktopAgent({
      directories: [{ type: "local", data: apps }],
      openApp: async () => ({ instanceId: "pending-host-id" }),
    })

    agent.registerPendingLaunch("demo-app", "pending-host-id")

    const target = new EventTarget()
    agent.start(target)

    const source = {
      name: "pending-host-id",
      postMessage: vi.fn(),
    }
    const event = new MessageEvent("message", {
      data: makeWcp1Hello("attempt-adopt"),
      origin: "https://app.example",
    })
    Object.defineProperty(event, "source", {
      value: source,
      configurable: true,
    })
    target.dispatchEvent(event)

    const [, , transfer] = source.postMessage.mock.calls[0]
    const appPort = transfer[0] as MessagePort
    appPort.start()
    const responses: unknown[] = []
    appPort.addEventListener("message", (e) => {
      responses.push((e as MessageEvent).data)
    })
    appPort.postMessage(makeWcp4("attempt-adopt", "https://app.example/page"))

    await vi.waitFor(() => expect(responses).toHaveLength(1))
    expect(
      (responses[0] as { payload: { instanceId: string } }).payload.instanceId,
    ).toBe("pending-host-id")

    agent.stop()
    appPort.close()
  })

  it("adopts pending instance via resolveHostIdentifier when window.name is empty", async () => {
    const apps = [makeWebApp("demo-app", "https://app.example/page")]
    const source = {
      name: "",
      postMessage: vi.fn(),
    }
    const agent = await createDesktopAgent({
      directories: [{ type: "local", data: apps }],
      openApp: async () => ({ instanceId: "pending-host-id" }),
      resolveHostIdentifier: (windowSource) =>
        windowSource === source ? "pending-host-id" : undefined,
    })

    agent.registerPendingLaunch("demo-app", "pending-host-id")

    const target = new EventTarget()
    agent.start(target)

    const event = new MessageEvent("message", {
      data: makeWcp1Hello("attempt-resolve"),
      origin: "https://app.example",
    })
    Object.defineProperty(event, "source", {
      value: source,
      configurable: true,
    })
    target.dispatchEvent(event)

    const [, , transfer] = source.postMessage.mock.calls[0]
    const appPort = transfer[0] as MessagePort
    appPort.start()
    const responses: unknown[] = []
    appPort.addEventListener("message", (e) => {
      responses.push((e as MessageEvent).data)
    })
    appPort.postMessage(makeWcp4("attempt-resolve", "https://app.example/page"))

    await vi.waitFor(() => expect(responses).toHaveLength(1))
    expect(
      (responses[0] as { payload: { instanceId: string } }).payload.instanceId,
    ).toBe("pending-host-id")

    agent.stop()
    appPort.close()
  })

  it("ensureUserChannel and setUserChannel are host-callable without server", async () => {
    const agent = await createDesktopAgent({
      directories: [{ type: "local", data: [] }],
      channels: [],
      openApp: async () => ({ instanceId: "x" }),
    })

    agent.ensureUserChannel({
      id: "TabOne",
      type: ChannelType.user,
      displayMetadata: { name: "TabOne" },
      context: [],
    })
    // idempotent
    agent.ensureUserChannel({
      id: "TabOne",
      type: ChannelType.user,
      displayMetadata: { name: "TabOne" },
      context: [],
    })

    agent.registerPendingLaunch("demo-app", "inst-1")
    agent.setUserChannel("inst-1", "TabOne")

    const { runtime } = getDesktopAgentInternals(agent)
    expect(runtime.getChannelById("TabOne")?.id).toBe("TabOne")
    expect(runtime.getCurrentChannel("inst-1")?.id).toBe("TabOne")

    agent.stop()
  })

  it("completes openResponse when opened app finishes WCP (no context)", async () => {
    const apps = [
      makeWebApp("opener", "https://opener.example/"),
      makeWebApp("demo-app", "https://app.example/page"),
    ]
    const agent = await createDesktopAgent({
      directories: [{ type: "local", data: apps }],
      openApp: async () => ({ instanceId: "opened-1" }),
    })
    const { connection, runtime } = getDesktopAgentInternals(agent)

    runtime.setInstanceDetails("opener-1", {
      appId: "opener",
      instanceId: "opener-1",
      state: State.Connected,
    })

    const sent: Array<{
      id: string
      msg: { type?: string; payload?: unknown }
    }> = []
    const originalSend = connection.sendToAppInstance.bind(connection)
    vi.spyOn(connection, "sendToAppInstance").mockImplementation((id, msg) => {
      sent.push({ id, msg: msg as { type?: string; payload?: unknown } })
      originalSend(id, msg)
    })

    await runtime.receive(
      {
        type: "openRequest",
        meta: {
          requestUuid: "req-open-1",
          timestamp: new Date(),
          source: { appId: "opener", instanceId: "opener-1" },
        },
        payload: {
          app: { appId: "demo-app" },
        },
      },
      "opener-1",
    )

    const target = new EventTarget()
    agent.start(target)

    const source = {
      name: "opened-1",
      postMessage: vi.fn(),
    }
    const event = new MessageEvent("message", {
      data: makeWcp1Hello("attempt-open"),
      origin: "https://app.example",
    })
    Object.defineProperty(event, "source", {
      value: source,
      configurable: true,
    })
    target.dispatchEvent(event)

    const [, , transfer] = source.postMessage.mock.calls[0]
    const appPort = transfer[0] as MessagePort
    appPort.start()
    appPort.postMessage(makeWcp4("attempt-open", "https://app.example/page"))

    await vi.waitFor(() => {
      const openResponses = sent.filter(
        (s) => s.id === "opener-1" && s.msg.type === "openResponse",
      )
      expect(openResponses).toHaveLength(1)
      expect(openResponses[0].msg.payload).toEqual({
        appIdentifier: {
          appId: "demo-app",
          instanceId: "opened-1",
        },
      })
    })

    agent.stop()
    appPort.close()
  })

  it("completes openResponse when window.name is empty but resolveHostIdentifier works", async () => {
    const apps = [
      makeWebApp("opener", "https://opener.example/"),
      makeWebApp("demo-app", "https://app.example/page"),
    ]
    const source = {
      name: "",
      postMessage: vi.fn(),
    }
    const agent = await createDesktopAgent({
      directories: [{ type: "local", data: apps }],
      openApp: async () => ({ instanceId: "opened-1" }),
      resolveHostIdentifier: (windowSource) =>
        windowSource === source ? "opened-1" : undefined,
    })
    const { connection, runtime } = getDesktopAgentInternals(agent)

    runtime.setInstanceDetails("opener-1", {
      appId: "opener",
      instanceId: "opener-1",
      state: State.Connected,
    })

    const sent: Array<{
      id: string
      msg: { type?: string; payload?: unknown }
    }> = []
    const originalSend = connection.sendToAppInstance.bind(connection)
    vi.spyOn(connection, "sendToAppInstance").mockImplementation((id, msg) => {
      sent.push({ id, msg: msg as { type?: string; payload?: unknown } })
      originalSend(id, msg)
    })

    await runtime.receive(
      {
        type: "openRequest",
        meta: {
          requestUuid: "req-open-2",
          timestamp: new Date(),
          source: { appId: "opener", instanceId: "opener-1" },
        },
        payload: {
          app: { appId: "demo-app" },
        },
      },
      "opener-1",
    )

    const target = new EventTarget()
    agent.start(target)

    const event = new MessageEvent("message", {
      data: makeWcp1Hello("attempt-open-resolve"),
      origin: "https://app.example",
    })
    Object.defineProperty(event, "source", {
      value: source,
      configurable: true,
    })
    target.dispatchEvent(event)

    const [, , transfer] = source.postMessage.mock.calls[0]
    const appPort = transfer[0] as MessagePort
    appPort.start()
    appPort.postMessage(
      makeWcp4("attempt-open-resolve", "https://app.example/page"),
    )

    await vi.waitFor(() => {
      const openResponses = sent.filter(
        (s) => s.id === "opener-1" && s.msg.type === "openResponse",
      )
      expect(openResponses).toHaveLength(1)
      expect(openResponses[0].msg.payload).toEqual({
        appIdentifier: {
          appId: "demo-app",
          instanceId: "opened-1",
        },
      })
    })

    agent.stop()
    appPort.close()
  })
})
