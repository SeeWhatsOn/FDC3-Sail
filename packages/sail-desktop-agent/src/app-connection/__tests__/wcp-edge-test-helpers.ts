/**
 * Shared helpers for WCP edge-contract integration tests.
 *
 * @vitest-environment jsdom
 */

import { expect, vi } from "vite-plus/test"
import type { BrowserTypes, Context } from "@finos/fdc3"
import type { DesktopAgent } from "../../agent/desktop-agent"
import type { SailDesktopAgent } from "../../agent/sail-desktop-agent"

export const TEST_ORIGIN = "https://example.com"

function getTestConnector(agent: DesktopAgent): SailDesktopAgent["connector"] {
  return (agent as SailDesktopAgent).connector
}

export type WcpConnectedApp = {
  connectionAttemptUuid: string
  tempInstanceId: string
  canonicalInstanceId: string
  instanceUuid: string
  appPort: MessagePort
  appId: string
}

export function createWCP1Hello(
  connectionAttemptUuid: string,
  identityUrl: string,
): BrowserTypes.WebConnectionProtocol1Hello {
  return {
    type: "WCP1Hello",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date().toISOString(),
    },
    payload: {
      identityUrl,
      actualUrl: identityUrl,
      fdc3Version: "2.2",
    },
  } as unknown as BrowserTypes.WebConnectionProtocol1Hello
}

export function createMessageEvent(
  data: unknown,
  source: Window = window,
  origin = TEST_ORIGIN,
): MessageEvent {
  return new MessageEvent("message", { data, source, origin })
}

/** InMemoryTransport delivers on the next macrotask; flush before asserting. */
export async function flushAsyncDelivery(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

function createNamedSourceWindow(hostIdentifier: string): Window {
  const namedSource = Object.create(window) as Window
  Object.defineProperty(namedSource, "name", {
    value: hostIdentifier,
    writable: true,
    configurable: true,
  })
  namedSource.postMessage = window.postMessage.bind(window)
  return namedSource
}

function captureAppMessagePort(
  connectionAttemptUuid: string,
  identityUrl: string,
  hostIdentifier?: string,
): MessagePort {
  const postMessageSpy = vi.spyOn(window, "postMessage")
  const sourceWindow = hostIdentifier ? createNamedSourceWindow(hostIdentifier) : window
  window.dispatchEvent(
    createMessageEvent(createWCP1Hello(connectionAttemptUuid, identityUrl), sourceWindow),
  )

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

export async function connectWcpApp(
  agent: DesktopAgent,
  options: {
    connectionAttemptUuid: string
    appId: string
    identityUrl: string
    hostInstanceId?: string
    /** WCP1 browsing-context name (`window.name`) — disambiguates multi-pending adoption. */
    hostIdentifier?: string
    instanceUuid?: string
  },
): Promise<WcpConnectedApp> {
  const {
    connectionAttemptUuid,
    appId,
    identityUrl,
    hostInstanceId,
    hostIdentifier,
    instanceUuid: reconnectInstanceUuid,
  } = options
  const tempInstanceId = `temp-${connectionAttemptUuid}`
  const browserAppConnection = getTestConnector(agent)

  const appPort = captureAppMessagePort(connectionAttemptUuid, identityUrl, hostIdentifier)

  expect(browserAppConnection.getConnection(tempInstanceId)).toBeDefined()

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
      ...(reconnectInstanceUuid ? { instanceUuid: reconnectInstanceUuid } : {}),
    },
  }

  appPort.postMessage(wcp4Message)
  await flushAsyncDelivery()

  const resolvedWcp5 = await Promise.race([
    wcp5Response,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Timed out waiting for WCP5ValidateAppIdentityResponse")),
        5000,
      ),
    ),
  ])

  expect(resolvedWcp5.type).toBe("WCP5ValidateAppIdentityResponse")
  const canonicalInstanceId = resolvedWcp5.payload.instanceId
  const validatedInstanceUuid = resolvedWcp5.payload.instanceUuid
  expect(canonicalInstanceId).toBeTruthy()
  expect(validatedInstanceUuid).toBeTruthy()
  expect(resolvedWcp5.payload.appId).toBe(appId)

  await vi.waitFor(() => {
    expect(browserAppConnection.getConnection(canonicalInstanceId)).toBeDefined()
    expect(browserAppConnection.getConnection(tempInstanceId)).toBeUndefined()
  })

  return {
    connectionAttemptUuid,
    tempInstanceId,
    canonicalInstanceId,
    instanceUuid: validatedInstanceUuid,
    appPort,
    appId,
  }
}

/**
 * FINOS-realistic first WCP4 connect: `identityUrl` only — omits `instanceUuid` and
 * `hostInstanceId` unless the test opts into `hostInstanceId`.
 */
export async function connectWcpAppFirstConnect(
  agent: DesktopAgent,
  options: {
    connectionAttemptUuid: string
    appId: string
    identityUrl: string
    hostInstanceId?: string
    hostIdentifier?: string
  },
): Promise<WcpConnectedApp> {
  const { hostInstanceId, hostIdentifier, ...rest } = options
  return connectWcpApp(agent, {
    ...rest,
    ...(hostInstanceId !== undefined ? { hostInstanceId } : {}),
    ...(hostIdentifier !== undefined ? { hostIdentifier } : {}),
  })
}

export type WcpFirstConnectSession = {
  connectionAttemptUuid: string
  tempInstanceId: string
  appPort: MessagePort
  postFirstConnectWcp4: () => Promise<void>
  completeFirstConnect: () => Promise<WcpConnectedApp>
}

/**
 * Starts a FINOS first-connect handshake through WCP3, leaving WCP4/WCP5 for the test
 * to interleave with early DACP (e.g. addContextListener on the temp routing id).
 */
export function beginWcpAppFirstConnect(
  agent: DesktopAgent,
  options: {
    connectionAttemptUuid: string
    appId: string
    identityUrl: string
  },
): WcpFirstConnectSession {
  const { connectionAttemptUuid, appId, identityUrl } = options
  const tempInstanceId = `temp-${connectionAttemptUuid}`
  const browserAppConnection = getTestConnector(agent)

  const appPort = captureAppMessagePort(connectionAttemptUuid, identityUrl)
  expect(browserAppConnection.getConnection(tempInstanceId)).toBeDefined()

  let resolveWcp5:
    | ((value: BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse) => void)
    | undefined
  const wcp5Response =
    new Promise<BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse>(resolve => {
      resolveWcp5 = resolve
    })

  appPort.onmessage = event => {
    const data = event.data as { type?: string }
    if (data.type === "WCP5ValidateAppIdentityResponse") {
      resolveWcp5?.(
        event.data as BrowserTypes.WebConnectionProtocol5ValidateAppIdentitySuccessResponse,
      )
    }
  }

  const wcp4Message: BrowserTypes.WebConnectionProtocol4ValidateAppIdentity = {
    type: "WCP4ValidateAppIdentity",
    meta: {
      connectionAttemptUuid,
      timestamp: new Date(),
    },
    payload: {
      identityUrl,
      actualUrl: identityUrl,
    },
  }

  return {
    connectionAttemptUuid,
    tempInstanceId,
    appPort,
    postFirstConnectWcp4: async () => {
      appPort.postMessage(wcp4Message)
      await flushAsyncDelivery()
    },
    completeFirstConnect: async () => {
      const resolvedWcp5 = await Promise.race([
        wcp5Response,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Timed out waiting for WCP5ValidateAppIdentityResponse")),
            5000,
          ),
        ),
      ])

      expect(resolvedWcp5.type).toBe("WCP5ValidateAppIdentityResponse")
      const canonicalInstanceId = resolvedWcp5.payload.instanceId
      const validatedInstanceUuid = resolvedWcp5.payload.instanceUuid
      expect(canonicalInstanceId).toBeTruthy()
      expect(validatedInstanceUuid).toBeTruthy()
      expect(resolvedWcp5.payload.appId).toBe(appId)

      await vi.waitFor(() => {
        expect(browserAppConnection.getConnection(canonicalInstanceId)).toBeDefined()
        expect(browserAppConnection.getConnection(tempInstanceId)).toBeUndefined()
      })

      return {
        connectionAttemptUuid,
        tempInstanceId,
        canonicalInstanceId,
        instanceUuid: validatedInstanceUuid,
        appPort,
        appId,
      }
    },
  }
}

export async function postDacpOnPort(
  appPort: MessagePort,
  message: BrowserTypes.AppRequestMessage,
): Promise<void> {
  appPort.postMessage(message)
  await flushAsyncDelivery()
}

export function waitForPortMessage<T>(
  appPort: MessagePort,
  predicate: (data: unknown) => boolean,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const priorHandler = appPort.onmessage
    const timer = setTimeout(() => {
      appPort.onmessage = priorHandler
      reject(new Error("Timed out waiting for MessagePort message"))
    }, timeoutMs)
    appPort.onmessage = event => {
      if (predicate(event.data)) {
        clearTimeout(timer)
        appPort.onmessage = priorHandler
        resolve(event.data as T)
        return
      }
      priorHandler?.call(appPort, event)
    }
  })
}

export const INSTRUMENT_CONTEXT: Context = {
  type: "fdc3.instrument",
  id: { ticker: "AAPL" },
}

export const COUNTRY_CONTEXT: Context = {
  type: "fdc3.country",
  id: { ISOCountryCode: "SE" },
}

export function collectPortMessages<T>(
  appPort: MessagePort,
  predicate: (data: unknown) => boolean,
): { messages: T[]; stop: () => void } {
  const messages: T[] = []
  const handler = (event: MessageEvent) => {
    if (predicate(event.data)) {
      messages.push(event.data as T)
    }
  }
  appPort.addEventListener("message", handler)
  return {
    messages,
    stop: () => appPort.removeEventListener("message", handler),
  }
}

export function createAddEventListenerMessage(
  instanceId: string,
  appId: string,
  eventType: BrowserTypes.AddEventListenerRequest["payload"]["type"],
): BrowserTypes.AddEventListenerRequest {
  return {
    type: "addEventListenerRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { type: eventType },
  }
}

export function createJoinUserChannelMessage(
  instanceId: string,
  appId: string,
  channelId: string,
): BrowserTypes.JoinUserChannelRequest {
  return {
    type: "joinUserChannelRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { channelId },
  }
}

export function createAddContextListenerMessage(
  instanceId: string,
  appId: string,
  channelId: string | null,
  contextType: string,
): BrowserTypes.AddContextListenerRequest {
  return {
    type: "addContextListenerRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { channelId, contextType },
  }
}

/** Generic user-channel listener (AOpensBWithContext3 / FINOS open-with-context path). */
export function createGenericContextListenerMessage(
  instanceId: string,
  appId: string,
): BrowserTypes.AddContextListenerRequest {
  return createAddContextListenerMessage(instanceId, appId, null, "*")
}

export function createBroadcastMessage(
  instanceId: string,
  appId: string,
  channelId: string,
  context: Context,
): BrowserTypes.BroadcastRequest {
  return {
    type: "broadcastRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { channelId, context },
  }
}

export function createOpenRequestMessage(
  sourceInstanceId: string,
  sourceAppId: string,
  targetAppId: string,
  context?: Context,
): BrowserTypes.OpenRequest {
  return {
    type: "openRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId: sourceAppId, instanceId: sourceInstanceId },
    },
    payload: {
      app: { appId: targetAppId },
      ...(context ? { context } : {}),
    },
  }
}

export function createGetOrCreateChannelMessage(
  instanceId: string,
  appId: string,
  channelId: string,
): BrowserTypes.GetOrCreateChannelRequest {
  return {
    type: "getOrCreateChannelRequest",
    meta: {
      requestUuid: crypto.randomUUID(),
      timestamp: new Date(),
      source: { appId, instanceId },
    },
    payload: { channelId },
  }
}
