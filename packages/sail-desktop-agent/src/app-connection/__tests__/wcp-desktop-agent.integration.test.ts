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
import type { AppLauncher } from "../../host-contracts/app-launcher"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../core/default-user-channels"
import { createBrowserDesktopAgent } from "../../presets/create-browser-desktop-agent"
import type { BrowserDesktopAgentOptions } from "../../presets/create-browser-desktop-agent"
import type { DesktopAgent } from "../../core/desktop-agent"
import { getBrowserDesktopAgentSession } from "../../presets/browser-session"
import { AppInstanceState } from "../../core/state/types"
import {
  clearAllHeartbeatTimersForTesting,
  getActiveHeartbeatTimerCount,
} from "../../core/handlers/dacp/heartbeat-runtime"
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

type TestAgentOptions = Pick<
  BrowserDesktopAgentOptions,
  "appLauncher" | "heartbeatEnabled" | "heartbeatIntervalMs" | "heartbeatTimeoutMs"
> & {
  disconnectGracePeriod?: number
}

function createTestAgent(options?: TestAgentOptions): DesktopAgent {
  const agent = createBrowserDesktopAgent({
    userChannels: DEFAULT_FDC3_USER_CHANNELS,
    appLauncher: options?.appLauncher,
    heartbeatEnabled: options?.heartbeatEnabled,
    heartbeatIntervalMs: options?.heartbeatIntervalMs,
    heartbeatTimeoutMs: options?.heartbeatTimeoutMs,
    wcpOptions: {
      getIntentResolverUrl: () => false,
      getChannelSelectorUrl: () => false,
      fdc3Version: "2.2",
      handshakeTimeout: 30_000,
      disconnectGracePeriod: options?.disconnectGracePeriod,
    },
  })

  agent.getAppDirectory().addApplications([PORTFOLIO_APP, CHART_APP])
  return agent
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
    clearAllHeartbeatTimersForTesting()
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
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("marks instance connected after WCP5 success without manual state updates", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-wcp5-connected-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.appId).toBe("portfolioApp")
    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )
  })

  it("keeps host pre-registered instance pending until WCP5 succeeds", async () => {
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
      const preWcp5 = agent.getState().instances[HOST_LAUNCHER_INSTANCE_ID]
      expect(preWcp5?.appId).toBe(CHART_APP.appId)
      expect(preWcp5?.state).toBe(AppInstanceState.PENDING)
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

  it("removes instance from agent state when app sends WCP6Goodbye", async () => {
    const agent = createTestAgent({ disconnectGracePeriod: 0 })
    activeAgents.push(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "lifecycle-wcp6-goodbye-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED
    )

    connected.appPort.postMessage({
      type: "WCP6Goodbye",
      meta: { timestamp: new Date().toISOString() },
    })
    await flushAsyncDelivery()

    await vi.waitFor(() => {
      expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
    })
  })

  it("skips heartbeat machinery when heartbeat is disabled and keeps instance until disconnect", async () => {
    const agent = createTestAgent({
      heartbeatEnabled: false,
      disconnectGracePeriod: 0,
    })
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

    await new Promise(resolve => setTimeout(resolve, 300))

    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeDefined()
    expect(getActiveHeartbeatTimerCount()).toBe(0)
  })

  it("removes instance on heartbeat timeout when heartbeat is enabled", async () => {
    const agent = createTestAgent({
      heartbeatEnabled: true,
      heartbeatIntervalMs: 50,
      heartbeatTimeoutMs: 150,
      disconnectGracePeriod: 0,
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
    expect(getActiveHeartbeatTimerCount()).toBeGreaterThan(0)

    await vi.waitFor(
      () => {
        expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
      },
      { timeout: 2000 }
    )
    expect(getActiveHeartbeatTimerCount()).toBe(0)
  })
})
