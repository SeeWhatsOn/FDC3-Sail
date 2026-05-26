import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearAllHeartbeatTimersForTesting,
  getActiveHeartbeatTimerCount,
  setHeartbeatTimer,
  stopHeartbeat,
} from "../heartbeat-runtime"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { createInitialState } from "../../../state/initial-state"
import type { AgentState } from "../../../state/types"

afterEach(() => {
  clearAllHeartbeatTimersForTesting()
})

describe("heartbeat-runtime", () => {
  it("removes interval handles when stopHeartbeat is called", () => {
    let state = createInitialState(DEFAULT_FDC3_USER_CHANNELS)
    const setState = (fn: (s: AgentState) => AgentState) => {
      state = fn(state)
    }

    const handle = setInterval(() => {}, 1000)
    setHeartbeatTimer("a1", handle)
    expect(getActiveHeartbeatTimerCount()).toBe(1)

    stopHeartbeat("a1", setState)

    expect(getActiveHeartbeatTimerCount()).toBe(0)
  })

  it("replaces an existing interval when setHeartbeatTimer is called again", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval")

    setHeartbeatTimer("a1", setInterval(() => {}, 1000))
    setHeartbeatTimer("a1", setInterval(() => {}, 1000))

    expect(getActiveHeartbeatTimerCount()).toBe(1)
    expect(clearSpy).toHaveBeenCalled()

    clearSpy.mockRestore()
  })
})

describe("heartbeat scenario isolation", () => {
  beforeEach(() => {
    clearAllHeartbeatTimersForTesting()
  })

  it("has no active timers after explicit cleanup (simulates scenario teardown expectation)", () => {
    setHeartbeatTimer("orphan", setInterval(() => {}, 1000))
    clearAllHeartbeatTimersForTesting()
    expect(getActiveHeartbeatTimerCount()).toBe(0)
  })
})
