/**
 * RED integration tests for DA-owned browser app connection (collapsed architecture).
 *
 * DesktopAgent must own WCP listener lifecycle, per-app MessagePort routing, and
 * connection maps — without BrowserDaEdgeLink or a separate WCPConnector transport hop.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import type { DesktopAgent } from "../../core/desktop-agent"
import { AppInstanceState } from "../../core/state/types"
import { clearAllHeartbeatTimersForTesting } from "../../core/handlers/dacp/heartbeat-runtime"
import {
  assertCollapsedBrowserArchitecture,
  connectWcpAppViaDaOwnedConnection,
  requireDaOwnedAppConnection,
} from "./wcp-owned-connection-test-helpers"
import {
  CHANNEL_ID,
  CHART_APP,
  createTestAgent,
  PORTFOLIO_APP,
} from "./wcp-desktop-agent.integration.fixtures"
import {
  createAddContextListenerMessage,
  createBroadcastMessage,
  createJoinUserChannelMessage,
  createMessageEvent,
  createWCP1Hello,
  flushAsyncDelivery,
  INSTRUMENT_CONTEXT,
  postDacpOnPort,
  waitForPortMessage,
} from "./wcp-edge-test-helpers"

describe("DA-owned browser app connection (collapsed architecture)", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("does not route browser apps through BrowserDaEdgeLink or a preset WCP connector session", () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    assertCollapsedBrowserArchitecture(agent)
  })

  it("listens for WCP1Hello after DesktopAgent.start and returns WCP3Handshake without edge-link wiring", () => {
    const agent = createTestAgent({ autoStart: false })
    activeAgents.push(agent)

    assertCollapsedBrowserArchitecture(agent)
    agent.start()

    const postMessageSpy = vi.spyOn(window, "postMessage")
    window.dispatchEvent(
      createMessageEvent(createWCP1Hello("da-owned-wcp1-uuid", PORTFOLIO_APP.details.url))
    )

    const calls = postMessageSpy.mock.calls as unknown as Array<
      [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
    >
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0][0].type).toBe("WCP3Handshake")

    const connections = requireDaOwnedAppConnection(agent)
    expect(connections.getAppConnection("temp-da-owned-wcp1-uuid")).toBeDefined()

    postMessageSpy.mockRestore()
  })

  it("completes WCP1-5 handshake and migrates temp to canonical instance on DA-owned connection maps", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const connected = await connectWcpAppViaDaOwnedConnection(agent, {
      connectionAttemptUuid: "da-owned-wcp1-5-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const connections = requireDaOwnedAppConnection(agent)

    expect(agent.getState().instances[connected.canonicalInstanceId]?.appId).toBe("portfolioApp")
    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )
    expect(connections.getAppConnection(connected.canonicalInstanceId)).toMatchObject({
      instanceId: connected.canonicalInstanceId,
      appId: "portfolioApp",
    })
    expect(connections.getAppConnection(connected.tempInstanceId)).toBeUndefined()
  })

  it("routes outbound DACP to the canonical instance MessagePort after WCP5 migration", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const appA = await connectWcpAppViaDaOwnedConnection(agent, {
      connectionAttemptUuid: "da-owned-outbound-a-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const appB = await connectWcpAppViaDaOwnedConnection(agent, {
      connectionAttemptUuid: "da-owned-outbound-b-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    const broadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      appA.appPort,
      data => (data as { type?: string }).type === "broadcastEvent"
    )

    await postDacpOnPort(
      appA.appPort,
      createJoinUserChannelMessage(appA.canonicalInstanceId, appA.appId, CHANNEL_ID)
    )
    await postDacpOnPort(
      appA.appPort,
      createAddContextListenerMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHANNEL_ID,
        INSTRUMENT_CONTEXT.type
      )
    )
    await postDacpOnPort(
      appB.appPort,
      createJoinUserChannelMessage(appB.canonicalInstanceId, appB.appId, CHANNEL_ID)
    )
    await postDacpOnPort(
      appB.appPort,
      createBroadcastMessage(appB.canonicalInstanceId, appB.appId, CHANNEL_ID, INSTRUMENT_CONTEXT)
    )

    const broadcastEvent = await broadcastPromise

    expect(broadcastEvent.type).toBe("broadcastEvent")
    const destination = (
      broadcastEvent.meta as BrowserTypes.BroadcastEventMeta & {
        destination?: { instanceId?: string }
      }
    ).destination
    expect(destination?.instanceId).toBe(appA.canonicalInstanceId)
    expect(broadcastEvent.payload.context?.type).toBe(INSTRUMENT_CONTEXT.type)
  })

  it("prunes DA state and DA-owned connection maps when the app sends WCP6Goodbye", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 0 })
    activeAgents.push(agent)

    const connected = await connectWcpAppViaDaOwnedConnection(agent, {
      connectionAttemptUuid: "da-owned-wcp6-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const connections = requireDaOwnedAppConnection(agent)
    expect(connections.getAppConnection(connected.canonicalInstanceId)).toBeDefined()

    connected.appPort.postMessage({
      type: "WCP6Goodbye",
      meta: { timestamp: new Date().toISOString() },
    })
    await flushAsyncDelivery()

    await vi.waitFor(() => {
      expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
      expect(connections.getAppConnection(connected.canonicalInstanceId)).toBeUndefined()
      expect(connections.getAppConnection(connected.tempInstanceId)).toBeUndefined()
    })
  })

  it("prunes DA state and DA-owned connection maps when host disconnect is called", async () => {
    const agent = createTestAgent({
      heartbeatEnabled: false,
      disconnectGracePeriod: 0,
    })
    activeAgents.push(agent)

    const connected = await connectWcpAppViaDaOwnedConnection(agent, {
      connectionAttemptUuid: "da-owned-host-disconnect-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const connections = requireDaOwnedAppConnection(agent)
    agent.disconnectInstance(connected.canonicalInstanceId)

    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
    expect(connections.getAppConnection(connected.canonicalInstanceId)).toBeUndefined()
  })

  it("prunes pending temp connection maps when WCP4 identity validation fails", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 0 })
    activeAgents.push(agent)

    const connections = requireDaOwnedAppConnection(agent)
    const connectionAttemptUuid = "da-owned-wcp4-fail-uuid"
    const tempInstanceId = `temp-${connectionAttemptUuid}`
    const unknownIdentityUrl = "https://example.com/unknown-app"

    const postMessageSpy = vi.spyOn(window, "postMessage")
    window.dispatchEvent(
      createMessageEvent(createWCP1Hello(connectionAttemptUuid, unknownIdentityUrl))
    )
    const calls = postMessageSpy.mock.calls as unknown as Array<
      [BrowserTypes.WebConnectionProtocol3Handshake, string, MessagePort[]]
    >
    const appPort = calls[0][2][0]
    appPort.start()
    postMessageSpy.mockRestore()

    expect(connections.getAppConnection(tempInstanceId)).toBeDefined()

    const wcp5FailurePromise =
      waitForPortMessage<BrowserTypes.WebConnectionProtocol5ValidateAppIdentityFailedResponse>(
        appPort,
        data => (data as { type?: string }).type === "WCP5ValidateAppIdentityFailedResponse"
      )

    appPort.postMessage({
      type: "WCP4ValidateAppIdentity",
      meta: {
        connectionAttemptUuid,
        timestamp: new Date(),
      },
      payload: {
        identityUrl: unknownIdentityUrl,
        actualUrl: unknownIdentityUrl,
      },
    } satisfies BrowserTypes.WebConnectionProtocol4ValidateAppIdentity)
    await flushAsyncDelivery()

    const failureResponse = await wcp5FailurePromise
    expect(failureResponse.type).toBe("WCP5ValidateAppIdentityFailedResponse")

    await vi.waitFor(() => {
      expect(connections.getAppConnection(tempInstanceId)).toBeUndefined()
      expect(agent.getState().instances[tempInstanceId]).toBeUndefined()
    })
  })

  it("delivers user-channel broadcast DACP round trip over MessagePort through DA-owned routing", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const listener = await connectWcpAppViaDaOwnedConnection(agent, {
      connectionAttemptUuid: "da-owned-broadcast-listener-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const broadcaster = await connectWcpAppViaDaOwnedConnection(agent, {
      connectionAttemptUuid: "da-owned-broadcast-source-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    const broadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      listener.appPort,
      data => (data as { type?: string }).type === "broadcastEvent"
    )

    await postDacpOnPort(
      listener.appPort,
      createJoinUserChannelMessage(listener.canonicalInstanceId, listener.appId, CHANNEL_ID)
    )
    await postDacpOnPort(
      listener.appPort,
      createAddContextListenerMessage(
        listener.canonicalInstanceId,
        listener.appId,
        CHANNEL_ID,
        INSTRUMENT_CONTEXT.type
      )
    )
    await postDacpOnPort(
      broadcaster.appPort,
      createJoinUserChannelMessage(broadcaster.canonicalInstanceId, broadcaster.appId, CHANNEL_ID)
    )
    await postDacpOnPort(
      broadcaster.appPort,
      createBroadcastMessage(
        broadcaster.canonicalInstanceId,
        broadcaster.appId,
        CHANNEL_ID,
        INSTRUMENT_CONTEXT
      )
    )

    const broadcastEvent = await broadcastPromise

    expect(broadcastEvent.payload.channelId).toBe(CHANNEL_ID)
    expect(broadcastEvent.payload.context?.type).toBe(INSTRUMENT_CONTEXT.type)
    expect(
      (
        broadcastEvent.meta as BrowserTypes.BroadcastEventMeta & {
          destination?: { instanceId?: string }
        }
      ).destination?.instanceId
    ).toBe(listener.canonicalInstanceId)
  })
})
