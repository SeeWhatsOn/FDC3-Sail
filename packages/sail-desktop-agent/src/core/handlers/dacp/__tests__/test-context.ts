import type { BrowserTypes } from "@finos/fdc3"
import { AppDirectoryManager } from "../../../app-directory/app-directory-manager"
import { consoleLogger } from "../../../interfaces/logger"
import type { DACPHandlerContext, PendingIntentPromiseEntry } from "../../types"
import { createInitialState } from "../../../state/initial-state"
import type { AgentState, StateSetter } from "../../../state/types"
import { InMemoryTransport } from "../../../../transports/in-memory-transport"

const testUserChannels: BrowserTypes.Channel[] = [
  {
    id: "one",
    type: "user",
    displayMetadata: { name: "Channel 1", color: "#FF0000", glyph: "1" },
  },
]

export function createDACPTestContext(options: {
  instanceId: string
  pendingIntentPromises?: Map<string, PendingIntentPromiseEntry>
  initialState?: AgentState
}): {
  context: DACPHandlerContext
  getState: () => AgentState
} {
  let state = options.initialState ?? createInitialState(testUserChannels)
  const setState: StateSetter = callback => {
    state = callback(state)
  }

  const context: DACPHandlerContext = {
    transport: new InMemoryTransport(),
    instanceId: options.instanceId,
    getState: () => state,
    setState,
    appDirectory: new AppDirectoryManager(),
    logger: consoleLogger,
    implementationMetadata: {
      fdc3Version: "2.2",
      provider: "test",
      providerVersion: "0.0.0",
    },
    openContextListenerTimeoutMs: 2000,
    heartbeatIntervalMs: 500,
    heartbeatTimeoutMs: 2000,
    pendingIntentPromises: options.pendingIntentPromises ?? new Map(),
  }

  return { context, getState: () => state }
}

export { testUserChannels }
