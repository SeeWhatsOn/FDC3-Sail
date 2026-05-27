import { afterEach, describe, expect, it, vi } from "vitest"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { cleanupDACPHandlers } from "../cleanup"
import { startHeartbeat } from "../heartbeat-handlers"
import { handleWCP6Goodbye } from "../wcp-handlers"
import {
  clearAllHeartbeatTimersForTesting,
  getActiveHeartbeatTimerCount,
} from "../heartbeat-runtime"
import { registerOpenWithContext } from "../utils/open-with-context"
import {
  clearAllPendingOpenWithContextTimeoutsForTesting,
  getPendingOpenWithContextTimeoutCount,
} from "../utils/open-with-context"
import { connectInstance, addPendingIntent, updateInstanceState } from "../../../state/mutators"
import { AppInstanceState, type AgentState } from "../../../state/types"
import { createInitialState } from "../../../state/initial-state"
import type { PendingIntentPromiseEntry } from "../../types"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { createDACPTestContext } from "./test-context"
import { DesktopAgent } from "../../../desktop-agent"
import { AppDirectoryManager } from "../../../app-directory/app-directory-manager"
import { MockTransport } from "../../../../__tests__/utils/mock-transport"

afterEach(() => {
  clearAllPendingOpenWithContextTimeoutsForTesting()
  clearAllHeartbeatTimersForTesting()
  vi.useRealTimers()
})

function connectTestInstance(instanceId: string): AgentState {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId,
    appId: "TestApp",
    metadata: { appId: "TestApp", name: "TestApp" },
  })
  return updateInstanceState(state, instanceId, AppInstanceState.CONNECTED)
}

function createHeartbeatTestContext(options: Parameters<typeof createDACPTestContext>[0]) {
  const { context, getState } = createDACPTestContext(options)
  return {
    context: { ...context, transport: new MockTransport() },
    getState,
  }
}

function expectHeartbeatFullyCleared(getState: () => AgentState, instanceId: string): void {
  expect(getActiveHeartbeatTimerCount()).toBe(0)
  expect(getState().heartbeats[instanceId]).toBeUndefined()
}

describe("cleanupDACPHandlers", () => {
  it("clears pending intents and promise state when the raising instance disconnects", () => {
    const pendingIntentPromises = new Map<string, PendingIntentPromiseEntry>()
    const reject = vi.fn()
    const timeoutHandle = setTimeout(() => {}, 60_000)
    pendingIntentPromises.set("req-source-disconnect", {
      resolve: vi.fn(),
      reject,
      timeoutHandle,
      requestType: "raiseIntentRequest",
    })

    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "a1",
      appId: "App1",
      metadata: { appId: "App1", name: "App1" },
    })
    state = connectInstance(state, {
      instanceId: "l1",
      appId: "portfolioApp",
      metadata: { appId: "portfolioApp", name: "portfolioApp" },
    })
    state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)
    state = updateInstanceState(state, "l1", AppInstanceState.CONNECTED)
    state = addPendingIntent(state, {
      requestId: "req-source-disconnect",
      intentName: "ViewPortfolio",
      context: { type: "fdc3.portfolio" } as Context,
      sourceInstanceId: "a1",
      targetInstanceId: "l1",
      targetAppId: "portfolioApp",
    })

    const { context, getState } = createDACPTestContext({
      instanceId: "a1",
      pendingIntentPromises,
      initialState: state,
    })

    cleanupDACPHandlers(context)

    expect(Object.keys(getState().intents.pending)).toHaveLength(0)
    expect(pendingIntentPromises.has("req-source-disconnect")).toBe(false)
    expect(reject).toHaveBeenCalledOnce()
  })

  it("clears pending intents when the target instance disconnects", () => {
    const pendingIntentPromises = new Map<string, PendingIntentPromiseEntry>()
    const reject = vi.fn()
    pendingIntentPromises.set("req-target-disconnect", {
      resolve: vi.fn(),
      reject,
      requestType: "raiseIntentRequest",
    })

    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "a1",
      appId: "App1",
      metadata: { appId: "App1", name: "App1" },
    })
    state = connectInstance(state, {
      instanceId: "l1",
      appId: "portfolioApp",
      metadata: { appId: "portfolioApp", name: "portfolioApp" },
    })
    state = addPendingIntent(state, {
      requestId: "req-target-disconnect",
      intentName: "ViewPortfolio",
      context: { type: "fdc3.portfolio" } as Context,
      sourceInstanceId: "a1",
      targetInstanceId: "l1",
      targetAppId: "portfolioApp",
    })

    const { context, getState } = createDACPTestContext({
      instanceId: "l1",
      pendingIntentPromises,
      initialState: state,
    })

    cleanupDACPHandlers(context)

    expect(Object.keys(getState().intents.pending)).toHaveLength(0)
    expect(pendingIntentPromises.has("req-target-disconnect")).toBe(false)
    expect(reject).toHaveBeenCalledOnce()
  })

  it("clears open-with-context pending state and timeouts when the target instance disconnects", () => {
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    state = connectInstance(state, {
      instanceId: "a1",
      appId: "portfolioApp",
      metadata: { appId: "portfolioApp", name: "portfolioApp" },
    })
    state = updateInstanceState(state, "a1", AppInstanceState.CONNECTED)

    const { context, getState } = createDACPTestContext({
      instanceId: "a1",
      initialState: state,
    })

    const launchContext: Context = {
      type: "fdc3.instrument",
      id: { ticker: "AAPL" },
    }

    const message = {
      type: "openRequest",
      meta: {
        requestUuid: "open-req-1",
        timestamp: new Date(),
      },
      payload: {
        app: { appId: "chartApp", instanceId: "uuid-0" },
        context: launchContext,
      },
    } as BrowserTypes.OpenRequest

    registerOpenWithContext(
      message,
      { appId: "chartApp", instanceId: "uuid-0" },
      launchContext,
      context
    )

    expect(getState().open.pendingWithContext["uuid-0"]?.length).toBe(1)
    expect(getPendingOpenWithContextTimeoutCount()).toBe(1)

    cleanupDACPHandlers({ ...context, instanceId: "uuid-0" })

    expect(getState().open.pendingWithContext["uuid-0"]).toBeUndefined()
    expect(getPendingOpenWithContextTimeoutCount()).toBe(0)
  })
})

describe("heartbeat cleanup on disconnect", () => {
  it("cleanupDACPHandlers clears active heartbeat interval and state entry", () => {
    const instanceId = "instance-cleanup-dacp"
    const initialState = connectTestInstance(instanceId)
    const { context, getState } = createHeartbeatTestContext({ instanceId, initialState })

    startHeartbeat(instanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[instanceId]).toBeDefined()

    cleanupDACPHandlers(context)

    expectHeartbeatFullyCleared(getState, instanceId)
  })

  it("handleWCP6Goodbye clears active heartbeat interval and state entry", () => {
    const instanceId = "instance-wcp6-goodbye"
    const initialState = connectTestInstance(instanceId)
    const { context, getState } = createHeartbeatTestContext({ instanceId, initialState })

    startHeartbeat(instanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[instanceId]).toBeDefined()

    handleWCP6Goodbye({}, context)

    expectHeartbeatFullyCleared(getState, instanceId)
  })

  it("heartbeat timeout clears active heartbeat interval and state entry", () => {
    vi.useFakeTimers()
    const instanceId = "instance-heartbeat-timeout"
    const initialState = connectTestInstance(instanceId)
    const { context, getState } = createHeartbeatTestContext({ instanceId, initialState })

    startHeartbeat(instanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[instanceId]).toBeDefined()

    vi.advanceTimersByTime(2500)

    expectHeartbeatFullyCleared(getState, instanceId)
  })

  it("DesktopAgent.disconnectInstance clears active heartbeat interval and state entry", async () => {
    const appDirectory = new AppDirectoryManager()
    appDirectory.addApplications([
      {
        appId: "test-app",
        title: "Test App",
        type: "web",
        details: { url: "https://example.com/app" },
      },
    ])
    const transport = new MockTransport()
    const agent = new DesktopAgent({
      transport,
      appDirectoryManager: appDirectory,
      heartbeatIntervalMs: 500,
      heartbeatTimeoutMs: 2000,
    })
    agent.start()

    const wcp4Message = {
      type: "WCP4ValidateAppIdentity",
      payload: {
        identityUrl: "https://example.com/app",
        actualUrl: "https://example.com/app",
      },
      meta: {
        connectionAttemptUuid: "heartbeat-disconnect-uuid",
        timestamp: new Date().toISOString(),
        messageOrigin: "https://example.com",
      },
    } as unknown as BrowserTypes.WebConnectionProtocol4ValidateAppIdentity

    await transport.receiveMessage(wcp4Message)

    const wcp5Response = transport.sentMessages.find(
      message => (message as { type?: string }).type === "WCP5ValidateAppIdentityResponse"
    ) as { payload?: { instanceId?: string } } | undefined
    const canonicalInstanceId = wcp5Response?.payload?.instanceId
    expect(canonicalInstanceId).toBeDefined()

    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(agent.getState().heartbeats[canonicalInstanceId!]).toBeDefined()

    agent.disconnectInstance(canonicalInstanceId!)

    expectHeartbeatFullyCleared(() => agent.getState(), canonicalInstanceId!)
  })

  it("stops heartbeat on canonical instanceId when cleanup runs from WCP4 temp context", () => {
    const tempInstanceId = "temp-wcp4-attempt"
    const canonicalInstanceId = "canonical-wcp5-instance"
    const initialState = connectTestInstance(canonicalInstanceId)
    const { context, getState } = createHeartbeatTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    startHeartbeat(canonicalInstanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[canonicalInstanceId]).toBeDefined()

    handleWCP6Goodbye({}, context)

    expectHeartbeatFullyCleared(getState, canonicalInstanceId)
  })

  it("heartbeat timeout stops heartbeat on canonical instanceId when WCP4 temp context was used", () => {
    vi.useFakeTimers()
    const tempInstanceId = "temp-wcp4-timeout"
    const canonicalInstanceId = "canonical-wcp5-timeout"
    const initialState = connectTestInstance(canonicalInstanceId)
    const { context, getState } = createHeartbeatTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    startHeartbeat(canonicalInstanceId, context)
    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(getState().heartbeats[canonicalInstanceId]).toBeDefined()

    vi.advanceTimersByTime(2500)

    expectHeartbeatFullyCleared(getState, canonicalInstanceId)
  })
})
