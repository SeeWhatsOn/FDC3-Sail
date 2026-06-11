import { describe, expect, it, afterEach } from "vitest"
import type { BrowserTypes } from "@finos/fdc3"
import { connectInstance, updateInstanceState } from "../../../../state/mutators"
import { AppInstanceState } from "../../../../state/types"
import { createInitialState } from "../../../../state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../../default-user-channels"
import { createDACPTestContext } from "../../__tests__/test-context"
import { resolveContextListenerInstanceId } from "../resolve-context-listener-instance-id"
import { linkWcpTempInstanceId, clearAllHeartbeatTimersForTesting } from "../../heartbeat-runtime"

const CHART_APP_ID = "chartApp"

afterEach(() => {
  clearAllHeartbeatTimersForTesting()
})

describe("resolveContextListenerInstanceId", () => {
  it("routes temp WCP connection id to host launcher placeholder instance", () => {
    const hostInstanceId = "launcher-instance-id"
    const tempInstanceId = "temp-wcp-handshake"
    const initialState = connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
      instanceId: hostInstanceId,
      appId: CHART_APP_ID,
      metadata: { appId: CHART_APP_ID, name: CHART_APP_ID },
    })

    const { context } = createDACPTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    const message = {
      type: "addContextListenerRequest",
      meta: {
        requestUuid: "listener-1",
        timestamp: new Date(),
        hostInstanceId,
        source: { appId: CHART_APP_ID, instanceId: tempInstanceId },
      },
      payload: { channelId: null, contextType: "*" },
    } as BrowserTypes.AddContextListenerRequest

    expect(resolveContextListenerInstanceId(message, context)).toBe(hostInstanceId)
  })

  it("routes temp id to linked canonical instance after WCP4 heartbeat mapping", () => {
    const canonicalInstanceId = "canonical-wcp5-id"
    const tempInstanceId = "temp-linked-handshake"
    linkWcpTempInstanceId(tempInstanceId, canonicalInstanceId)

    const initialState = connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
      instanceId: canonicalInstanceId,
      appId: CHART_APP_ID,
      metadata: { appId: CHART_APP_ID, name: CHART_APP_ID },
    })

    const { context } = createDACPTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    const message = {
      type: "addContextListenerRequest",
      meta: {
        requestUuid: "listener-2",
        timestamp: new Date(),
        source: { appId: CHART_APP_ID, instanceId: tempInstanceId },
      },
      payload: { channelId: null, contextType: "fdc3.instrument" },
    } as BrowserTypes.AddContextListenerRequest

    expect(resolveContextListenerInstanceId(message, context)).toBe(canonicalInstanceId)
  })

  it("routes a stale source id to the only connected instance for that app", () => {
    const staleInstanceId = "stale-conformance-instance"
    const liveInstanceId = "live-conformance-instance"
    const appId = "Conformance1"
    const initialState = updateInstanceState(
      connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
        instanceId: liveInstanceId,
        appId,
        metadata: { appId, name: appId },
      }),
      liveInstanceId,
      AppInstanceState.CONNECTED
    )

    const { context } = createDACPTestContext({
      instanceId: staleInstanceId,
      initialState,
    })

    const message = {
      type: "addContextListenerRequest",
      meta: {
        requestUuid: "listener-stale-source",
        timestamp: new Date(),
        source: { appId, instanceId: staleInstanceId },
      },
      payload: { channelId: "app-control", contextType: "windowClosed" },
    } as BrowserTypes.AddContextListenerRequest

    expect(resolveContextListenerInstanceId(message, context)).toBe(liveInstanceId)
  })

  it("does not guess a stale source id when multiple connected instances share the appId", () => {
    const staleInstanceId = "stale-conformance-instance"
    const appId = "Conformance1"
    const withFirst = updateInstanceState(
      connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
        instanceId: "live-conformance-one",
        appId,
        metadata: { appId, name: appId },
      }),
      "live-conformance-one",
      AppInstanceState.CONNECTED
    )
    const initialState = updateInstanceState(
      connectInstance(withFirst, {
        instanceId: "live-conformance-two",
        appId,
        metadata: { appId, name: appId },
      }),
      "live-conformance-two",
      AppInstanceState.CONNECTED
    )

    const { context } = createDACPTestContext({
      instanceId: staleInstanceId,
      initialState,
    })

    const message = {
      type: "addContextListenerRequest",
      meta: {
        requestUuid: "listener-ambiguous-stale-source",
        timestamp: new Date(),
        source: { appId, instanceId: staleInstanceId },
      },
      payload: { channelId: "app-control", contextType: "windowClosed" },
    } as BrowserTypes.AddContextListenerRequest

    expect(resolveContextListenerInstanceId(message, context)).toBe(staleInstanceId)
  })
})
