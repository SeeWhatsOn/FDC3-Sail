/**
 * Characterization tests for pending-intent delivery and settlement.
 *
 * Written *before* slice 4' collapses `DACPHandlerContext.pendingIntentPromises` into
 * `AgentState`. They assert what the code does **today**, including where today's behaviour looks
 * wrong; every such case is marked `// CHARACTERIZATION:` so the post-collapse failing set is
 * exactly the intended delta and nothing else.
 *
 * The behaviour under the microscope: `delivered` is mutated through a **captured reference** to a
 * `Map` entry (`intent-delivery-helpers.ts:135`, `:179`) while `setState` **replaces** the state
 * tree. The captured entry outlives its own `Map.delete`, so the delivery-timeout callback still
 * reads `delivered` and `requestType` off an object no other code can reach. Moving `delivered`
 * and `requestType` into `state.intents.pending[requestId]` changes that.
 *
 * Timers: real `setTimeout` with Vitest fake timers (`vi.useFakeTimers`), same choice as
 * `pending-intent-settlement.test.ts`. Fake timers are what make the *ordering* between the
 * delivery timeout (`openContextListenerTimeoutMs`) and the pending-intent timeout
 * (`pendingIntentTimeoutMs`) controllable, which is the whole point of this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import type { BrowserTypes } from "@finos/fdc3"
import { ResolveError, ResultError } from "@finos/fdc3"

import { MockTransport } from "../../../__tests__/utils/mock-transport"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../agent/default-user-channels"
import { createInitialState } from "../../../state/initial-state"
import {
  addApp,
  addPendingIntent,
  connectInstance,
  registerIntentListener,
  updateInstanceState,
} from "../../../state/mutators"
import { AppInstanceState, type AgentState } from "../../../state/types"
import type { DACPHandlerContext } from "../../types"
import {
  createDACPTestContext,
  createDacpRequestMeta,
  withResponseDispatcher,
} from "../../__tests__/test-context"
import { cleanupInstanceDacpState } from "../../instance-teardown"
import {
  attemptIntentDelivery,
  deliverPendingIntentsForListener,
  queueIntentDelivery,
} from "../intent-delivery-helpers"
import {
  clearAllPendingIntentTimeoutsForTesting,
  getActivePendingIntentTimeoutCount,
} from "../intent-pending-timeout-registry"
import { handleRaiseIntentRequest } from "../intent-raise-intent"
import { handleRaiseIntentForContextRequest } from "../intent-raise-intent-for-context"

const RAISER_ID = "raiser-1"
const RAISER_APP_ID = "RaiserApp"
const TARGET_ID = "target-1"
const TARGET_APP_ID = "TargetApp"
const INTENT_NAME = "ViewPortfolio"
const CONTEXT_TYPE = "fdc3.portfolio"

type WireMessage = {
  type: string
  meta?: { requestUuid?: string; destination?: { instanceId?: string } }
  payload?: { error?: string; raiseIntentRequestUuid?: string }
}

beforeEach(() => {
  clearAllPendingIntentTimeoutsForTesting()
})

afterEach(() => {
  clearAllPendingIntentTimeoutsForTesting()
  vi.useRealTimers()
})

/**
 * A raiser and a target that is a legal explicit `app` target for `INTENT_NAME`.
 *
 * Defaults produce the **queued** delivery path: the target is `PENDING` with no intent listener,
 * so `shouldWaitForIntentListenerBeforeDelivery` returns true and `queueIntentDelivery` arms a
 * delivery timeout instead of sending. `withTargetListener` / `targetConnected` switch to the
 * immediate-delivery path.
 */
function setupScenario(
  options: {
    withTargetListener?: boolean
    targetConnected?: boolean
    openContextListenerTimeoutMs?: number
    pendingIntentTimeoutMs?: number
  } = {},
): { context: DACPHandlerContext; transport: MockTransport; getState: () => AgentState } {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId: RAISER_ID,
    appId: RAISER_APP_ID,
    metadata: { name: RAISER_APP_ID },
  })
  state = connectInstance(state, {
    instanceId: TARGET_ID,
    appId: TARGET_APP_ID,
    metadata: { name: TARGET_APP_ID },
  })
  state = updateInstanceState(state, RAISER_ID, AppInstanceState.CONNECTED)
  if (options.targetConnected) {
    state = updateInstanceState(state, TARGET_ID, AppInstanceState.CONNECTED)
  }
  if (options.withTargetListener) {
    state = registerIntentListener(state, {
      listenerId: "target-listener-1",
      intentName: INTENT_NAME,
      instanceId: TARGET_ID,
      appId: TARGET_APP_ID,
      contextTypes: [CONTEXT_TYPE],
    })
  }
  state = addApp(state, {
    appId: TARGET_APP_ID,
    title: TARGET_APP_ID,
    type: "web",
    details: { url: "https://example.com/target" },
    interop: {
      intents: {
        listensFor: {
          [INTENT_NAME]: { displayName: INTENT_NAME, contexts: [CONTEXT_TYPE] },
        },
      },
    },
  })

  const transport = new MockTransport()
  const { context: baseContext, getState } = createDACPTestContext({
    instanceId: RAISER_ID,
    initialState: state,
  })
  const context: DACPHandlerContext = {
    ...withResponseDispatcher(baseContext, transport),
    openContextListenerTimeoutMs: options.openContextListenerTimeoutMs ?? 2000,
    pendingIntentTimeoutMs: options.pendingIntentTimeoutMs ?? 2000,
  }
  return { context, transport, getState }
}

function messagesOfType(transport: MockTransport, type: string): WireMessage[] {
  return (transport.sentMessages as WireMessage[]).filter(message => message.type === type)
}

function buildRaiseIntentRequest(requestUuid: string): BrowserTypes.RaiseIntentRequest {
  return {
    type: "raiseIntentRequest",
    meta: createDacpRequestMeta(requestUuid, { appId: RAISER_APP_ID, instanceId: RAISER_ID }),
    payload: {
      intent: INTENT_NAME,
      context: { type: CONTEXT_TYPE },
      app: { appId: TARGET_APP_ID, instanceId: TARGET_ID },
    },
  }
}

function buildRaiseIntentForContextRequest(
  requestUuid: string,
): BrowserTypes.RaiseIntentForContextRequest {
  return {
    type: "raiseIntentForContextRequest",
    meta: createDacpRequestMeta(requestUuid, { appId: RAISER_APP_ID, instanceId: RAISER_ID }),
    payload: {
      context: { type: CONTEXT_TYPE },
      app: { appId: TARGET_APP_ID, instanceId: TARGET_ID },
    },
  }
}

// ============================================================================
// The delivery timeout vs the pending-intent timeout: which one fires first
// ============================================================================

describe("queueIntentDelivery: delivery timeout ordering against pending-intent settlement", () => {
  it("sends nothing and does not throw when the delivery timeout fires after the pending intent is already gone from state", async () => {
    vi.useFakeTimers()
    const requestUuid = "delivery-timeout-after-settlement"
    const { context, transport, getState } = setupScenario({
      pendingIntentTimeoutMs: 1000,
      openContextListenerTimeoutMs: 5000,
    })

    await handleRaiseIntentRequest(buildRaiseIntentRequest(requestUuid), context)

    // The queued path sends *nothing* to the raiser up front: `attemptIntentDelivery` returns
    // false before reaching any `sendDACPResponse`, so there is no early raiseIntentResponse.
    expect(messagesOfType(transport, "raiseIntentResponse")).toHaveLength(0)
    expect(messagesOfType(transport, "intentEvent")).toHaveLength(0)
    expect(getState().intents.pending[requestUuid]).toBeDefined()

    // t=1000 — pendingIntentTimeoutMs elapses first. `attachPendingIntentTimeout` deletes the
    // pendingIntentPromises entry, resolves the pending intent out of state, and settles the
    // raiser with a terminal raiseIntentResultResponse. It does NOT clear deliveryTimeoutHandle.
    await vi.advanceTimersByTimeAsync(1000)

    const settlement = messagesOfType(transport, "raiseIntentResultResponse")
    expect(settlement).toHaveLength(1)
    expect(settlement[0].payload?.error).toBe(ResultError.ApiTimeout)
    expect(settlement[0].meta?.destination?.instanceId).toBe(RAISER_ID)
    expect(getState().intents.pending[requestUuid]).toBeUndefined()

    // The delivery timeout is still armed: settling the pending intent did not cancel it.
    expect(getActivePendingIntentTimeoutCount()).toBe(1)

    const messageCountAfterSettlement = transport.sentMessages.length

    // t=5000 — the delivery timeout now fires against a state tree with no pending entry.
    // CHARACTERIZATION: the `if (deliveryEntry.delivered)` guard at intent-delivery-helpers.ts:158
    // does NOT stop it (the captured entry is still `delivered === undefined`), the error response
    // at :162 IS constructed, but `getPendingIntent` at :169 returns undefined so the
    // `if (pendingIntent)` guard at :170 suppresses both the send and the setState. The final
    // `deliveryEntry.delivered = true` at :179 then writes to a Map entry that was deleted at
    // t=1000 — an object no other code can reach. Net effect today: a silent no-op.
    // Not a double-delivery, and not a throw.
    await vi.advanceTimersByTimeAsync(4000)

    // Proof the callback ran rather than being cancelled: `releasePendingIntentTimeoutHandle` is
    // the first statement inside it, so a zero count here means the body executed.
    expect(getActivePendingIntentTimeoutCount()).toBe(0)
    expect(transport.sentMessages).toHaveLength(messageCountAfterSettlement)
    expect(messagesOfType(transport, "raiseIntentResponse")).toHaveLength(0)
    expect(messagesOfType(transport, "raiseIntentResultResponse")).toHaveLength(1)
    expect(messagesOfType(transport, "intentEvent")).toHaveLength(0)
    // The settled request must stay settled: the late `delivered` write must not resurrect a
    // pending entry under the same requestId.
    expect(getState().intents.pending[requestUuid]).toBeUndefined()
    expect(Object.keys(getState().intents.pending)).toHaveLength(0)
  })

  it("settles the raiser with IntentDeliveryFailed when the delivery timeout fires while the pending intent is still in state", async () => {
    vi.useFakeTimers()
    const requestUuid = "delivery-timeout-before-settlement"
    const { context, transport, getState } = setupScenario({
      openContextListenerTimeoutMs: 1000,
      pendingIntentTimeoutMs: 5000,
    })

    await handleRaiseIntentRequest(buildRaiseIntentRequest(requestUuid), context)
    expect(getState().intents.pending[requestUuid]).toBeDefined()

    // t=1000 — the delivery timeout wins the race. `requestType` is read off the captured entry at
    // :161 (before the state lookup at :169), so the response type is raiseIntentResponse.
    await vi.advanceTimersByTimeAsync(1000)

    const failures = messagesOfType(transport, "raiseIntentResponse")
    expect(failures).toHaveLength(1)
    expect(failures[0].payload?.error).toBe(ResolveError.IntentDeliveryFailed)
    expect(failures[0].meta?.requestUuid).toBe(requestUuid)
    expect(failures[0].meta?.destination?.instanceId).toBe(RAISER_ID)
    expect(getState().intents.pending[requestUuid]).toBeUndefined()
    expect(messagesOfType(transport, "intentEvent")).toHaveLength(0)

    // Only the pending-intent timeout is left armed; the delivery timeout released itself.
    expect(getActivePendingIntentTimeoutCount()).toBe(1)

    const messageCountAfterDeliveryTimeout = transport.sentMessages.length

    // t=5000 — the pending-intent timeout still fires (the delivery-timeout path never deletes the
    // pendingIntentPromises entry, so `has(requestId)` at intent-raise-shared.ts:168 is still
    // true), but `getPendingIntent` is now undefined so no second terminal response is sent.
    // CHARACTERIZATION: exactly one settlement reaches the raiser, never two.
    await vi.advanceTimersByTimeAsync(4000)

    expect(getActivePendingIntentTimeoutCount()).toBe(0)
    expect(transport.sentMessages).toHaveLength(messageCountAfterDeliveryTimeout)
    expect(messagesOfType(transport, "raiseIntentResultResponse")).toHaveLength(0)
    expect(Object.keys(getState().intents.pending)).toHaveLength(0)
  })

  it("uses raiseIntentForContextResponse on the delivery-timeout path for a raiseIntentForContextRequest", async () => {
    vi.useFakeTimers()
    const requestUuid = "for-context-delivery-timeout"
    const { context, transport, getState } = setupScenario({
      openContextListenerTimeoutMs: 1000,
      pendingIntentTimeoutMs: 5000,
    })

    await handleRaiseIntentForContextRequest(
      buildRaiseIntentForContextRequest(requestUuid),
      context,
    )
    expect(getState().intents.pending[requestUuid]).toBeDefined()

    await vi.advanceTimersByTimeAsync(1000)

    // `registerPendingIntentPromise` stored requestType "raiseIntentForContextRequest", and the
    // delivery-timeout callback maps it through `getResponseTypeForRequest`.
    const failures = messagesOfType(transport, "raiseIntentForContextResponse")
    expect(failures).toHaveLength(1)
    expect(failures[0].payload?.error).toBe(ResolveError.IntentDeliveryFailed)
    expect(failures[0].meta?.destination?.instanceId).toBe(RAISER_ID)
    expect(messagesOfType(transport, "raiseIntentResponse")).toHaveLength(0)
    expect(getState().intents.pending[requestUuid]).toBeUndefined()
  })
})

// ============================================================================
// `delivered` as the sole double-delivery guard
// ============================================================================

describe("attemptIntentDelivery: the delivered flag", () => {
  it("delivers once and re-sends nothing on a second attempt for the same request", async () => {
    const requestUuid = "deliver-once"
    const { context, transport, getState } = setupScenario({
      withTargetListener: true,
      targetConnected: true,
    })

    await handleRaiseIntentRequest(buildRaiseIntentRequest(requestUuid), context)

    const intentEvents = messagesOfType(transport, "intentEvent")
    expect(intentEvents).toHaveLength(1)
    expect(intentEvents[0].meta?.destination?.instanceId).toBe(TARGET_ID)
    expect(messagesOfType(transport, "raiseIntentResponse")).toHaveLength(1)
    // Delivery does not resolve the pending intent — it stays until an intentResultRequest.
    expect(getState().intents.pending[requestUuid]).toBeDefined()

    const messageCountAfterDelivery = transport.sentMessages.length

    // The `deliveryEntry?.delivered` early return at intent-delivery-helpers.ts:53 is what makes
    // this a no-op; it returns true (meaning "nothing left to do"), not false.
    expect(attemptIntentDelivery(context, requestUuid, false)).toBe(true)
    expect(transport.sentMessages).toHaveLength(messageCountAfterDelivery)
  })

  it("reports success without sending when the request has no pending intent in state", () => {
    const { context, transport } = setupScenario({ targetConnected: true })

    expect(attemptIntentDelivery(context, "no-such-request", false)).toBe(true)
    expect(transport.sentMessages).toHaveLength(0)
  })

  // CHARACTERIZATION: `delivered` lives only on the pendingIntentPromises entry, so a pending
  // intent that exists in state with no Map entry has NO double-delivery guard at all — every call
  // re-sends the intentEvent and a fresh success raiseIntentResponse. This asymmetry is only
  // reachable because the two stores are populated independently; once `delivered` moves onto
  // `state.intents.pending[requestId]` the two can no longer disagree.
  it("re-sends on every call when the pending intent exists in state but has no pendingIntentPromises entry", () => {
    const requestUuid = "state-only-pending-intent"
    const { context, transport } = setupScenario({
      withTargetListener: true,
      targetConnected: true,
    })

    context.setState(state =>
      addPendingIntent(state, {
        requestId: requestUuid,
        intentName: INTENT_NAME,
        context: { type: CONTEXT_TYPE },
        sourceInstanceId: RAISER_ID,
        targetInstanceId: TARGET_ID,
        targetAppId: TARGET_APP_ID,
      }),
    )

    expect(attemptIntentDelivery(context, requestUuid, false)).toBe(true)
    expect(attemptIntentDelivery(context, requestUuid, false)).toBe(true)

    expect(messagesOfType(transport, "intentEvent")).toHaveLength(2)
    expect(messagesOfType(transport, "raiseIntentResponse")).toHaveLength(2)
  })

  // CHARACTERIZATION: `queueIntentDelivery` bails at intent-delivery-helpers.ts:147 when there is
  // no Map entry — it neither attempts delivery nor arms a delivery timeout, even though the
  // pending intent is present in state and the target has no listener. The raiser is left with no
  // response from this path at all.
  it("arms no delivery timeout and sends nothing when there is no pendingIntentPromises entry", () => {
    const requestUuid = "queue-without-entry"
    const { context, transport } = setupScenario()

    context.setState(state =>
      addPendingIntent(state, {
        requestId: requestUuid,
        intentName: INTENT_NAME,
        context: { type: CONTEXT_TYPE },
        sourceInstanceId: RAISER_ID,
        targetInstanceId: TARGET_ID,
        targetAppId: TARGET_APP_ID,
      }),
    )

    queueIntentDelivery(context, requestUuid, true)

    expect(getActivePendingIntentTimeoutCount()).toBe(0)
    expect(transport.sentMessages).toHaveLength(0)
  })
})

describe("deliverPendingIntentsForListener", () => {
  it("skips a pending intent that was already delivered", async () => {
    const requestUuid = "already-delivered"
    const { context, transport } = setupScenario({
      withTargetListener: true,
      targetConnected: true,
    })

    await handleRaiseIntentRequest(buildRaiseIntentRequest(requestUuid), context)
    expect(messagesOfType(transport, "intentEvent")).toHaveLength(1)

    const messageCountAfterDelivery = transport.sentMessages.length

    // A second listener registration for the same intent re-runs the sweep from the target's
    // perspective. The `deliveryEntry?.delivered` check at intent-delivery-helpers.ts:201 is the
    // only thing stopping a duplicate intentEvent.
    deliverPendingIntentsForListener({ ...context, instanceId: TARGET_ID }, INTENT_NAME)

    expect(transport.sentMessages).toHaveLength(messageCountAfterDelivery)
    expect(messagesOfType(transport, "intentEvent")).toHaveLength(1)
  })

  it("delivers a queued pending intent once the target registers its listener", async () => {
    vi.useFakeTimers()
    const requestUuid = "queued-then-listener"
    const { context, transport, getState } = setupScenario({
      targetConnected: true,
      openContextListenerTimeoutMs: 5000,
      pendingIntentTimeoutMs: 60_000,
    })

    await handleRaiseIntentRequest(buildRaiseIntentRequest(requestUuid), context)
    expect(messagesOfType(transport, "intentEvent")).toHaveLength(0)

    context.setState(state =>
      registerIntentListener(state, {
        listenerId: "late-listener-1",
        intentName: INTENT_NAME,
        instanceId: TARGET_ID,
        appId: TARGET_APP_ID,
        contextTypes: [CONTEXT_TYPE],
      }),
    )
    deliverPendingIntentsForListener({ ...context, instanceId: TARGET_ID }, INTENT_NAME)

    expect(messagesOfType(transport, "intentEvent")).toHaveLength(1)
    expect(messagesOfType(transport, "raiseIntentResponse")).toHaveLength(1)
    expect(messagesOfType(transport, "raiseIntentResponse")[0].payload?.error).toBeUndefined()
    expect(getState().intents.pending[requestUuid]).toBeDefined()

    const messageCountAfterDelivery = transport.sentMessages.length

    // Successful delivery clears deliveryTimeoutHandle at intent-delivery-helpers.ts:131-133, so
    // the delivery timeout never fires and never sends a contradicting IntentDeliveryFailed.
    await vi.advanceTimersByTimeAsync(5000)

    expect(transport.sentMessages).toHaveLength(messageCountAfterDelivery)
    expect(messagesOfType(transport, "raiseIntentResponse")).toHaveLength(1)
  })
})

// ============================================================================
// Settlement on disconnect (the paths added by 8a62fd386 / 20515fdbf)
// ============================================================================

describe("cleanupInstanceDacpState: pending-intent settlement on disconnect", () => {
  it("settles the raiser with a terminal raiseIntentResultResponse when the target disconnects mid-flight", async () => {
    const requestUuid = "target-disconnect-settles-raiser"
    const { context, transport, getState } = setupScenario({
      withTargetListener: true,
      targetConnected: true,
    })

    await handleRaiseIntentRequest(buildRaiseIntentRequest(requestUuid), context)
    expect(getState().intents.pending[requestUuid]).toBeDefined()

    cleanupInstanceDacpState({ ...context, instanceId: TARGET_ID })

    const settlement = messagesOfType(transport, "raiseIntentResultResponse")
    expect(settlement).toHaveLength(1)
    expect(settlement[0].payload?.error).toBe(ResultError.ApiTimeout)
    expect(settlement[0].meta?.requestUuid).toBe(requestUuid)
    expect(settlement[0].meta?.destination?.instanceId).toBe(RAISER_ID)
    expect(getState().intents.pending[requestUuid]).toBeUndefined()
  })

  it("posts no terminal response when the raiser itself is the disconnecting instance", async () => {
    const requestUuid = "raiser-disconnect-posts-nothing"
    const { context, transport, getState } = setupScenario({
      withTargetListener: true,
      targetConnected: true,
    })

    await handleRaiseIntentRequest(buildRaiseIntentRequest(requestUuid), context)
    expect(getState().intents.pending[requestUuid]).toBeDefined()

    // 20515fdbf: the terminal response is addressed to `pending.sourceInstanceId`, so sending it
    // when the source is the one going away posts to a just-closed instance for a promise nobody
    // is awaiting. The guard is `pending.sourceInstanceId !== instanceId`.
    cleanupInstanceDacpState({ ...context, instanceId: RAISER_ID })

    expect(messagesOfType(transport, "raiseIntentResultResponse")).toHaveLength(0)
    expect(getState().intents.pending[requestUuid]).toBeUndefined()
  })

  it("clears the armed delivery timeout when the target disconnects while delivery is still queued", async () => {
    vi.useFakeTimers()
    const requestUuid = "disconnect-while-queued"
    const { context, transport, getState } = setupScenario({
      openContextListenerTimeoutMs: 5000,
      pendingIntentTimeoutMs: 60_000,
    })

    await handleRaiseIntentRequest(buildRaiseIntentRequest(requestUuid), context)
    expect(getActivePendingIntentTimeoutCount()).toBe(2)

    cleanupInstanceDacpState({ ...context, instanceId: TARGET_ID })

    // `cleanupInstanceDacpState` clears both handles off the Map entry before deleting it, so no
    // pending-intent timer survives the teardown.
    expect(getActivePendingIntentTimeoutCount()).toBe(0)
    expect(messagesOfType(transport, "raiseIntentResultResponse")).toHaveLength(1)
    expect(getState().intents.pending[requestUuid]).toBeUndefined()

    const messageCountAfterTeardown = transport.sentMessages.length

    await vi.advanceTimersByTimeAsync(60_000)

    expect(transport.sentMessages).toHaveLength(messageCountAfterTeardown)
    expect(messagesOfType(transport, "raiseIntentResponse")).toHaveLength(0)
  })
})
