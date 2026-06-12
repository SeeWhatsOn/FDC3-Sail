import { describe, it, expect } from "vitest"
import { connectInstance, updateInstanceState } from "../../../core/state/mutators"
import { AppInstanceState, type AgentState } from "../../../core/state/types"
import { createInitialState } from "../../../core/state/initial-state"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../core/default-user-channels"
import { createDACPTestContext } from "../../../core/handlers/dacp/__tests__/test-context"
import { cleanupDACPHandlers } from "../../../core/handlers/dacp/cleanup"
import { MockTransport as CucumberMockTransport } from "../../../../test/support/mock-transport"
import {
  linkTempToCanonical,
  resolveCanonicalInstanceId,
  unlinkCanonical,
} from "../wcp-instance-id-resolver"

function connectTestInstance(instanceId: string): AgentState {
  let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
  state = connectInstance(state, {
    instanceId,
    appId: "TestApp",
    metadata: { appId: "TestApp", name: "TestApp" },
  })
  return updateInstanceState(state, instanceId, AppInstanceState.CONNECTED)
}

describe("WCP temp→canonical resolver contract", () => {
  it("exports linkTempToCanonical, resolveCanonicalInstanceId, and unlinkCanonical", () => {
    expect(linkTempToCanonical).toEqual(expect.any(Function))
    expect(resolveCanonicalInstanceId).toEqual(expect.any(Function))
    expect(unlinkCanonical).toEqual(expect.any(Function))
  })

  it("cleanupDACPHandlers removes canonical instance when temp id resolves via shared mapping without heartbeat link", () => {
    const connectionAttemptUuid = "no-heartbeat-resolver-uuid"
    const tempInstanceId = `temp-${connectionAttemptUuid}`
    const canonicalInstanceId = "canonical-no-heartbeat-resolver"
    const initialState = connectTestInstance(canonicalInstanceId)

    const { context, getState } = createDACPTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    linkTempToCanonical(tempInstanceId, canonicalInstanceId)
    cleanupDACPHandlers(context)

    expect(getState().instances[canonicalInstanceId]).toBeUndefined()
  })

  it("cleanupDACPHandlers removes canonical instance when MockTransport registers WCP5 mapping", () => {
    const connectionAttemptUuid = "cucumber-wcp5-mapping-uuid"
    const tempInstanceId = `temp-${connectionAttemptUuid}`
    const canonicalInstanceId = "canonical-cucumber-wcp5-mapping"
    const initialState = connectTestInstance(canonicalInstanceId)

    const transport = new CucumberMockTransport()
    transport.registerWcp5Mapping(connectionAttemptUuid, canonicalInstanceId)

    const { context, getState } = createDACPTestContext({
      instanceId: tempInstanceId,
      initialState,
    })

    cleanupDACPHandlers({ ...context, transport })

    expect(getState().instances[canonicalInstanceId]).toBeUndefined()
  })

  it("shared resolver links temp id to canonical id for cleanup and DACP routing", () => {
    const tempInstanceId = "temp-shared-resolver"
    const canonicalInstanceId = "canonical-shared-resolver"

    linkTempToCanonical(tempInstanceId, canonicalInstanceId)
    expect(resolveCanonicalInstanceId(tempInstanceId)).toBe(canonicalInstanceId)
    expect(resolveCanonicalInstanceId(canonicalInstanceId)).toBeUndefined()

    unlinkCanonical(canonicalInstanceId)
    expect(resolveCanonicalInstanceId(tempInstanceId)).toBeUndefined()
  })
})
