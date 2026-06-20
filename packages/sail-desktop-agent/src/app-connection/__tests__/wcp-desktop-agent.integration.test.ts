/**
 * WCP edge-contract integration tests.
 *
 * Proves the browser edge (WCPConnector + MessagePort) wired to DesktopAgent —
 * not MockTransport-only DACP handler tests.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import type { BrowserTypes, Context } from "@finos/fdc3"
import type { DesktopAgent } from "../../core/desktop-agent"
import { getBrowserDesktopAgentSession } from "../../presets/browser-session"
import { clearAllHeartbeatTimersForTesting } from "../../core/handlers/dacp/heartbeat-runtime"
import {
  INSTRUMENT_CONTEXT,
  connectWcpApp,
  createAddContextListenerMessage,
  createAddEventListenerMessage,
  createBroadcastMessage,
  createGetOrCreateChannelMessage,
  createJoinUserChannelMessage,
  createGenericContextListenerMessage,
  createOpenRequestMessage,
  flushAsyncDelivery,
  postDacpOnPort,
  waitForPortMessage,
} from "./wcp-edge-test-helpers"
import {
  CHANNEL_ID,
  CHART_APP,
  createHostInstanceAppLauncher,
  createTestAgent,
  HOST_LAUNCHER_INSTANCE_ID,
  PORTFOLIO_APP,
} from "./wcp-desktop-agent.integration.fixtures"

const OPEN_WITH_CONTEXT_LAUNCH: Context = {
  type: "testContextY",
  id: { value: "conformance-open-context" },
}

const CHANNEL_ID_2 = "fdc3.channel.2"

type AppChannelChangeEvent = {
  instanceId: string
  channelId: string | null
  channel: BrowserTypes.Channel | null
}

type BrowserChannelsController = {
  getUserChannels: () => BrowserTypes.Channel[]
  getAppChannel: (instanceId: string) => BrowserTypes.Channel | null
  getAppChannelId: (instanceId: string) => string | null
  changeAppChannel: (instanceId: string, channelId: string | null) => Promise<void>
  onAppChannelChange: (listener: (event: AppChannelChangeEvent) => void) => () => void
}

type TestBrowserAgent = DesktopAgent & { channels: BrowserChannelsController }

function requireChannelsController(agent: DesktopAgent): BrowserChannelsController {
  const { channels } = agent as TestBrowserAgent
  expect(channels).toBeDefined()
  expect(typeof channels.getAppChannelId).toBe("function")
  expect(typeof channels.getAppChannel).toBe("function")
  expect(typeof channels.changeAppChannel).toBe("function")
  expect(typeof channels.onAppChannelChange).toBe("function")
  return channels
}

function waitForChannelChangedEvent(
  appPort: MessagePort,
  expectedChannelId: string | null
): Promise<BrowserTypes.ChannelChangedEvent> {
  return waitForPortMessage<BrowserTypes.ChannelChangedEvent>(appPort, data => {
    const message = data as {
      type?: string
      payload?: { channelId?: string | null; newChannelId?: string | null }
    }
    if (message.type !== "channelChangedEvent") {
      return false
    }
    const channelId = message.payload?.channelId ?? message.payload?.newChannelId ?? null
    return channelId === expectedChannelId
  })
}

describe("WCP open-with-context (AOpensBWithContext3 path)", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("delivers launch context via broadcastEvent when B adds a generic * listener after host-pre-registered open", async () => {
    const agent = createTestAgent({
      appLauncher: createHostInstanceAppLauncher(),
      openContextListenerTimeoutMs: 5000,
    })
    activeAgents.push(agent)

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "open-with-context-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const openResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse"
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        OPEN_WITH_CONTEXT_LAUNCH
      )
    )

    await vi.waitFor(() => {
      expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length).toBe(1)
      expect(agent.getState().instances[HOST_LAUNCHER_INSTANCE_ID]?.appId).toBe(CHART_APP.appId)
    })

    const appB = await connectWcpApp(agent, {
      connectionAttemptUuid: "open-with-context-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      hostInstanceId: HOST_LAUNCHER_INSTANCE_ID,
      instanceUuid: crypto.randomUUID(),
    })

    expect(appB.canonicalInstanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)

    const broadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      appB.appPort,
      data => (data as { type?: string }).type === "broadcastEvent"
    )

    await postDacpOnPort(
      appB.appPort,
      createGenericContextListenerMessage(appB.canonicalInstanceId, appB.appId)
    )

    const [broadcastEvent, openResponse] = await Promise.all([
      broadcastPromise,
      openResponsePromise,
    ])

    expect(broadcastEvent.type).toBe("broadcastEvent")
    const destination = broadcastEvent.meta.destination as { instanceId?: string } | undefined
    expect(destination?.instanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)
    expect(broadcastEvent.payload.context?.type).toBe(OPEN_WITH_CONTEXT_LAUNCH.type)
    expect(broadcastEvent.payload.channelId).toBeNull()

    expect(openResponse.type).toBe("openResponse")
    expect(openResponse.payload.error).toBeUndefined()
    expect(openResponse.payload.appIdentifier?.instanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)
    expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length ?? 0).toBe(0)
  })

  it("does not deliver open-with-context to a stale chart instance when a new host-pre-registered open is pending", async () => {
    const staleHostInstanceId = "uuid-host-stale"

    const agent = createTestAgent({
      appLauncher: createHostInstanceAppLauncher(),
      openContextListenerTimeoutMs: 5000,
    })
    activeAgents.push(agent)

    const staleChart = await connectWcpApp(agent, {
      connectionAttemptUuid: "open-with-context-stale-chart-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      hostInstanceId: staleHostInstanceId,
      instanceUuid: crypto.randomUUID(),
    })

    await postDacpOnPort(
      staleChart.appPort,
      createGenericContextListenerMessage(staleChart.canonicalInstanceId, staleChart.appId)
    )

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "open-with-context-stale-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const staleBroadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      staleChart.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
      500
    ).catch(() => null)

    const openResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
      6000
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        OPEN_WITH_CONTEXT_LAUNCH
      )
    )

    await vi.waitFor(() => {
      expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length).toBe(1)
    })

    const newChart = await connectWcpApp(agent, {
      connectionAttemptUuid: "open-with-context-stale-new-chart-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      hostInstanceId: HOST_LAUNCHER_INSTANCE_ID,
      instanceUuid: crypto.randomUUID(),
    })

    const newBroadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      newChart.appPort,
      data => (data as { type?: string }).type === "broadcastEvent"
    )

    await postDacpOnPort(
      newChart.appPort,
      createGenericContextListenerMessage(newChart.canonicalInstanceId, newChart.appId)
    )

    const staleBroadcast = await staleBroadcastPromise
    const newBroadcast = await newBroadcastPromise
    const openResponse = await openResponsePromise

    expect(staleBroadcast).toBeNull()
    expect(newBroadcast.payload.context?.type).toBe(OPEN_WITH_CONTEXT_LAUNCH.type)
    expect(openResponse.payload.error).toBeUndefined()
  })
})

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

  it("delivers app-channel broadcast from app B to app A listener over MessagePort routing", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)

    const appChannelId = "shared-wcp-app-channel"

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "edge-app-channel-listener-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const appB = await connectWcpApp(agent, {
      connectionAttemptUuid: "edge-app-channel-broadcaster-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    await postDacpOnPort(
      appA.appPort,
      createGetOrCreateChannelMessage(appA.canonicalInstanceId, appA.appId, appChannelId)
    )
    await postDacpOnPort(
      appB.appPort,
      createGetOrCreateChannelMessage(appB.canonicalInstanceId, appB.appId, appChannelId)
    )

    const broadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      appA.appPort,
      data => (data as { type?: string }).type === "broadcastEvent"
    )

    await postDacpOnPort(
      appA.appPort,
      createAddContextListenerMessage(
        appA.canonicalInstanceId,
        appA.appId,
        appChannelId,
        INSTRUMENT_CONTEXT.type
      )
    )
    await postDacpOnPort(
      appB.appPort,
      createBroadcastMessage(appB.canonicalInstanceId, appB.appId, appChannelId, INSTRUMENT_CONTEXT)
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

describe("browser channels controller (WCP integration)", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("reads null app channel before any join", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const channels = requireChannelsController(agent)

    const app = await connectWcpApp(agent, {
      connectionAttemptUuid: "channels-read-null-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(channels.getAppChannelId(app.canonicalInstanceId)).toBeNull()
    expect(channels.getAppChannel(app.canonicalInstanceId)).toBeNull()
  })

  it("host changeAppChannel delivers channelChangedEvent to the app over MessagePort", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const channels = requireChannelsController(agent)

    const app = await connectWcpApp(agent, {
      connectionAttemptUuid: "channels-host-change-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await postDacpOnPort(
      app.appPort,
      createAddEventListenerMessage(app.canonicalInstanceId, app.appId, "channelChanged")
    )

    const channelChangedPromise = waitForChannelChangedEvent(app.appPort, CHANNEL_ID)

    await channels.changeAppChannel(app.canonicalInstanceId, CHANNEL_ID)

    const channelChangedEvent = await channelChangedPromise

    expect(channelChangedEvent.type).toBe("channelChangedEvent")
    expect(channelChangedEvent.payload.channelId ?? channelChangedEvent.payload.newChannelId).toBe(
      CHANNEL_ID
    )
    expect(channels.getAppChannelId(app.canonicalInstanceId)).toBe(CHANNEL_ID)
    expect(channels.getAppChannel(app.canonicalInstanceId)).toMatchObject({
      id: CHANNEL_ID,
      type: "user",
    })
    expect(agent.getState().instances[app.canonicalInstanceId]?.currentUserChannel).toBe(CHANNEL_ID)
  })

  it("host changeAppChannel to null leaves the channel and notifies the app", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const channels = requireChannelsController(agent)

    const app = await connectWcpApp(agent, {
      connectionAttemptUuid: "channels-host-leave-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await postDacpOnPort(
      app.appPort,
      createAddEventListenerMessage(app.canonicalInstanceId, app.appId, "channelChanged")
    )
    await postDacpOnPort(
      app.appPort,
      createJoinUserChannelMessage(app.canonicalInstanceId, app.appId, CHANNEL_ID)
    )

    await vi.waitFor(() => {
      expect(channels.getAppChannelId(app.canonicalInstanceId)).toBe(CHANNEL_ID)
    })

    const leavePromise = waitForChannelChangedEvent(app.appPort, null)

    await channels.changeAppChannel(app.canonicalInstanceId, null)

    const leaveEvent = await leavePromise

    expect(leaveEvent.type).toBe("channelChangedEvent")
    expect(leaveEvent.payload.channelId ?? leaveEvent.payload.newChannelId).toBeNull()
    expect(channels.getAppChannelId(app.canonicalInstanceId)).toBeNull()
    expect(channels.getAppChannel(app.canonicalInstanceId)).toBeNull()
    expect(agent.getState().instances[app.canonicalInstanceId]?.currentUserChannel).toBeNull()
  })

  it("getAppChannel reflects app-driven join through the same agent state path", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const channels = requireChannelsController(agent)

    const app = await connectWcpApp(agent, {
      connectionAttemptUuid: "channels-app-join-read-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await postDacpOnPort(
      app.appPort,
      createJoinUserChannelMessage(app.canonicalInstanceId, app.appId, CHANNEL_ID_2)
    )

    await vi.waitFor(() => {
      expect(channels.getAppChannelId(app.canonicalInstanceId)).toBe(CHANNEL_ID_2)
    })

    expect(channels.getAppChannel(app.canonicalInstanceId)).toMatchObject({
      id: CHANNEL_ID_2,
      type: "user",
    })
    expect(agent.getState().instances[app.canonicalInstanceId]?.currentUserChannel).toBe(
      CHANNEL_ID_2
    )
  })

  it("onAppChannelChange notifies when the app joins a channel through its FDC3 API", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const channels = requireChannelsController(agent)

    const app = await connectWcpApp(agent, {
      connectionAttemptUuid: "channels-app-driven-notify-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const hostEvents: AppChannelChangeEvent[] = []
    channels.onAppChannelChange(event => {
      hostEvents.push(event)
    })

    await postDacpOnPort(
      app.appPort,
      createJoinUserChannelMessage(app.canonicalInstanceId, app.appId, CHANNEL_ID)
    )

    await vi.waitFor(() => {
      expect(hostEvents).toHaveLength(1)
      expect(hostEvents[0]).toMatchObject({
        instanceId: app.canonicalInstanceId,
        channelId: CHANNEL_ID,
        channel: { id: CHANNEL_ID, type: "user" },
      })
    })
  })

  it("onAppChannelChange notifies when the host changes the app channel", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const channels = requireChannelsController(agent)

    const app = await connectWcpApp(agent, {
      connectionAttemptUuid: "channels-host-driven-notify-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const hostEvents: AppChannelChangeEvent[] = []
    channels.onAppChannelChange(event => {
      hostEvents.push(event)
    })

    await channels.changeAppChannel(app.canonicalInstanceId, CHANNEL_ID_2)

    await vi.waitFor(() => {
      expect(hostEvents).toHaveLength(1)
      expect(hostEvents[0]).toMatchObject({
        instanceId: app.canonicalInstanceId,
        channelId: CHANNEL_ID_2,
        channel: { id: CHANNEL_ID_2, type: "user" },
      })
    })
  })

  it("stops delivering onAppChannelChange after unsubscribe", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const channels = requireChannelsController(agent)

    const app = await connectWcpApp(agent, {
      connectionAttemptUuid: "channels-unsub-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    let notificationCount = 0
    const unsubscribe = channels.onAppChannelChange(() => {
      notificationCount += 1
    })

    await channels.changeAppChannel(app.canonicalInstanceId, CHANNEL_ID)

    await vi.waitFor(() => {
      expect(notificationCount).toBe(1)
    })

    unsubscribe()

    await channels.changeAppChannel(app.canonicalInstanceId, CHANNEL_ID_2)

    await flushAsyncDelivery()

    expect(notificationCount).toBe(1)
  })
})
