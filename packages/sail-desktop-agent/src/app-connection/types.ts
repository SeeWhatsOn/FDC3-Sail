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
  sendToAppInstance(message: unknown): void
}

/**
 * App edge wired into {@link DesktopAgent} for inbound DACP/WCP and outbound delivery.
 * Production: {@link BrowserAppConnection}. Tests: {@link DacpTestAppConnection} in test support.
 */
export interface AgentAppConnection {
  start(): void
  stop(): void
  onAppMessage(handler: AppMessageHandler): void
  setOnInstanceTeardown(handler: (instanceId: string) => void): void
  /**
   * Optional whole-agent disconnect hook (test edge). Browser path tears down
   * per-instance via {@link setOnInstanceTeardown} instead.
   */
  setOnAgentDisconnect?(handler: () => void): void
  readonly connectionRegistry: AppConnectionDelivery
  getConnection(instanceId: string): AppConnectionMetadata | undefined
  getConnections(): AppConnectionMetadata[]
  pruneAppConnection(instanceId: string): void
  /** Notify host shell when an instance joins or leaves a user channel (browser path). */
  notifyChannelMembershipChanged?(instanceId: string, channelId: string | null): void
}

/**
 * Browser-resident FDC3 app connection (WCP listener + MessagePort registry).
 * Owned by {@link DesktopAgent} — hosts configure policy, not plumbing.
 */
export interface BrowserAppConnectionSurface extends AgentAppConnection {
  bindAgentState(access: { getAgentState: () => AgentState; setAgentState: StateSetter }): void
  disconnectAppByInstanceId(instanceId: string): void
  /**
   * Host launcher id when `window.name` was cleared before WCP1.
   * Used by WCP4 / DACP to re-resolve and persist {@link AppConnectionMetadata.hostIdentifier}.
   */
  resolveHostIdentifierForSource?(source: Window): string | undefined
  requestIntentResolution(
    payload: HostIntentResolverPayload,
    timeoutMs?: number,
  ): Promise<HostIntentResolverResponse>
  resolveIntentSelection(response: HostIntentResolverResponse): void
}
