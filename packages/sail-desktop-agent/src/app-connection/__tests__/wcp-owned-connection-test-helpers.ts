/**

 * Target-architecture seams for DA-owned browser app connection tests.

 *

 * These helpers assert the collapsed model where DesktopAgent owns WCP listener

 * lifecycle and per-app MessagePort routing via BrowserAppConnection.

 *

 * @vitest-environment jsdom

 */

import { expect, vi } from "vite-plus/test"

import type { BrowserTypes } from "@finos/fdc3"

import type { DesktopAgent } from "../../agent/desktop-agent"

import { BrowserAppConnection } from "../../app-connection/browser-app-connection"

import { getBrowserDesktopAgentSession } from "../../agent/browser-session"

import {
  createMessageEvent,
  createWCP1Hello,
  flushAsyncDelivery,
  TEST_ORIGIN,
  type WcpConnectedApp,
} from "./wcp-edge-test-helpers"

export type DaOwnedAppConnectionMetadata = {
  instanceId: string

  appId?: string

  connectionAttemptUuid?: string
}

/** DesktopAgent-owned browser app connection surface (target public API). */

export type DaOwnedAppConnectionSurface = {
  getAppConnection: (instanceId: string) => DaOwnedAppConnectionMetadata | undefined

  getAppConnections: () => DaOwnedAppConnectionMetadata[]
}

function getBrowserAppConnection(agent: DesktopAgent): BrowserAppConnection | undefined {
  return (agent as unknown as { browserAppConnection?: BrowserAppConnection }).browserAppConnection
}

/**

 * Assert the agent uses the collapsed browser architecture (DA-owned connection backend).

 */

export function assertCollapsedBrowserArchitecture(agent: DesktopAgent): void {
  const browserAppConnection = getBrowserAppConnection(agent)

  expect(browserAppConnection).toBeInstanceOf(BrowserAppConnection)

  expect(() => getBrowserDesktopAgentSession(agent)).toThrow(
    /does not expose a separate WCP connector session/i
  )
}

/**

 * Require DesktopAgent-owned app connection APIs.

 */

export function requireDaOwnedAppConnection(agent: DesktopAgent): DaOwnedAppConnectionSurface {
  assertCollapsedBrowserArchitecture(agent)

  const surface = agent as unknown as Partial<DaOwnedAppConnectionSurface>

  expect(typeof surface.getAppConnection).toBe("function")

  expect(typeof surface.getAppConnections).toBe("function")

  return surface as DaOwnedAppConnectionSurface
}

function captureAppMessagePort(connectionAttemptUuid: string, identityUrl: string): MessagePort {
  const postMessageSpy = vi.spyOn(window, "postMessage")

  window.dispatchEvent(createMessageEvent(createWCP1Hello(connectionAttemptUuid, identityUrl)))

  const calls = postMessageSpy.mock.calls as unknown as Array<
    [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
  >

  expect(calls.length).toBeGreaterThan(0)

  const [handshakeMessage, targetOrigin, ports] = calls[0]

  expect(handshakeMessage.type).toBe("WCP3Handshake")

  expect(handshakeMessage.meta.connectionAttemptUuid).toBe(connectionAttemptUuid)

  expect(targetOrigin).toBe(TEST_ORIGIN)

  expect(ports).toEqual(expect.arrayContaining([expect.any(MessagePort)]))

  postMessageSpy.mockRestore()

  const appPort = ports[0]

  appPort.start()

  return appPort
}

/**

 * Complete WCP1-5 through DesktopAgent-owned browser app connection.

 */

export async function connectWcpAppViaDaOwnedConnection(
  agent: DesktopAgent,

  options: {
    connectionAttemptUuid: string

    appId: string

    identityUrl: string

    hostInstanceId?: string

    instanceUuid?: string
  }
): Promise<WcpConnectedApp> {
  const connections = requireDaOwnedAppConnection(agent)

  const { connectionAttemptUuid, appId, identityUrl, hostInstanceId, instanceUuid } = options

  const tempInstanceId = `temp-${connectionAttemptUuid}`

  const appPort = captureAppMessagePort(connectionAttemptUuid, identityUrl)

  expect(connections.getAppConnection(tempInstanceId)).toBeDefined()

  const wcp5Response =
    new Promise<BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse>(resolve => {
      appPort.onmessage = event => {
        resolve(event.data as BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse)
      }
    })

  const wcp4Message: BrowserTypes.WebConnectionProtocol4ValidateAppIdentity = {
    type: "WCP4ValidateAppIdentity",

    meta: {
      connectionAttemptUuid,

      timestamp: new Date(),
    },

    payload: {
      identityUrl,

      actualUrl: identityUrl,

      ...(hostInstanceId ? { instanceId: hostInstanceId } : {}),

      ...(instanceUuid ? { instanceUuid } : {}),
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

  const canonicalInstanceId = resolvedWcp5.payload.instanceId

  expect(canonicalInstanceId).toBeTruthy()

  expect(resolvedWcp5.payload.appId).toBe(appId)

  await vi.waitFor(() => {
    expect(connections.getAppConnection(canonicalInstanceId)).toBeDefined()

    expect(connections.getAppConnection(tempInstanceId)).toBeUndefined()
  })

  return {
    connectionAttemptUuid,

    tempInstanceId,

    canonicalInstanceId,

    appPort,

    appId,
  }
}
