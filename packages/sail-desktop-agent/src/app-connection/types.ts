import type { HostIntentResolverPayload, HostIntentResolverResponse } from "../host-contracts"
import type { AgentState, StateSetter } from "../state/types"
import type { AppConnectionMetadata } from "./wcp/wcp-types"

export type { AppConnectionMetadata, AppConnectionOptions } from "./wcp/wcp-types"

/** Inbound DACP/WCP from a connected app instance. */
export type AppMessageHandler = (message: unknown) => void | Promise<void>

/**
 * Outbound delivery surface for connected FDC3 app instances.
 * Routes by `meta.destination.instanceId` on DACP messages.
 */
export interface AppConnectionDelivery {
  sendToAppInstance(instanceId: string, message: unknown): void
}

/**
 * Browser-resident FDC3 app connection (WCP listener + MessagePort registry).
 * Owned by {@link DesktopAgent} — hosts configure policy, not plumbing.
 */
export interface BrowserAppConnectionSurface extends AppConnectionDelivery {
  start(): void
  stop(): void
  onAppMessage(handler: AppMessageHandler): void
  bindAgentState(access: { getAgentState: () => AgentState; setAgentState: StateSetter }): void
  getConnection(instanceId: string): AppConnectionMetadata | undefined
  getConnections(): AppConnectionMetadata[]
  disconnectAppByInstanceId(instanceId: string): void
  pruneAppConnection(instanceId: string): void
  requestIntentResolution(
    payload: HostIntentResolverPayload,
    timeoutMs?: number
  ): Promise<HostIntentResolverResponse>
  resolveIntentSelection(response: HostIntentResolverResponse): void
}
