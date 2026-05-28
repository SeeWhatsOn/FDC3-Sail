/**
 * Contract: AgentState.intents exposes only FDC3 2.2-required slices (listeners + pending).
 * Intent resolution history is not part of agent state.
 */
import { describe, expect, it } from "vitest"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../default-user-channels"
import { createInitialState } from "../initial-state"
import * as intentMutators from "../mutators/intent"
import * as stateMutators from "../mutators/index"
import * as intentSelectors from "../selectors/intent"
import * as stateSelectors from "../selectors/index"
import * as statsSelectors from "../selectors/stats"
import type { AgentState } from "../types"

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false
type Expect<T extends true> = T

/** Compile-time contract (fails `tsc` if intents shape drifts). */
const _intentsTypeContract = {
  noHistory: true as Expect<
    Equals<"history" extends keyof AgentState["intents"] ? false : true, true>
  >,
  listenersAndPendingOnly: true as Expect<
    Equals<keyof AgentState["intents"], "listeners" | "pending">
  >,
}
void _intentsTypeContract

const FORBIDDEN_STATE_EXPORTS = [
  "recordIntentResolution",
  "IntentResolutionRecord",
  "getIntentHistory",
  "getIntentResolutionHistory",
  "getResolvedIntents",
] as const

function assertNoForbiddenExports(
  moduleExports: Record<string, unknown>,
  moduleName: string
): void {
  for (const exportName of FORBIDDEN_STATE_EXPORTS) {
    expect(
      Object.prototype.hasOwnProperty.call(moduleExports, exportName),
      `${moduleName} must not export ${exportName}`
    ).toBe(false)
  }
}

describe("AgentState.intents contract", () => {
  it("initial state intents has only listeners and pending keys", () => {
    const intents = createInitialState(DEFAULT_FDC3_USER_CHANNELS).intents

    expect(Object.keys(intents).sort()).toEqual(["listeners", "pending"])
    expect(intents.listeners).toEqual({})
    expect(intents.pending).toEqual({})
  })

  it("state mutator barrels do not export intent history APIs", () => {
    assertNoForbiddenExports(intentMutators, "mutators/intent")
    assertNoForbiddenExports(stateMutators, "mutators/index")
  })

  it("state selector barrels do not export intent history selectors", () => {
    assertNoForbiddenExports(intentSelectors, "selectors/intent")
    assertNoForbiddenExports(stateSelectors, "selectors/index")
    assertNoForbiddenExports(statsSelectors, "selectors/stats")
  })
})
