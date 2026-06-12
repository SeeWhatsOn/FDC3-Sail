/**
 * WCP edge-contract integration tests.
 *
 * Proves the browser edge (WCPConnector + MessagePort) wired to DesktopAgent —
 * not MockTransport-only DACP handler tests.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import type { BrowserTypes } from "@finos/fdc3"
import type { AppLauncher } from "../../../host-contracts/app-launcher"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../core/default-user-channels"
import { AppInstanceState } from "../../../core/state/types"
import { getActiveHeartbeatTimerCount } from "../../../core/handlers/dacp/heartbeat-runtime"
import { createBrowserDesktopAgent } from "../browser-desktop-agent"
import type { DesktopAgent } from "../../../core/desktop-agent"
import { getBrowserDesktopAgentSession } from "../browser-desktop-agent-session"
import {
  INSTRUMENT_CONTEXT,
  connectWcpApp,
  createAddContextListenerMessage,
  createBroadcastMessage,
  createJoinUserChannelMessage,
  createOpenRequestMessage,
  flushAsyncDelivery,
  postDacpOnPort,
  waitForPortMessage,
} from "./wcp-edge-test-helpers"

const CHANNEL_ID = "fdc3.channel.1"
const HOST_LAUNCHER_INSTANCE_ID = "uuid-host-0"

const PORTFOLIO_APP = {
  appId: "portfolioApp",
  title: "Portfolio",
  type: "web" as const,
  details: { url: "https://example.com/portfolio" },
}

const CHART_APP = {
  appId: "chartApp",
  title: "Chart",
  type: "web" as const,
  details: { url: "https://example.com/chart" },
}

function createTestAgent(options?: {
  appLauncher?: AppLauncher
  heartbeatEnabled?: boolean
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
}): DesktopAgent {
  const agent = createBrowserDesktopAgent({
    userChannels: DEFAULT_FDC3_USER_CHANNELS,
    apps: [PORTFOLIO_APP, CHART_APP],
    appLauncher: options?.appLauncher,
    heartbeatEnabled: options?.heartbeatEnabled,
    heartbeatIntervalMs: options?.heartbeatIntervalMs,
    heartbeatTimeoutMs: options?.heartbeatTimeoutMs,
    wcpOptions: {
      getIntentResolverUrl: () => false,
      getChannelSelectorUrl: () => false,
      fdc3Version: "2.2",
      handshakeTimeout: 30_000,
    },
  })

  return agent
}

function createWCP6GoodbyeMessage(): BrowserTypes.WebConnectionProtocol6Goodbye {
  return {
    type: "WCP6Goodbye",
    meta: {
      timestamp: new Date(),
    },
  }
}

function createHostInstanceAppLauncher(): AppLauncher {
  return {
    launch(request) {
      return Promise.resolve({
        appId: request.app.appId,
        instanceId: request.app.instanceId ?? HOST_LAUNCHER_INSTANCE_ID,
      })
    },
  }
}

describe("WCP edge contract", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("routes WCP4 through the connector to DesktopAgent and correlates temp→canonical instance ids", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const appConnected = vi.fn()
    getBrowserDesktopAgentSession(agent).wcpConnector.on("appConnected", appConnected)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "integration-wcp-path-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(appConnected).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: connected.canonicalInstanceId,
        appId: "portfolioApp",
        connectionAttemptUuid: "integration-wcp-path-uuid",
      })
    )

    expect(agent.getState().instances[connected.canonicalInstanceId]?.appId).toBe("portfolioApp")
  })

  it("delivers user-channel broadcast from app B to app A listener over MessagePort routing", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "edge-listener-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const appB = await connectWcpApp(agent, {
      connectionAttemptUuid: "edge-broadcaster-uuid",
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
    const destination = broadcastEvent.meta.destination as { instanceId?: string } | undefined
    expect(destination?.instanceId).toBe(appA.canonicalInstanceId)
    expect(broadcastEvent.payload.context?.type).toBe(INSTRUMENT_CONTEXT.type)
  })

  it("adopts host launcher instanceId as canonical id when open pre-registers a PENDING instance", async () => {
    const agent = createTestAgent({ appLauncher: createHostInstanceAppLauncher() })
    activeAgents.push(agent)

    const source = await connectWcpApp(agent, {
      connectionAttemptUuid: "edge-open-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await postDacpOnPort(
      source.appPort,
      createOpenRequestMessage(source.canonicalInstanceId, source.appId, CHART_APP.appId)
    )
    await flushAsyncDelivery()

    await vi.waitFor(() => {
      const pending = agent.getState().instances[HOST_LAUNCHER_INSTANCE_ID]
      expect(pending?.appId).toBe(CHART_APP.appId)
      expect(pending?.state).toBe("pending")
    })

    const chart = await connectWcpApp(agent, {
      connectionAttemptUuid: "edge-open-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      hostInstanceId: HOST_LAUNCHER_INSTANCE_ID,
      instanceUuid: crypto.randomUUID(),
    })

    expect(chart.canonicalInstanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)
    expect(
      getBrowserDesktopAgentSession(agent).wcpConnector.getConnection(HOST_LAUNCHER_INSTANCE_ID)
    ).toBeDefined()
  })

  it("adopts sole pending launcher id when WCP4 omits host instanceId", async () => {
    const agent = createTestAgent({ appLauncher: createHostInstanceAppLauncher() })
    activeAgents.push(agent)

    const source = await connectWcpApp(agent, {
      connectionAttemptUuid: "edge-open-source-no-id-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await postDacpOnPort(
      source.appPort,
      createOpenRequestMessage(source.canonicalInstanceId, source.appId, CHART_APP.appId)
    )
    await flushAsyncDelivery()

    await vi.waitFor(() => {
      expect(agent.getState().instances[HOST_LAUNCHER_INSTANCE_ID]?.state).toBe("pending")
    })

    const chart = await connectWcpApp(agent, {
      connectionAttemptUuid: "edge-open-target-no-id-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      instanceUuid: crypto.randomUUID(),
    })

    expect(chart.canonicalInstanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)
  })
})

describe("Option A instance lifecycle (WCP path)", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("marks the instance CONNECTED after WCP5 without manual state updates", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-wcp5-connected-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )
  })

  it("keeps host pre-registered launcher instance PENDING until WCP5 then CONNECTED", async () => {
    const agent = createTestAgent({ appLauncher: createHostInstanceAppLauncher() })
    activeAgents.push(agent)

    const source = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-pending-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await postDacpOnPort(
      source.appPort,
      createOpenRequestMessage(source.canonicalInstanceId, source.appId, CHART_APP.appId)
    )
    await flushAsyncDelivery()

    await vi.waitFor(() => {
      expect(agent.getState().instances[HOST_LAUNCHER_INSTANCE_ID]?.state).toBe(
        AppInstanceState.PENDING
      )
    })

    const chart = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-pending-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      hostInstanceId: HOST_LAUNCHER_INSTANCE_ID,
      instanceUuid: crypto.randomUUID(),
    })

    expect(chart.canonicalInstanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)
    expect(agent.getState().instances[HOST_LAUNCHER_INSTANCE_ID]?.state).toBe(
      AppInstanceState.CONNECTED
    )
  })

  it("removes the instance when the app sends WCP6Goodbye over MessagePort", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-wcp6-goodbye-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )

    connected.appPort.postMessage(createWCP6GoodbyeMessage())
    await flushAsyncDelivery()

    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
    expect(
      getBrowserDesktopAgentSession(agent).wcpConnector.getConnection(connected.canonicalInstanceId)
    ).toBeUndefined()
  })

  it("does not start heartbeat timers when heartbeat is disabled but keeps instance until disconnect", async () => {
    const agent = createTestAgent({ heartbeatEnabled: false })
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-heartbeat-off-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )
    expect(getActiveHeartbeatTimerCount()).toBe(0)
    expect(agent.getState().heartbeats[connected.canonicalInstanceId]).toBeUndefined()

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )

    connected.appPort.postMessage(createWCP6GoodbyeMessage())
    await flushAsyncDelivery()

    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
  })

  it("host disconnectInstance with temp WCP4 id removes canonical instance when heartbeat is disabled", async () => {
    const agent = createTestAgent({ heartbeatEnabled: false })
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-temp-disconnect-no-hb-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )
    expect(
      getBrowserDesktopAgentSession(agent).wcpConnector.getConnection(connected.canonicalInstanceId)
    ).toBeDefined()

    agent.disconnectInstance(connected.tempInstanceId)

    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
    expect(
      getBrowserDesktopAgentSession(agent).wcpConnector.getConnection(connected.canonicalInstanceId)
    ).toBeUndefined()
  })

  it("routes subsequent DACP using canonical instance id after WCP5 when app sends temp source id", async () => {
    const agent = createTestAgent({ heartbeatEnabled: false })
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-canonical-routing-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await postDacpOnPort(
      connected.appPort,
      createJoinUserChannelMessage(connected.tempInstanceId, connected.appId, CHANNEL_ID)
    )

    await vi.waitFor(() => {
      expect(agent.getState().instances[connected.canonicalInstanceId]?.currentUserChannel).toBe(
        CHANNEL_ID
      )
    })
    expect(agent.getState().instances[connected.tempInstanceId]).toBeUndefined()
  })

  it("removes the instance on heartbeat timeout with the same cleanup as explicit disconnect", async () => {
    const agent = createTestAgent({
      heartbeatIntervalMs: 500,
      heartbeatTimeoutMs: 2000,
    })
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-heartbeat-timeout-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )
    expect(getActiveHeartbeatTimerCount()).toBe(1)

    await new Promise(resolve => setTimeout(resolve, 2500))
    await flushAsyncDelivery()

    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
    expect(getActiveHeartbeatTimerCount()).toBe(0)
    expect(agent.getState().heartbeats[connected.canonicalInstanceId]).toBeUndefined()
    expect(
      getBrowserDesktopAgentSession(agent).wcpConnector.getConnection(connected.canonicalInstanceId)
    ).toBeUndefined()
  }, 10_000)
})
