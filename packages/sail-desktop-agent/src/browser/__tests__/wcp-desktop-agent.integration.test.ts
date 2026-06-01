/**
 * WCPConnector ↔ DesktopAgent integration tests.
 *
 * Exercises the full browser wiring via createBrowserDesktopAgent and synthetic
 * postMessage WCP1Hello — not MockTransport-only.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import type { BrowserTypes } from "@finos/fdc3"
import { createBrowserDesktopAgent } from "../browser-desktop-agent"
import type { BrowserDesktopAgentResult } from "../browser-desktop-agent"

const APP_URL = "https://example.com/app"
const APP_ORIGIN = "https://example.com"

function createWCP1Hello(
  connectionAttemptUuid: string
): BrowserTypes.WebConnectionProtocol1Hello {
  return {
    type: "WCP1Hello",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: {
      identityUrl: APP_URL,
      actualUrl: APP_URL,
      fdc3Version: "2.2",
    },
  } as unknown as BrowserTypes.WebConnectionProtocol1Hello
}

function createMessageEvent(data: unknown, source: Window = window): MessageEvent {
  return new MessageEvent("message", {
    data,
    source,
    origin: APP_ORIGIN,
  })
}

/** InMemoryTransport delivers on the next macrotask; flush before asserting. */
async function flushAsyncDelivery(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

/** Capture the MessagePort transferred to the app during WCP3Handshake. */
function captureAppMessagePort(connectionAttemptUuid: string): MessagePort {
  const postMessageSpy = vi.spyOn(window, "postMessage")

  window.dispatchEvent(createMessageEvent(createWCP1Hello(connectionAttemptUuid)))

  const calls = postMessageSpy.mock.calls as unknown as Array<
    [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
  >
  expect(calls.length).toBeGreaterThan(0)

  const [handshakeMessage, targetOrigin, ports] = calls[0]
  expect(handshakeMessage.type).toBe("WCP3Handshake")
  expect(handshakeMessage.meta.connectionAttemptUuid).toBe(connectionAttemptUuid)
  expect(targetOrigin).toBe(APP_ORIGIN)
  expect(ports).toEqual(expect.arrayContaining([expect.any(MessagePort)]))

  postMessageSpy.mockRestore()

  const appPort = ports[0]
  appPort.start()
  return appPort
}

describe("WCPConnector ↔ DesktopAgent integration", () => {
  const activeAgents: BrowserDesktopAgentResult[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("routes WCP4 through the connector to DesktopAgent and correlates temp→canonical instance ids", async () => {
    const connectionAttemptUuid = "integration-wcp-path-uuid"
    const tempInstanceId = `temp-${connectionAttemptUuid}`

    const agent = createBrowserDesktopAgent({
      wcpOptions: {
        getIntentResolverUrl: () => false,
        getChannelSelectorUrl: () => false,
        fdc3Version: "2.2",
        handshakeTimeout: 30_000,
      },
    })
    activeAgents.push(agent)

    agent.desktopAgent.getAppDirectory().addApplications([
      {
        appId: "integration-test-app",
        title: "Integration Test App",
        type: "web",
        details: { url: APP_URL },
      },
    ])

    const appConnected = vi.fn()
    agent.wcpConnector.on("appConnected", appConnected)

    agent.start()

    const appPort = captureAppMessagePort(connectionAttemptUuid)

    expect(agent.wcpConnector.getConnection(tempInstanceId)).toBeDefined()
    expect(agent.wcpConnector.getConnections()).toHaveLength(1)

    const wcp5Response = new Promise<BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse>(
      resolve => {
        appPort.onmessage = event => {
          resolve(
            event.data as BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse
          )
        }
      }
    )

    const wcp4Message: BrowserTypes.WebConnectionProtocol4ValidateAppIdentity = {
      type: "WCP4ValidateAppIdentity",
      meta: {
        connectionAttemptUuid,
        timestamp: new Date().toISOString(),
      },
      payload: {
        identityUrl: APP_URL,
        actualUrl: APP_URL,
      },
    }

    appPort.postMessage(wcp4Message)
    await flushAsyncDelivery()

    const resolvedWcp5 = await Promise.race([
      wcp5Response,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Timed out waiting for WCP5ValidateAppIdentityResponse")),
          5000
        )
      ),
    ])

    expect(resolvedWcp5.type).toBe("WCP5ValidateAppIdentityResponse")
    expect(resolvedWcp5.meta.connectionAttemptUuid).toBe(connectionAttemptUuid)
    expect(resolvedWcp5.meta.destination?.instanceId).toBe(tempInstanceId)

    const canonicalInstanceId = resolvedWcp5.payload.instanceId
    expect(canonicalInstanceId).toBeTruthy()
    expect(canonicalInstanceId).not.toBe(tempInstanceId)
    expect(resolvedWcp5.payload.appId).toBe("integration-test-app")

    await vi.waitFor(() => {
      expect(appConnected).toHaveBeenCalledTimes(1)
      expect(agent.wcpConnector.getConnection(tempInstanceId)).toBeUndefined()
      expect(agent.wcpConnector.getConnection(canonicalInstanceId)).toBeDefined()
    })

    expect(appConnected).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: canonicalInstanceId,
        appId: "integration-test-app",
        connectionAttemptUuid,
      })
    )

    const agentState = agent.desktopAgent.getState()
    expect(agentState.instances[canonicalInstanceId]?.appId).toBe("integration-test-app")
    expect(agentState.instances[tempInstanceId]).toBeUndefined()
  })
})
