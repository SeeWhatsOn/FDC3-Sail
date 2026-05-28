import { AppDirectoryManager } from "../../../app-directory/app-directory-manager"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { DEFAULT_SAIL_IMPLEMENTATION_METADATA } from "../../../sail-default-config"
import { consoleLogger } from "../../../interfaces/logger"
import type { DACPHandlerContext, PendingIntentPromiseEntry } from "../../types"
import { createInitialState } from "../../../state/initial-state"
import type { AgentState, StateSetter } from "../../../state/types"
import { InMemoryTransport } from "../../../../transports/in-memory-transport"

export function createDACPTestContext(options: {
  instanceId: string
  pendingIntentPromises?: Map<string, PendingIntentPromiseEntry>
  initialState?: AgentState
}): {
  context: DACPHandlerContext
  getState: () => AgentState
} {
  let state = options.initialState ?? createInitialState(DEFAULT_FDC3_USER_CHANNELS)

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
      ...DEFAULT_SAIL_IMPLEMENTATION_METADATA,
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
