import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearAllHeartbeatTimersForTesting,
  getActiveHeartbeatTimerCount,
  setHeartbeatTimer,
  stopHeartbeat,
} from "../heartbeat-runtime"
import { createInitialState } from "../../../state/initial-state"
import type { AgentState } from "../../../state/types"

const testUserChannels = [
  {
    id: "one",
    type: "user" as const,
    displayMetadata: { name: "Channel 1", color: "#FF0000", glyph: "1" },
  },
]

afterEach(() => {
  clearAllHeartbeatTimersForTesting()
})

describe("heartbeat-runtime", () => {
  it("removes interval handles when stopHeartbeat is called", () => {
    let state = createInitialState(testUserChannels)
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
