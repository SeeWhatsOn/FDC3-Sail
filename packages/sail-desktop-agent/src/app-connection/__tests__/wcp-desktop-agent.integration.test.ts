/**
 * WCP edge-contract integration tests.
 *
 * Proves the browser edge (BrowserAppConnection + MessagePort) wired to DesktopAgent —
 * not headless ingest-only DACP oracle tests.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vite-plus/test"
import { OpenError, type BrowserTypes, type Context } from "@finos/fdc3"
import type { AppLauncher } from "../../host-contracts/app-launcher"
import type { DesktopAgent } from "../../agent/desktop-agent"
import type { SailDesktopAgent } from "../../agent/sail-desktop-agent"
import type { AppConnectionMetadata } from "../../app-connection/browser-app-connection"
import { AppInstanceState } from "../../state/types"
import { clearAllHeartbeatTimersForTesting } from "../../handlers/heartbeat/runtime"
import {
  COUNTRY_CONTEXT,
  INSTRUMENT_CONTEXT,
  collectPortMessages,
  connectWcpApp,
  connectWcpAppFirstConnect,
  beginWcpAppFirstConnect,
  createAddContextListenerMessage,
  createAddEventListenerMessage,
  createBroadcastMessage,
  createGetOrCreateChannelMessage,
  createJoinUserChannelMessage,
  createGenericContextListenerMessage,
  createMessageEvent,
  createOpenRequestMessage,
  createWCP1Hello,
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

type SailDesktopAgentChannelsController = {
  getUserChannels: () => BrowserTypes.Channel[]
  getAppChannel: (instanceId: string) => BrowserTypes.Channel | null
  getAppChannelId: (instanceId: string) => string | null
  changeAppChannel: (instanceId: string, channelId: string | null) => Promise<void>
  onAppChannelChange: (listener: (event: AppChannelChangeEvent) => void) => () => void
}

type BrowserAppInstance = {
  appId: string
  instanceId: string
  status: "pending" | "connected"
  currentUserChannel?: string | null
}

type HandshakeFailureEvent = {
  error: Error
  connectionAttemptUuid: string
}

type SailDesktopAgentAppsController = {
  add: (app: typeof PORTFOLIO_APP) => void
  addAll: (apps: (typeof PORTFOLIO_APP)[]) => void
  addDirectory: (url: string) => Promise<void>
  remove: (appId: string) => void
  getAll: () => Array<typeof PORTFOLIO_APP>
  getById: (appId: string) => typeof PORTFOLIO_APP | undefined
  open: (
    app: string | BrowserTypes.AppIdentifier,
    options?: { context?: Context; instanceId?: string },
  ) => Promise<BrowserTypes.AppIdentifier>
  getInstances: () => BrowserAppInstance[]
  getInstance: (instanceId: string) => BrowserAppInstance | undefined
  getConnections: () => AppConnectionMetadata[]
  getConnection: (instanceId: string) => AppConnectionMetadata | undefined
  disconnect: (instanceId: string) => void
  onConnect: (listener: (metadata: AppConnectionMetadata) => void) => () => void
  onDisconnect: (listener: (instanceId: string) => void) => () => void
  onHandshakeFailure: (listener: (event: HandshakeFailureEvent) => void) => () => void
}

type TestBrowserAgent = DesktopAgent & {
  channels: SailDesktopAgentChannelsController
  apps: SailDesktopAgentAppsController
}

function getTestConnector(agent: DesktopAgent): SailDesktopAgent["connector"] {
  return (agent as SailDesktopAgent).connector
}

function requireChannelsController(agent: DesktopAgent): SailDesktopAgentChannelsController {
  const { channels } = agent as TestBrowserAgent
  expect(channels).toBeDefined()
  expect(typeof channels.getAppChannelId).toBe("function")
  expect(typeof channels.getAppChannel).toBe("function")
  expect(typeof channels.changeAppChannel).toBe("function")
  expect(typeof channels.onAppChannelChange).toBe("function")
  return channels
}

function requireAppsController(agent: DesktopAgent): SailDesktopAgentAppsController {
  const { apps } = agent as TestBrowserAgent
  expect(apps).toBeDefined()
  expect(typeof apps.onConnect).toBe("function")
  expect(typeof apps.onDisconnect).toBe("function")
  expect(typeof apps.disconnect).toBe("function")
  expect(typeof apps.getConnections).toBe("function")
  expect(typeof apps.getConnection).toBe("function")
  expect(typeof apps.getInstances).toBe("function")
  expect(typeof apps.getInstance).toBe("function")
  return apps
}

function waitForChannelChangedEvent(
  appPort: MessagePort,
  expectedChannelId: string | null,
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

describe("session carry-over", () => {
  const activeAgents: DesktopAgent[] = []
  const STALE_LAUNCHER_INSTANCE_ID = "L-stale"
  const SECOND_LAUNCHER_INSTANCE_ID = "L2"

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  function createSessionSoakAppLauncher(): AppLauncher {
    let launchCount = 0
    return {
      launch(request) {
        const launcherIds = [STALE_LAUNCHER_INSTANCE_ID, SECOND_LAUNCHER_INSTANCE_ID]
        const instanceId = request.app.instanceId ?? launcherIds[launchCount++]
        return Promise.resolve({ appId: request.app.appId, instanceId })
      },
    }
  }

  function createFindInstancesMessage(
    sourceInstanceId: string,
    sourceAppId: string,
    targetAppId: string,
  ): BrowserTypes.FindInstancesRequest {
    return {
      type: "findInstancesRequest",
      meta: {
        requestUuid: crypto.randomUUID(),
        timestamp: new Date(),
        source: { appId: sourceAppId, instanceId: sourceInstanceId },
      },
      payload: {
        app: { appId: targetAppId },
      },
    }
  }

  it("delivers second open-with-context to L2 when L-stale remains CONNECTED from earlier session", async () => {
    const agent = createTestAgent({
      appLauncher: createSessionSoakAppLauncher(),
      openContextListenerTimeoutMs: 5000,
    })
    activeAgents.push(agent)

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "session-soak-open-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const firstOpenResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        OPEN_WITH_CONTEXT_LAUNCH,
      ),
    )

    await vi.waitFor(() => {
      expect(agent.getState().open.pendingWithContext[STALE_LAUNCHER_INSTANCE_ID]?.length).toBe(1)
      expect(agent.getState().instances[STALE_LAUNCHER_INSTANCE_ID]?.appId).toBe(CHART_APP.appId)
    })

    const staleChart = await connectWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "session-soak-stale-chart-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      hostInstanceId: STALE_LAUNCHER_INSTANCE_ID,
    })

    const firstBroadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      staleChart.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      staleChart.appPort,
      createGenericContextListenerMessage(staleChart.canonicalInstanceId, staleChart.appId),
    )

    const [firstBroadcast, firstOpenResponse] = await Promise.all([
      firstBroadcastPromise,
      firstOpenResponsePromise,
    ])

    expect(staleChart.canonicalInstanceId).toBe(STALE_LAUNCHER_INSTANCE_ID)
    expect(firstBroadcast.payload.context?.type).toBe(OPEN_WITH_CONTEXT_LAUNCH.type)
    expect(firstOpenResponse.payload.error).toBeUndefined()
    expect(firstOpenResponse.payload.appIdentifier?.instanceId).toBe(STALE_LAUNCHER_INSTANCE_ID)
    expect(agent.getState().instances[STALE_LAUNCHER_INSTANCE_ID]?.state).toBe(
      AppInstanceState.CONNECTED,
    )

    const secondOpenResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
    )

    const staleBroadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      staleChart.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
      500,
    ).catch(() => null)

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        OPEN_WITH_CONTEXT_LAUNCH,
      ),
    )

    await vi.waitFor(() => {
      expect(agent.getState().open.pendingWithContext[SECOND_LAUNCHER_INSTANCE_ID]?.length).toBe(1)
      expect(agent.getState().instances[SECOND_LAUNCHER_INSTANCE_ID]?.appId).toBe(CHART_APP.appId)
    })

    const findInstancesResponsePromise = waitForPortMessage<BrowserTypes.FindInstancesResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "findInstancesResponse",
    )

    await postDacpOnPort(
      appA.appPort,
      createFindInstancesMessage(appA.canonicalInstanceId, appA.appId, CHART_APP.appId),
    )

    const findInstancesResponse = await findInstancesResponsePromise
    const findInstancesIds =
      findInstancesResponse.payload.appIdentifiers?.map(identifier => identifier.instanceId) ?? []

    expect(findInstancesIds).toContain(SECOND_LAUNCHER_INSTANCE_ID)
    expect(findInstancesIds).not.toEqual([STALE_LAUNCHER_INSTANCE_ID])

    const appB = await connectWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "session-soak-first-connect-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      hostInstanceId: SECOND_LAUNCHER_INSTANCE_ID,
    })

    expect(appB.canonicalInstanceId).toBe(SECOND_LAUNCHER_INSTANCE_ID)

    const newBroadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      appB.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appB.appPort,
      createGenericContextListenerMessage(appB.canonicalInstanceId, appB.appId),
    )

    const [staleBroadcast, newBroadcast, openResponse] = await Promise.all([
      staleBroadcastPromise,
      newBroadcastPromise,
      secondOpenResponsePromise,
    ])

    expect(staleBroadcast).toBeNull()
    expect(newBroadcast.payload.context?.type).toBe(OPEN_WITH_CONTEXT_LAUNCH.type)
    expect(openResponse.type).toBe("openResponse")
    expect(openResponse.payload.error).toBeUndefined()
    expect(openResponse.payload.appIdentifier?.instanceId).toBe(SECOND_LAUNCHER_INSTANCE_ID)
    expect(agent.getState().open.pendingWithContext[SECOND_LAUNCHER_INSTANCE_ID]?.length ?? 0).toBe(
      0,
    )

    const connectedChartInstances = Object.values(agent.getState().instances).filter(
      instance =>
        instance.appId === CHART_APP.appId && instance.state === AppInstanceState.CONNECTED,
    )
    // Session soak: stale L-stale may remain CONNECTED alongside L2 — see findIntent oracle / RT-06.
    expect(connectedChartInstances.length).toBeGreaterThanOrEqual(2)
    expect(connectedChartInstances.map(instance => instance.instanceId)).toEqual(
      expect.arrayContaining([STALE_LAUNCHER_INSTANCE_ID, SECOND_LAUNCHER_INSTANCE_ID]),
    )
  })
})

describe("multi-pending hostIdentifier adoption", () => {
  const activeAgents: DesktopAgent[] = []
  const STALE_PENDING_ID = "L1"
  const NEW_PENDING_ID = "L2"

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  function createMultiPendingAppLauncher(): AppLauncher {
    let launchCount = 0
    return {
      launch(request) {
        const launcherIds = [STALE_PENDING_ID, NEW_PENDING_ID]
        const instanceId = request.app.instanceId ?? launcherIds[launchCount++]
        return Promise.resolve({ appId: request.app.appId, instanceId })
      },
    }
  }

  function createFindInstancesMessage(
    sourceInstanceId: string,
    sourceAppId: string,
    targetAppId: string,
  ): BrowserTypes.FindInstancesRequest {
    return {
      type: "findInstancesRequest",
      meta: {
        requestUuid: crypto.randomUUID(),
        timestamp: new Date(),
        source: { appId: sourceAppId, instanceId: sourceInstanceId },
      },
      payload: {
        app: { appId: targetAppId },
      },
    }
  }

  it("delivers open-with-context to L2 when WCP4 omits instanceId and hostIdentifier names L2 among two stale PENDING rows", async () => {
    const agent = createTestAgent({
      appLauncher: createMultiPendingAppLauncher(),
      openContextListenerTimeoutMs: 5000,
    })
    activeAgents.push(agent)

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "multi-pending-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(appA.canonicalInstanceId, appA.appId, CHART_APP.appId),
    )

    await waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
    )

    await vi.waitFor(() => {
      expect(agent.getState().instances[STALE_PENDING_ID]?.state).toBe(AppInstanceState.PENDING)
    })

    const openResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        OPEN_WITH_CONTEXT_LAUNCH,
      ),
    )

    await vi.waitFor(() => {
      expect(agent.getState().instances[STALE_PENDING_ID]?.state).toBe(AppInstanceState.PENDING)
      expect(agent.getState().instances[NEW_PENDING_ID]?.state).toBe(AppInstanceState.PENDING)
      expect(agent.getState().open.pendingWithContext[NEW_PENDING_ID]?.length).toBe(1)
    })

    const appB = await connectWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "multi-pending-host-id-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
      hostIdentifier: NEW_PENDING_ID,
    })

    expect(appB.canonicalInstanceId).toBe(NEW_PENDING_ID)

    const broadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      appB.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appB.appPort,
      createGenericContextListenerMessage(appB.canonicalInstanceId, appB.appId),
    )

    const [broadcastEvent, openResponse] = await Promise.all([
      broadcastPromise,
      openResponsePromise,
    ])

    expect(broadcastEvent.payload.context?.type).toBe(OPEN_WITH_CONTEXT_LAUNCH.type)
    expect(openResponse.type).toBe("openResponse")
    expect(openResponse.payload.error).toBeUndefined()
    expect(openResponse.payload.appIdentifier?.instanceId).toBe(NEW_PENDING_ID)
    expect(agent.getState().open.pendingWithContext[NEW_PENDING_ID]?.length ?? 0).toBe(0)

    const findInstancesResponsePromise = waitForPortMessage<BrowserTypes.FindInstancesResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "findInstancesResponse",
    )

    await postDacpOnPort(
      appA.appPort,
      createFindInstancesMessage(appA.canonicalInstanceId, appA.appId, CHART_APP.appId),
    )

    const findInstancesResponse = await findInstancesResponsePromise
    const findInstancesIds =
      findInstancesResponse.payload.appIdentifiers?.map(identifier => identifier.instanceId) ?? []

    expect(findInstancesIds).toContain(NEW_PENDING_ID)
    expect(findInstancesIds).not.toContain(STALE_PENDING_ID)
  })
})

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
      data => (data as { type?: string }).type === "openResponse",
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        OPEN_WITH_CONTEXT_LAUNCH,
      ),
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
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appB.appPort,
      createGenericContextListenerMessage(appB.canonicalInstanceId, appB.appId),
    )

    const [broadcastEvent, openResponse] = await Promise.all([
      broadcastPromise,
      openResponsePromise,
    ])

    expect(broadcastEvent.type).toBe("broadcastEvent")
    const destination = (
      broadcastEvent.meta as BrowserTypes.BroadcastEventMeta & {
        destination?: { instanceId?: string }
      }
    ).destination
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
      createGenericContextListenerMessage(staleChart.canonicalInstanceId, staleChart.appId),
    )

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "open-with-context-stale-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const staleBroadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      staleChart.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
      500,
    ).catch(() => null)

    const openResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
      6000,
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        OPEN_WITH_CONTEXT_LAUNCH,
      ),
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
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      newChart.appPort,
      createGenericContextListenerMessage(newChart.canonicalInstanceId, newChart.appId),
    )

    const staleBroadcast = await staleBroadcastPromise
    const newBroadcast = await newBroadcastPromise
    const openResponse = await openResponsePromise

    expect(staleBroadcast).toBeNull()
    expect(newBroadcast.payload.context?.type).toBe(OPEN_WITH_CONTEXT_LAUNCH.type)
    expect(openResponse.payload.error).toBeUndefined()
  })
})

describe("open-with-context (first-connect WCP4)", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("delivers launch context when B first-connects without instanceUuid and adopts sole pending launcher id", async () => {
    const agent = createTestAgent({
      appLauncher: createHostInstanceAppLauncher(),
      openContextListenerTimeoutMs: 5000,
    })
    activeAgents.push(agent)

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "first-connect-open-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const openResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        OPEN_WITH_CONTEXT_LAUNCH,
      ),
    )

    await vi.waitFor(() => {
      expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length).toBe(1)
      expect(agent.getState().instances[HOST_LAUNCHER_INSTANCE_ID]?.appId).toBe(CHART_APP.appId)
    })

    const appB = await connectWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "first-connect-open-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    expect(appB.canonicalInstanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)

    const broadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      appB.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appB.appPort,
      createGenericContextListenerMessage(appB.canonicalInstanceId, appB.appId),
    )

    const [broadcastEvent, openResponse] = await Promise.all([
      broadcastPromise,
      openResponsePromise,
    ])

    expect(broadcastEvent.type).toBe("broadcastEvent")
    expect(broadcastEvent.payload.context?.type).toBe(OPEN_WITH_CONTEXT_LAUNCH.type)
    expect(openResponse.type).toBe("openResponse")
    expect(openResponse.payload.error).toBeUndefined()
    expect(openResponse.payload.appIdentifier?.instanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)
    expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length ?? 0).toBe(0)
  })

  it("delivers open-with-context when B listens only for fdc3.instrument", async () => {
    const agent = createTestAgent({
      appLauncher: createHostInstanceAppLauncher(),
      openContextListenerTimeoutMs: 5000,
    })
    activeAgents.push(agent)

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "first-connect-specific-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const openResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        INSTRUMENT_CONTEXT,
      ),
    )

    await vi.waitFor(() => {
      expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length).toBe(1)
    })

    const appB = await connectWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "first-connect-specific-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    expect(appB.canonicalInstanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)

    const broadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      appB.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appB.appPort,
      createAddContextListenerMessage(
        appB.canonicalInstanceId,
        appB.appId,
        null,
        INSTRUMENT_CONTEXT.type,
      ),
    )

    const [broadcastEvent, openResponse] = await Promise.all([
      broadcastPromise,
      openResponsePromise,
    ])

    expect(broadcastEvent.payload.context?.type).toBe(INSTRUMENT_CONTEXT.type)
    expect(openResponse.payload.error).toBeUndefined()
  })

  it("does not deliver to an instrument-only listener when open context is fdc3.country", async () => {
    const agent = createTestAgent({
      appLauncher: createHostInstanceAppLauncher(),
      openContextListenerTimeoutMs: 2000,
    })
    activeAgents.push(agent)

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "first-connect-wrong-type-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const openResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
      4000,
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        COUNTRY_CONTEXT,
      ),
    )

    await vi.waitFor(() => {
      expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length).toBe(1)
    })

    const appB = await connectWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "first-connect-wrong-type-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    const broadcastCollector = collectPortMessages<BrowserTypes.BroadcastEvent>(
      appB.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appB.appPort,
      createAddContextListenerMessage(
        appB.canonicalInstanceId,
        appB.appId,
        null,
        INSTRUMENT_CONTEXT.type,
      ),
    )

    const openResponse = await openResponsePromise

    broadcastCollector.stop()
    expect(broadcastCollector.messages).toHaveLength(0)
    expect(openResponse.payload.error).toBe(OpenError.AppTimeout)
  })

  it("delivers only to the matching listener when multiple context listeners are registered", async () => {
    const agent = createTestAgent({
      appLauncher: createHostInstanceAppLauncher(),
      openContextListenerTimeoutMs: 5000,
    })
    activeAgents.push(agent)

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "first-connect-multi-listen-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const openResponses: BrowserTypes.OpenResponse[] = []
    const openResponseCollector = collectPortMessages<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        INSTRUMENT_CONTEXT,
      ),
    )

    await vi.waitFor(() => {
      expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length).toBe(1)
    })

    const appB = await connectWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "first-connect-multi-listen-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    const broadcastCollector = collectPortMessages<BrowserTypes.BroadcastEvent>(
      appB.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appB.appPort,
      createAddContextListenerMessage(
        appB.canonicalInstanceId,
        appB.appId,
        null,
        COUNTRY_CONTEXT.type,
      ),
    )
    await postDacpOnPort(
      appB.appPort,
      createAddContextListenerMessage(
        appB.canonicalInstanceId,
        appB.appId,
        null,
        INSTRUMENT_CONTEXT.type,
      ),
    )

    await vi.waitFor(() => {
      expect(openResponseCollector.messages.length).toBeGreaterThanOrEqual(1)
      expect(broadcastCollector.messages.length).toBeGreaterThanOrEqual(1)
    })

    openResponseCollector.stop()
    broadcastCollector.stop()

    openResponses.push(...openResponseCollector.messages)

    expect(broadcastCollector.messages).toHaveLength(1)
    expect(broadcastCollector.messages[0]?.payload.context?.type).toBe(INSTRUMENT_CONTEXT.type)
    expect(openResponses.filter(response => response.payload.error === undefined)).toHaveLength(1)
    expect(openResponses.filter(response => response.payload.error !== undefined)).toHaveLength(0)
  })

  it("delivers when context listener is registered on temp routing id before WCP5 adoption completes", async () => {
    const agent = createTestAgent({
      appLauncher: createHostInstanceAppLauncher(),
      openContextListenerTimeoutMs: 5000,
    })
    activeAgents.push(agent)

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "first-connect-early-listener-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const openResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        OPEN_WITH_CONTEXT_LAUNCH,
      ),
    )

    await vi.waitFor(() => {
      expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length).toBe(1)
    })

    const session = beginWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "first-connect-early-listener-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    const broadcastCollector = collectPortMessages<BrowserTypes.BroadcastEvent>(
      session.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await session.postFirstConnectWcp4()

    await postDacpOnPort(
      session.appPort,
      createGenericContextListenerMessage(session.tempInstanceId, "chartApp"),
    )

    const appB = await session.completeFirstConnect()

    expect(appB.canonicalInstanceId).toBe(HOST_LAUNCHER_INSTANCE_ID)

    const openResponse = await openResponsePromise

    broadcastCollector.stop()

    await vi.waitFor(() => {
      expect(broadcastCollector.messages.length).toBeGreaterThanOrEqual(1)
    })

    const broadcastEvent = broadcastCollector.messages[0]

    expect(broadcastEvent.payload.context?.type).toBe(OPEN_WITH_CONTEXT_LAUNCH.type)
    expect(openResponse.payload.error).toBeUndefined()
    expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length ?? 0).toBe(0)
  })

  it("returns openResponse error when listener instance does not match pending launcher id", async () => {
    const agent = createTestAgent({
      appLauncher: createHostInstanceAppLauncher(),
      openContextListenerTimeoutMs: 2000,
    })
    activeAgents.push(agent)

    const appB = await connectWcpAppFirstConnect(agent, {
      connectionAttemptUuid: "first-connect-mismatch-target-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    expect(appB.canonicalInstanceId).not.toBe(HOST_LAUNCHER_INSTANCE_ID)

    await postDacpOnPort(
      appB.appPort,
      createAddContextListenerMessage(
        appB.canonicalInstanceId,
        appB.appId,
        null,
        INSTRUMENT_CONTEXT.type,
      ),
    )

    const appA = await connectWcpApp(agent, {
      connectionAttemptUuid: "first-connect-mismatch-source-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    const openResponsePromise = waitForPortMessage<BrowserTypes.OpenResponse>(
      appA.appPort,
      data => (data as { type?: string }).type === "openResponse",
      4000,
    )

    const broadcastCollector = collectPortMessages<BrowserTypes.BroadcastEvent>(
      appB.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appA.appPort,
      createOpenRequestMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHART_APP.appId,
        INSTRUMENT_CONTEXT,
      ),
    )

    const openResponse = await openResponsePromise

    broadcastCollector.stop()
    expect(broadcastCollector.messages).toHaveLength(0)
    expect(openResponse.payload.error).toBe(OpenError.AppTimeout)
    expect(agent.getState().open.pendingWithContext[HOST_LAUNCHER_INSTANCE_ID]?.length ?? 0).toBe(0)
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
    getTestConnector(agent).on("appConnected", appConnected)

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
      }),
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
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appA.appPort,
      createJoinUserChannelMessage(appA.canonicalInstanceId, appA.appId, CHANNEL_ID),
    )
    await postDacpOnPort(
      appA.appPort,
      createAddContextListenerMessage(
        appA.canonicalInstanceId,
        appA.appId,
        CHANNEL_ID,
        INSTRUMENT_CONTEXT.type,
      ),
    )

    await postDacpOnPort(
      appB.appPort,
      createJoinUserChannelMessage(appB.canonicalInstanceId, appB.appId, CHANNEL_ID),
    )
    await postDacpOnPort(
      appB.appPort,
      createBroadcastMessage(appB.canonicalInstanceId, appB.appId, CHANNEL_ID, INSTRUMENT_CONTEXT),
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
      createGetOrCreateChannelMessage(appA.canonicalInstanceId, appA.appId, appChannelId),
    )
    await postDacpOnPort(
      appB.appPort,
      createGetOrCreateChannelMessage(appB.canonicalInstanceId, appB.appId, appChannelId),
    )

    const broadcastPromise = waitForPortMessage<BrowserTypes.BroadcastEvent>(
      appA.appPort,
      data => (data as { type?: string }).type === "broadcastEvent",
    )

    await postDacpOnPort(
      appA.appPort,
      createAddContextListenerMessage(
        appA.canonicalInstanceId,
        appA.appId,
        appChannelId,
        INSTRUMENT_CONTEXT.type,
      ),
    )
    await postDacpOnPort(
      appB.appPort,
      createBroadcastMessage(
        appB.canonicalInstanceId,
        appB.appId,
        appChannelId,
        INSTRUMENT_CONTEXT,
      ),
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
      createOpenRequestMessage(source.canonicalInstanceId, source.appId, CHART_APP.appId),
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
    expect(getTestConnector(agent).getConnection(HOST_LAUNCHER_INSTANCE_ID)).toBeDefined()
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
      createOpenRequestMessage(source.canonicalInstanceId, source.appId, CHART_APP.appId),
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
      createAddEventListenerMessage(app.canonicalInstanceId, app.appId, "USER_CHANNEL_CHANGED"),
    )

    const channelChangedPromise = waitForChannelChangedEvent(app.appPort, CHANNEL_ID)

    await channels.changeAppChannel(app.canonicalInstanceId, CHANNEL_ID)

    const channelChangedEvent = await channelChangedPromise

    expect(channelChangedEvent.type).toBe("channelChangedEvent")
    expect(channelChangedEvent.payload.newChannelId).toBe(CHANNEL_ID)
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
      createAddEventListenerMessage(app.canonicalInstanceId, app.appId, "USER_CHANNEL_CHANGED"),
    )
    await postDacpOnPort(
      app.appPort,
      createJoinUserChannelMessage(app.canonicalInstanceId, app.appId, CHANNEL_ID),
    )

    await vi.waitFor(() => {
      expect(channels.getAppChannelId(app.canonicalInstanceId)).toBe(CHANNEL_ID)
    })

    const leavePromise = waitForChannelChangedEvent(app.appPort, null)

    await channels.changeAppChannel(app.canonicalInstanceId, null)

    const leaveEvent = await leavePromise

    expect(leaveEvent.type).toBe("channelChangedEvent")
    expect(leaveEvent.payload.newChannelId).toBeNull()
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
      createJoinUserChannelMessage(app.canonicalInstanceId, app.appId, CHANNEL_ID_2),
    )

    await vi.waitFor(() => {
      expect(channels.getAppChannelId(app.canonicalInstanceId)).toBe(CHANNEL_ID_2)
    })

    expect(channels.getAppChannel(app.canonicalInstanceId)).toMatchObject({
      id: CHANNEL_ID_2,
      type: "user",
    })
    expect(agent.getState().instances[app.canonicalInstanceId]?.currentUserChannel).toBe(
      CHANNEL_ID_2,
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
      createJoinUserChannelMessage(app.canonicalInstanceId, app.appId, CHANNEL_ID),
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

describe("browser apps controller (WCP integration)", () => {
  const activeAgents: DesktopAgent[] = []

  afterEach(() => {
    clearAllHeartbeatTimersForTesting()
    for (const agent of activeAgents.splice(0)) {
      agent.stop()
    }
  })

  it("notifies onConnect when WCP identity validation completes", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const apps = requireAppsController(agent)

    const connectEvents: AppConnectionMetadata[] = []
    apps.onConnect(metadata => {
      connectEvents.push(metadata)
    })

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "apps-on-connect-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(connectEvents).toEqual([
      expect.objectContaining({
        instanceId: connected.canonicalInstanceId,
        appId: "portfolioApp",
        connectionAttemptUuid: "apps-on-connect-uuid",
      }),
    ])
  })

  it("exposes connected instances and WCP connections after handshake", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const apps = requireAppsController(agent)

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "apps-connected-reads-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    expect(apps.getConnection(connected.canonicalInstanceId)).toMatchObject({
      instanceId: connected.canonicalInstanceId,
      appId: "portfolioApp",
    })
    expect(apps.getConnections()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: connected.canonicalInstanceId }),
      ]),
    )
    expect(apps.getInstance(connected.canonicalInstanceId)).toMatchObject({
      appId: "portfolioApp",
      instanceId: connected.canonicalInstanceId,
      status: "connected",
    })
    expect(apps.getInstances()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          appId: "portfolioApp",
          instanceId: connected.canonicalInstanceId,
          status: "connected",
        }),
      ]),
    )
    expect(agent.getState().instances[connected.canonicalInstanceId]?.state).toBe(
      AppInstanceState.CONNECTED,
    )
  })

  it("notifies onDisconnect and removes instance when disconnect is called", async () => {
    const agent = createTestAgent({
      heartbeatEnabled: false,
      disconnectGracePeriod: 0,
    })
    activeAgents.push(agent)
    const apps = requireAppsController(agent)

    const disconnectedIds: string[] = []
    apps.onDisconnect(instanceId => {
      disconnectedIds.push(instanceId)
    })

    const connected = await connectWcpApp(agent, {
      connectionAttemptUuid: "apps-disconnect-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    apps.disconnect(connected.canonicalInstanceId)

    expect(agent.getState().instances[connected.canonicalInstanceId]).toBeUndefined()
    expect(disconnectedIds).toContain(connected.canonicalInstanceId)
    expect(apps.getConnection(connected.canonicalInstanceId)).toBeUndefined()
  })

  it("notifies onHandshakeFailure when WCP handshake fails", () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const apps = requireAppsController(agent)

    const failures: HandshakeFailureEvent[] = []
    apps.onHandshakeFailure(event => {
      failures.push(event)
    })

    const originalMessageChannel = global.MessageChannel
    class FailingMessageChannel {
      constructor() {
        throw new Error("MessageChannel creation failed")
      }
    }
    global.MessageChannel = FailingMessageChannel as unknown as typeof MessageChannel

    window.dispatchEvent(
      createMessageEvent(createWCP1Hello("apps-handshake-fail-uuid", PORTFOLIO_APP.details.url)),
    )

    expect(failures).toHaveLength(1)
    expect(failures[0]?.error).toBeInstanceOf(Error)
    expect(failures[0]?.connectionAttemptUuid).toBe("apps-handshake-fail-uuid")

    global.MessageChannel = originalMessageChannel
  })

  it("stops delivering onConnect after unsubscribe", async () => {
    const agent = createTestAgent()
    activeAgents.push(agent)
    const apps = requireAppsController(agent)

    let notificationCount = 0
    const unsubscribe = apps.onConnect(() => {
      notificationCount += 1
    })

    await connectWcpApp(agent, {
      connectionAttemptUuid: "apps-unsub-first-uuid",
      appId: "portfolioApp",
      identityUrl: PORTFOLIO_APP.details.url,
    })

    await vi.waitFor(() => {
      expect(notificationCount).toBe(1)
    })

    unsubscribe()

    await connectWcpApp(agent, {
      connectionAttemptUuid: "apps-unsub-second-uuid",
      appId: "chartApp",
      identityUrl: CHART_APP.details.url,
    })

    await flushAsyncDelivery()

    expect(notificationCount).toBe(1)
  })
})
