/**
 * Contract: AppInstance carries no intent listener denormalization;
 * AppInstanceState exposes only PENDING and CONNECTED (disconnect = absent instance).
 */
import { describe, expect, it } from "vitest"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../default-user-channels"
import { createInitialState } from "../initial-state"
import { connectInstance, removeInstance } from "../mutators/instance"
import { registerIntentListener } from "../mutators/intent"
import * as stateMutators from "../mutators/index"
import * as stateSelectors from "../selectors/index"
import { getInstance } from "../selectors/instance"
import { AppInstanceState, type AppInstance } from "../types"

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

/** Compile-time contract (fails `tsc` when denormalized fields remain). */
const _appInstanceTypeContract = {
  noIntentListenersField: true as Expect<
    Equals<"intentListeners" extends keyof AppInstance ? false : true, true>
  >,
  onlyPendingAndConnectedStates: true as Expect<
    Equals<
      (typeof AppInstanceState)[keyof typeof AppInstanceState],
      AppInstanceState.PENDING | AppInstanceState.CONNECTED
    >
  >,
}
void _appInstanceTypeContract

const FORBIDDEN_INSTANCE_MUTATOR_EXPORTS = ["addIntentListener", "removeIntentListener"] as const

const FORBIDDEN_INSTANCE_SELECTOR_EXPORTS = ["getInstancesWithIntentListener"] as const

function assertNoForbiddenExports(
  moduleExports: Record<string, unknown>,
  moduleName: string,
  forbiddenExports: readonly string[]
): void {
  for (const exportName of forbiddenExports) {
    expect(
      Object.prototype.hasOwnProperty.call(moduleExports, exportName),
      `${moduleName} must not export ${exportName}`
    ).toBe(false)
  }
}

describe("AppInstance shape contract", () => {
  it("AppInstanceState enum exposes only PENDING and CONNECTED", () => {
    expect(Object.values(AppInstanceState).sort()).toEqual(["connected", "pending"])
  })

  it("connectInstance does not attach intentListeners denormalization", () => {
    const state = connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
      instanceId: "shape-contract-instance",
      appId: "ShapeApp",
      metadata: { appId: "ShapeApp", name: "ShapeApp" },
    })

    const instance = state.instances["shape-contract-instance"]
    expect(instance).toBeDefined()
    expect(instance).not.toHaveProperty("intentListeners")
  })

  it("intent listener registration does not mirror names onto the instance record", () => {
    let state = connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
      instanceId: "listener-instance",
      appId: "ListenerApp",
      metadata: { appId: "ListenerApp", name: "ListenerApp" },
    })

    state = registerIntentListener(state, {
      listenerId: "global-listener-1",
      intentName: "ViewChart",
      instanceId: "listener-instance",
      appId: "ListenerApp",
      contextTypes: [],
    })

    const instance = state.instances["listener-instance"]
    expect(Object.keys(state.intents.listeners)).toEqual(["global-listener-1"])
    expect(instance).not.toHaveProperty("intentListeners")
  })

  it("disconnected instances are absent rather than marked TERMINATED", () => {
    let state = connectInstance(createInitialState(DEFAULT_FDC3_USER_CHANNELS), {
      instanceId: "disconnect-target",
      appId: "DisconnectApp",
      metadata: { appId: "DisconnectApp", name: "DisconnectApp" },
    })
    state = removeInstance(state, "disconnect-target")

    expect(getInstance(state, "disconnect-target")).toBeUndefined()
    expect(state.instances["disconnect-target"]).toBeUndefined()
    expect(
      Object.values(state.instances).every(
        i => i.state === AppInstanceState.PENDING || i.state === AppInstanceState.CONNECTED
      )
    ).toBe(true)
  })

  it("state mutator barrel does not export instance intent listener denormalization mutators", () => {
    assertNoForbiddenExports(stateMutators, "mutators/index", FORBIDDEN_INSTANCE_MUTATOR_EXPORTS)
  })

  it("state selector barrel does not export getInstancesWithIntentListener", () => {
    assertNoForbiddenExports(stateSelectors, "selectors/index", FORBIDDEN_INSTANCE_SELECTOR_EXPORTS)
  })
})
