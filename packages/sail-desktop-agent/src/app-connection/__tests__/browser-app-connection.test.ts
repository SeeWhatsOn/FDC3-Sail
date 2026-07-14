import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { BrowserAppConnection } from "../browser-app-connection"
import type { DirectoryApp } from "../../app-directory/DirectoryInterface"

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

function makeWcp4(
  connectionAttemptUuid: string,
  identityUrl: string,
  actualUrl: string = identityUrl,
) {
  return {
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: { identityUrl, actualUrl },
  }
}

type FakeSource = Window & {
  postMessage: ReturnType<typeof vi.fn>
  name: string
}

function createFakeSource(name = ""): FakeSource {
  return {
    name,
    postMessage: vi.fn(),
  } as unknown as FakeSource
}

/** Node's MessageEvent rejects non-Window/MessagePort `source`; set it after construct. */
function dispatchHello(
  target: EventTarget,
  hello: ReturnType<typeof makeWcp1Hello>,
  origin: string,
  source: FakeSource,
): void {
  const event = new MessageEvent("message", { data: hello, origin })
  Object.defineProperty(event, "source", { value: source, configurable: true })
  target.dispatchEvent(event)
}

describe("BrowserAppConnection", () => {
  let target: EventTarget
  let apps: DirectoryApp[]

  beforeEach(() => {
    target = new EventTarget()
    apps = [makeWebApp("demo-app", "https://app.example/page")]
  })

  afterEach(() => {
    // no-op; each test stops its connection
  })

  it("responds to WCP1Hello with WCP3Handshake and a MessagePort", () => {
    const connection = new BrowserAppConnection({
      getApps: () => apps,
    })
    connection.start(target as unknown as Window)

    const source = createFakeSource("launcher-1")
    dispatchHello(
      target,
      makeWcp1Hello("attempt-1"),
      "https://app.example",
      source,
    )

    expect(source.postMessage).toHaveBeenCalledTimes(1)
    const [handshake, origin, transfer] = source.postMessage.mock.calls[0]
    expect(handshake.type).toBe("WCP3Handshake")
    expect(handshake.meta.connectionAttemptUuid).toBe("attempt-1")
    expect(origin).toBe("https://app.example")
    expect(transfer).toHaveLength(1)
    expect(transfer[0]).toBeInstanceOf(MessagePort)

    const pending = connection.getConnections()
    expect(pending).toHaveLength(1)
    expect(pending[0].instanceId).toBe("temp-attempt-1")
    expect(pending[0].hostIdentifier).toBe("launcher-1")
    expect(pending[0].appId).toBe("unknown")

    connection.stop()
  })

  it("omits injected UI URLs in WCP3Handshake", () => {
    const connection = new BrowserAppConnection({
      getApps: () => apps,
    })
    connection.start(target as unknown as Window)

    const source = createFakeSource()
    dispatchHello(
      target,
      makeWcp1Hello("attempt-ui"),
      "https://app.example",
      source,
    )

    const [handshake] = source.postMessage.mock.calls[0]
    expect(handshake.payload.intentResolverUrl).toBe(false)
    expect(handshake.payload.channelSelectorUrl).toBe(false)

    connection.stop()
  })

  it("validates WCP4 and migrates temp instance id on WCP5 success", async () => {
    const connection = new BrowserAppConnection({
      getApps: () => apps,
      provider: "sail-test",
    })
    connection.start(target as unknown as Window)

    const source = createFakeSource()
    dispatchHello(
      target,
      makeWcp1Hello("attempt-2"),
      "https://app.example",
      source,
    )

    const [, , transfer] = source.postMessage.mock.calls[0]
    const appPort = transfer[0] as MessagePort
    appPort.start()

    const responses: unknown[] = []
    appPort.addEventListener("message", (event) => {
      responses.push((event as MessageEvent).data)
    })

    const connected: string[] = []
    connection.on("appConnected", (meta) => {
      connected.push(meta.instanceId)
    })

    appPort.postMessage(makeWcp4("attempt-2", "https://app.example/page"))

    await vi.waitFor(() => {
      expect(responses).toHaveLength(1)
    })

    const wcp5 = responses[0] as {
      type: string
      payload: { appId: string; instanceId: string; instanceUuid: string }
    }
    expect(wcp5.type).toBe("WCP5ValidateAppIdentityResponse")
    expect(wcp5.payload.appId).toBe("demo-app")
    expect(wcp5.payload.instanceId).toBeTruthy()
    expect(wcp5.payload.instanceId).not.toMatch(/^temp-/)
    expect(connected).toEqual([wcp5.payload.instanceId])

    expect(connection.getConnection("temp-attempt-2")).toBeUndefined()
    expect(connection.getConnection(wcp5.payload.instanceId)?.appId).toBe(
      "demo-app",
    )

    connection.stop()
    appPort.close()
  })

  it("sends WCP5 failure when identityUrl is not in the directory", async () => {
    const connection = new BrowserAppConnection({
      getApps: () => apps,
    })
    connection.start(target as unknown as Window)

    const source = createFakeSource()
    dispatchHello(
      target,
      makeWcp1Hello("attempt-3"),
      "https://unknown.example",
      source,
    )

    const [, , transfer] = source.postMessage.mock.calls[0]
    const appPort = transfer[0] as MessagePort
    appPort.start()

    const responses: unknown[] = []
    appPort.addEventListener("message", (event) => {
      responses.push((event as MessageEvent).data)
    })

    appPort.postMessage(makeWcp4("attempt-3", "https://unknown.example/app"))

    await vi.waitFor(() => {
      expect(responses).toHaveLength(1)
    })

    const wcp5 = responses[0] as { type: string }
    expect(wcp5.type).toBe("WCP5ValidateAppIdentityFailedResponse")
    expect(connection.getConnections()).toHaveLength(0)

    connection.stop()
    appPort.close()
  })

  it("forwards non-WCP handshake messages via onAppMessage after connect", async () => {
    const connection = new BrowserAppConnection({
      getApps: () => apps,
    })
    const inbound: unknown[] = []
    connection.onAppMessage((message) => {
      inbound.push(message)
    })
    connection.start(target as unknown as Window)

    const source = createFakeSource()
    dispatchHello(
      target,
      makeWcp1Hello("attempt-4"),
      "https://app.example",
      source,
    )

    const [, , transfer] = source.postMessage.mock.calls[0]
    const appPort = transfer[0] as MessagePort
    appPort.start()

    const responses: unknown[] = []
    appPort.addEventListener("message", (event) => {
      responses.push((event as MessageEvent).data)
    })
    appPort.postMessage(makeWcp4("attempt-4", "https://app.example/page"))
    await vi.waitFor(() => expect(responses).toHaveLength(1))

    appPort.postMessage({
      type: "broadcastRequest",
      meta: {
        requestUuid: "r1",
        timestamp: new Date().toISOString(),
        source: {},
      },
      payload: {
        channelId: "fdc3.channel.1",
        context: { type: "fdc3.instrument" },
      },
    })

    await vi.waitFor(() => {
      expect(inbound).toHaveLength(1)
    })
    expect((inbound[0] as { type: string }).type).toBe("broadcastRequest")

    connection.stop()
    appPort.close()
  })

  it("disconnects on WCP6Goodbye", async () => {
    const connection = new BrowserAppConnection({
      getApps: () => apps,
    })
    connection.start(target as unknown as Window)

    const source = createFakeSource()
    dispatchHello(
      target,
      makeWcp1Hello("attempt-5"),
      "https://app.example",
      source,
    )

    const [, , transfer] = source.postMessage.mock.calls[0]
    const appPort = transfer[0] as MessagePort
    appPort.start()

    const responses: unknown[] = []
    appPort.addEventListener("message", (event) => {
      responses.push((event as MessageEvent).data)
    })
    appPort.postMessage(makeWcp4("attempt-5", "https://app.example/page"))
    await vi.waitFor(() => expect(responses).toHaveLength(1))

    const instanceId = (responses[0] as { payload: { instanceId: string } })
      .payload.instanceId
    const disconnected: string[] = []
    connection.on("appDisconnected", (id) => disconnected.push(id))

    appPort.postMessage({
      type: "WCP6Goodbye",
      meta: {
        connectionAttemptUuid: "attempt-5",
        timestamp: new Date().toISOString(),
      },
      payload: {},
    })

    await vi.waitFor(() => {
      expect(disconnected).toEqual([instanceId])
    })
    expect(connection.getConnection(instanceId)).toBeUndefined()

    connection.stop()
  })
})
