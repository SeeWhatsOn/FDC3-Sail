/**
 * Build a DACPHandlerContext wired to a Cucumber world's DesktopAgent and mocks.
 * For BDD steps that must call handlers directly (e.g. legacy "is closed" teardown).
 */

import type { DACPHandlerContext } from "../../src/core/handlers/types"
import { consoleLogger } from "../../src/core/interfaces/logger"
import type { CustomWorld } from "../world/index.ts"
import { applyDesktopAgentStateUpdate, getDesktopAgentPendingIntentPromises } from "./agent-state"

export function createHandlerContextForWorld(
  world: CustomWorld,
  instanceId: string
): DACPHandlerContext {
  const agent = world.desktopAgent

  return {
    transport: world.mockTransport,
    instanceId,
    getState: () => world.getState(),
    setState: fn => applyDesktopAgentStateUpdate(agent, fn),
    appDirectory: world.appDirectoryManager,
    appLauncher: world.mockAppLauncher,
    requestIntentResolution: world.mockIntentResolver.createCallback(),
    logger: consoleLogger,
    implementationMetadata: agent.getImplementationMetadata(),
    openContextListenerTimeoutMs: 2000,
    heartbeatEnabled: true,
    heartbeatIntervalMs: 500,
    heartbeatTimeoutMs: 2000,
    pendingIntentPromises: getDesktopAgentPendingIntentPromises(agent),
  }
}
