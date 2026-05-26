import { afterEach, describe, expect, it, vi } from "vitest"
import type { BrowserTypes, Context } from "@finos/fdc3"
import { cleanupDACPHandlers } from "../cleanup"
import { registerOpenWithContext } from "../utils/open-with-context"
import {
  clearAllPendingOpenWithContextTimeoutsForTesting,
  getPendingOpenWithContextTimeoutCount,
} from "../utils/open-with-context"
import { connectInstance, addPendingIntent, updateInstanceState } from "../../../state/mutators"
import { AppInstanceState } from "../../../state/types"
import { createInitialState } from "../../../state/initial-state"
import type { PendingIntentPromiseEntry } from "../../types"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { createDACPTestContext } from "./test-context"

afterEach(() => {
  clearAllPendingOpenWithContextTimeoutsForTesting()
})

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
