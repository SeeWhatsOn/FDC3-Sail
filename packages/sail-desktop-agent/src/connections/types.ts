import type { HostIntentResolverPayload, HostIntentResolverResponse } from "../host-contracts"
import type { AgentState, StateSetter } from "../core/state/types"
import type { AppConnectionMetadata } from "../app-connection/wcp/wcp-types"

export type { AppConnectionMetadata }
export type {
  WCPConnectorOptions,
  WCPConnectorOptions as BrowserConnectionOptions,
} from "../app-connection/wcp/wcp-types"

/** Inbound DACP/WCP from a connected app instance. */
export type InboundAppMessageHandler = (message: unknown) => void | Promise<void>

/**
 * Runtime delivery surface for browser app instances.
 * Maps instanceId → MessagePort; not part of FDC3 AgentState.
 */
export interface AppConnectionDelivery {
  deliverToApp(instanceId: string, message: unknown): void
}

/**
 * DA-owned browser connection (WCP + per-app MessagePorts).
 * Hidden inside {@link DesktopAgent} — hosts configure policy, not plumbing.
 */
export interface BrowserConnectionBackend extends AppConnectionDelivery {
  start(): void
  stop(): void
  setInboundHandler(handler: InboundAppMessageHandler): void
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
  on(event: "appConnected", listener: (metadata: AppConnectionMetadata) => void): void
  on(event: "appDisconnected", listener: (instanceId: string) => void): void
  on(
    event: "handshakeFailed",
    listener: (error: Error, connectionAttemptUuid: string) => void
  ): void
  on(
    event: "channelChanged",
    listener: (instanceId: string, channelId: string | null) => void
  ): void
  on(event: "intentResolverNeeded", listener: (payload: HostIntentResolverPayload) => void): void
  off(event: "appConnected", listener: (metadata: AppConnectionMetadata) => void): void
  off(event: "appDisconnected", listener: (instanceId: string) => void): void
  off(
    event: "handshakeFailed",
    listener: (error: Error, connectionAttemptUuid: string) => void
  ): void
  off(
    event: "channelChanged",
    listener: (instanceId: string, channelId: string | null) => void
  ): void
  off(event: "intentResolverNeeded", listener: (payload: HostIntentResolverPayload) => void): void
}
