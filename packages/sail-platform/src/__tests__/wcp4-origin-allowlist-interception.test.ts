/**
 * WCP4 origin allowlist — real end-to-end interception proof.
 *
 * `wcp4-origin-allowlist.test.ts` (alongside this file) drives a hand-built mock and proves
 * the wrapper's own branching logic — it does not prove the wrapper is actually wired into the
 * agent. `wireWcp4OriginAllowlist` works today only because `DesktopAgent.start()` registers a
 * *dynamic* lookup closure — `appConnection.onAppMessage(message => void this.handleMessage(message))`
 * — so the later monkey-patch of `handleMessage` is picked up on every call. If that closure
 * were ever early-bound (`onAppMessage(this.handleMessage.bind(this))`), the patched property
 * would stop running — silently, with no type error (the cast in `wcp4-origin-allowlist.ts`
 * erases the type) and no failure in the mock-based suite.
 *
 * This test proves interception on the *real* agent message path:
 *  - constructs/starts the agent first, then wires the allowlist — `createSailBrowserDesktopAgent`'s
 *    production ordering (construct, which auto-starts, THEN `wireWcp4OriginAllowlist`);
 *  - never calls `agent.handleMessage(...)` directly — messages travel a real WCP1-5 browser
 *    handshake (jsdom `postMessage` / `MessageChannel`), landing on `handleMessage` only via the
 *    `onAppMessage` closure `start()` installed.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import { createSailBrowserDesktopAgent } from "../sail-browser-desktop-agent"

const TRUSTED_ORIGIN = "https://trusted.example.com"
const UNTRUSTED_ORIGIN = "https://evil.example.com"

type Wcp5Response = { type: string; payload: Record<string, unknown> }

function flushAsyncDelivery(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Real WCP1Hello -> WCP3Handshake round trip (jsdom `window` messaging), returning the
 * app-side MessagePort exactly as a real embedded app would receive it.
 */
function captureAppMessagePort(
  connectionAttemptUuid: string,
  identityUrl: string,
  origin: string,
): MessagePort {
  const postMessageSpy = vi.spyOn(window, "postMessage")

  const hello = {
    type: "WCP1Hello",
    meta: { connectionAttemptUuid, timestamp: new Date().toISOString() },
    payload: { identityUrl, actualUrl: identityUrl, fdc3Version: "2.2" },
  } as unknown as BrowserTypes.WebConnectionProtocol1Hello

  window.dispatchEvent(new MessageEvent("message", { data: hello, source: window, origin }))

  const calls = postMessageSpy.mock.calls as unknown as Array<
    [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
  >
  expect(calls.length).toBeGreaterThan(0)
  const [handshakeMessage, , ports] = calls[0]
  expect(handshakeMessage.type).toBe("WCP3Handshake")
  postMessageSpy.mockRestore()

  const appPort = ports[0]
  appPort.start()
  return appPort
}

/**
 * Completes WCP4 over the captured port and returns whichever WCP5 (success or failure)
 * comes back — delivery is entirely production code (`AppConnectionRegistry.sendToAppInstance`).
 */
async function sendWcp4AndAwaitResponse(
  origin: string,
  connectionAttemptUuid: string,
): Promise<Wcp5Response> {
  const identityUrl = `${origin}/app`
  const appPort = captureAppMessagePort(connectionAttemptUuid, identityUrl, origin)

  const responsePromise = new Promise<Wcp5Response>(resolve => {
    appPort.onmessage = event => resolve(event.data as Wcp5Response)
  })

  const wcp4 = {
    type: "WCP4ValidateAppIdentity",
    meta: { connectionAttemptUuid, timestamp: new Date() },
    payload: { identityUrl, actualUrl: identityUrl },
  } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity

  appPort.postMessage(wcp4)
  await flushAsyncDelivery()

  return Promise.race([
    responsePromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out waiting for WCP5 response")), 5000),
    ),
  ])
}

describe("wireWcp4OriginAllowlist — interception on the real agent message path", () => {
  let agent: ReturnType<typeof createSailBrowserDesktopAgent> | undefined

  afterEach(() => {
    agent?.stop()
    agent = undefined
    vi.restoreAllMocks()
  })

  it("rejects a disallowed-origin WCP4ValidateAppIdentity delivered through the real onAppMessage path", async () => {
    // Production ordering: construct (auto-starts) THEN wire the allowlist. Never the reverse.
    agent = createSailBrowserDesktopAgent({
      allowedOrigins: [TRUSTED_ORIGIN],
      heartbeatEnabled: false,
    })

    const response = await sendWcp4AndAwaitResponse(UNTRUSTED_ORIGIN, "reject-uuid")

    expect(response.type).toBe("WCP5ValidateAppIdentityFailedResponse")
    expect(response.payload.message as string).toMatch(/not allowed/i)
    // The real handleWcp4ValidateAppIdentity never ran: the temp connection was torn down
    // by the allowlist's own failure path, not by real WCP4 validation logic.
    expect(agent.connector.getConnection("temp-reject-uuid")).toBeUndefined()
  })

  it("passes an allowed-origin WCP4ValidateAppIdentity through untouched to real validation", async () => {
    agent = createSailBrowserDesktopAgent({
      allowedOrigins: [TRUSTED_ORIGIN],
      heartbeatEnabled: false,
      apps: [
        {
          appId: "trusted-app",
          title: "Trusted App",
          type: "web" as const,
          details: { url: `${TRUSTED_ORIGIN}/app` },
        },
      ],
    })

    const response = await sendWcp4AndAwaitResponse(TRUSTED_ORIGIN, "trusted-uuid")

    expect(response.type).toBe("WCP5ValidateAppIdentityResponse")
    expect(response.payload.appId as string).toBe("trusted-app")
  })
})
