import type { BrowserTypes } from "@finos/fdc3"
import { DEFAULT_FDC3_USER_CHANNELS } from "../../../default-user-channels"
import { DEFAULT_SAIL_IMPLEMENTATION_METADATA } from "../../../sail-default-config"
import { consoleLogger } from "../../../interfaces/logger"
import type { DACPHandlerContext, PendingIntentPromiseEntry } from "../../types"
import { createInitialState } from "../../../state/initial-state"
import type { AgentState, StateSetter } from "../../../state/types"
import { InMemoryTransport } from "../../../../transports/in-memory-transport"

/** Shared agent state for contexts created with the same initialState reference (multi-connection tests). */
const sharedStateByInitialSnapshot = new WeakMap<AgentState, AgentState>()

export function createDACPTestContext(options: {
  instanceId: string
  pendingIntentPromises?: Map<string, PendingIntentPromiseEntry>
  initialState?: AgentState
}): {
  context: DACPHandlerContext
  getState: () => AgentState
} {
  const initialSnapshot = options.initialState
  let state = initialSnapshot ?? createInitialState(DEFAULT_FDC3_USER_CHANNELS)

  if (initialSnapshot && !sharedStateByInitialSnapshot.has(initialSnapshot)) {
    sharedStateByInitialSnapshot.set(initialSnapshot, state)
  }

  const readState = (): AgentState =>
    initialSnapshot ? (sharedStateByInitialSnapshot.get(initialSnapshot) ?? state) : state

  const setState: StateSetter = callback => {
    const next = callback(readState())
    state = next
    if (initialSnapshot) {
      sharedStateByInitialSnapshot.set(initialSnapshot, next)
    }
  }

  const context: DACPHandlerContext = {
    transport: new InMemoryTransport(),
    instanceId: options.instanceId,
    getState: readState,
    setState,
    logger: consoleLogger,
    implementationMetadata: {
      ...DEFAULT_SAIL_IMPLEMENTATION_METADATA,
      provider: "test",
      providerVersion: "0.0.0",
    },
    openContextListenerTimeoutMs: 2000,
    heartbeatEnabled: true,
    heartbeatIntervalMs: 500,
    heartbeatTimeoutMs: 2000,
    pendingIntentPromises:
      options.pendingIntentPromises ?? new Map<string, PendingIntentPromiseEntry>(),
  }

  return { context, getState: readState }
}

export function createDacpRequestMeta(
  requestUuid: string,
  source: BrowserTypes.AppIdentifier = { appId: "TestApp", instanceId: "a1" }
): BrowserTypes.AppRequestMessageMeta {
  return {
    requestUuid,
    timestamp: new Date(),
    source,
  }
}
