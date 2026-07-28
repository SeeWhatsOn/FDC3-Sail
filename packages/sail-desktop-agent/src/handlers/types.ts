import type { BrowserTypes } from "@finos/fdc3"
import type { AppLauncher } from "../host-contracts/app-launcher"
import type { AgentState, StateSetter } from "../state/types"
import type { Logger, LogPayloadDetail } from "../interfaces/logger"
import type { DesktopAgentConfig } from "../agent/desktop-agent"
import type { DACPMessageType } from "../dacp/dacp-messages"
import type { ValidationMode } from "../dacp/validate-dacp-message"
import type { IntentResolutionCallback } from "./intent-resolution-callback"

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Base structure for all DACP messages
 * Messages are validated by the router before being passed to handlers
 */
export type DACPMessage =
  | BrowserTypes.AppRequestMessage
  | BrowserTypes.AgentResponseMessage
  | BrowserTypes.AgentEventMessage

/**
 * WCP message type union from the FDC3 schema definitions.
 */
export type WCPMessageType = BrowserTypes.WebConnectionProtocolMessage["type"]

/**
 * Combined DACP + WCP message types for validation/routing.
 */
export type MessageType = DACPMessageType | WCPMessageType

/**
 * Entry for tracking pending intent promise state.
 * Stored per-agent to prevent cross-agent interference.
 */
export type IntentRequestType = "raiseIntentRequest" | "raiseIntentForContextRequest"

/**
 * Entry for tracking pending intent promise state.
 * Stored per-agent to prevent cross-agent interference.
 */
export interface PendingIntentPromiseEntry {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timeoutHandle?: ReturnType<typeof setTimeout>
  deliveryTimeoutHandle?: ReturnType<typeof setTimeout>
  delivered?: boolean
  requestType?: IntentRequestType
}

// ============================================================================
// DACP RESPONSE DISPATCHER
// ============================================================================

export type DacpOutboundMessage =
  | BrowserTypes.AgentResponseMessage
  | BrowserTypes.AgentEventMessage
  | BrowserTypes.WebConnectionProtocolMessage

/**
 * Delivers DACP responses and events to connected app instances.
 * Handlers use this instead of a generic {@link Transport}.
 */
export interface DacpResponseDispatcher {
  /**
   * Connection owner for WCP handshake registries only
   * (pending source window, instance identity). Normal handlers should use
   * {@link sendToInstance} / {@link sendOutbound}.
   */
  readonly connectionOwner: object

  /** Send a response or event to a specific connected app instance. */
  sendToInstance(instanceId: string, message: DacpOutboundMessage): void

  /** Send on the app edge when routing metadata is already on the message. */
  sendOutbound(message: unknown): void

  /** Instance id from the inbound message path, when the edge provides one. */
  getInboundInstanceId(): string | null
}

// ============================================================================
// DACP HANDLER CONTEXT
// ============================================================================

/**
 * Context passed to all DACP message handlers.
 */
export interface DACPHandlerContext {
  /** DACP response and event delivery for connected app instances */
  responses: DacpResponseDispatcher

  /** Unique identifier for this app instance */
  instanceId: string

  /** Get current state (read-only snapshot) */
  getState: () => AgentState

  /** Update state with a transform function */
  setState: StateSetter

  /** App launcher for opening/launching applications (optional) */
  appLauncher?: AppLauncher

  /**
   * Callback for requesting UI-based intent resolution when multiple handlers exist.
   * If not provided, the first handler is automatically selected.
   */
  requestIntentResolution?: IntentResolutionCallback

  /**
   * How inbound messages failing FDC3 schema validation are treated.
   * Defaults to `'warn'` when omitted (e.g. isolated handler tests).
   */
  validation?: ValidationMode

  /** Logger instance */
  logger: Logger

  /**
   * How much message/context detail structured logs include.
   * Defaults to `'metadata'` when omitted (e.g. isolated handler tests).
   */
  logPayloadDetail?: LogPayloadDetail

  /** Implementation metadata for the desktop agent */
  implementationMetadata: DesktopAgentConfig["implementationMetadata"]

  /** Timeout (ms) to wait for a context listener after open-with-context */
  openContextListenerTimeoutMs: number

  /**
   * When `true`, send DACP heartbeat events for connected instances (Desktop Agent policy).
   *
   * @defaultValue `true`
   */
  heartbeatEnabled: boolean

  /** Heartbeat interval (ms) for sending heartbeat events */
  heartbeatIntervalMs: number

  /** Heartbeat timeout (ms) before considering an app unresponsive */
  heartbeatTimeoutMs: number

  /**
   * Per-agent storage for pending intent promises.
   * This Map is scoped to this agent instance to prevent cross-agent state bleed.
   * Key: requestId, Value: promise handlers and timeout state
   */
  pendingIntentPromises: Map<string, PendingIntentPromiseEntry>

  /**
   * Unified instance teardown (FDC3 state + connection registry).
   * Injected by {@link DesktopAgent} for browser and headless ingest paths.
   */
  disconnectInstance?: (instanceId: string) => void

  /**
   * Host shell notification when user-channel membership changes without a DACP
   * channelChangedEvent on the app edge (app-originated join/leave, no listeners).
   */
  notifyChannelMembershipChanged?: (instanceId: string, channelId: string | null) => void
}
