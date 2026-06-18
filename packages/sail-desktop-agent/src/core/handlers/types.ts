import type { BrowserTypes } from "@finos/fdc3"
import type { Transport } from "../interfaces/transport"
import type { AppLauncher } from "../../host-contracts/app-launcher"
import type { AgentState, StateSetter } from "../state/types"
import type { Logger, LogPayloadDetail } from "../interfaces/logger"
import type { DesktopAgentConfig } from "../desktop-agent"
import type { DACPMessageType } from "../dacp/dacp-messages"
import type { IntentResolutionCallback } from "./dacp/intent-resolution-callback"

// ============================================================================
// MESSAGE VALIDATOR
// ============================================================================

/**
 * Result of message validation
 */
export interface ValidationResult {
  /** Whether the message is valid */
  valid: boolean
  /** Validation error messages if invalid */
  errors?: string[]
}

/**
 * Interface for message validation
 * Can be implemented with Zod, AJV, or any other validation library
 *
 * @example
 * ```typescript
 * // Zod-based validator implementation
 * const zodValidator: MessageValidator = {
 *   validate(messageType, message) {
 *     const schema = schemaMap[messageType]
 *     if (!schema) return { valid: true } // Unknown types pass through
 *     const result = schema.safeParse(message)
 *     return result.success
 *       ? { valid: true }
 *       : { valid: false, errors: result.error.issues.map(i => i.message) }
 *   }
 * }
 *
 * // No-op validator (validation disabled)
 * const noopValidator: MessageValidator = {
 *   validate() { return { valid: true } }
 * }
 * ```
 */
export interface MessageValidator {
  /**
   * Validates a message against its schema
   * @param messageType - The message type (e.g., "broadcastRequest", "WCP4ValidateAppIdentity")
   * @param message - The message to validate
   * @returns Validation result with success status and any errors
   */
  validate(messageType: MessageType, message: unknown): ValidationResult
}

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
// DACP HANDLER CONTEXT
// ============================================================================

/**
 * Context passed to all DACP message handlers
 * Contains state access functions and the message transport for sending responses
 */
export interface DACPHandlerContext {
  /** Message transport for sending responses to this specific app instance */
  transport: Transport

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
   * Injected by browser/server Desktop Agent implementations.
   */
  requestIntentResolution?: IntentResolutionCallback

  /**
   * Optional message validator for validating DACP/WCP messages.
   * If not provided, messages are processed without validation.
   * Implementations can inject Zod, AJV, or custom validators.
   */
  validator?: MessageValidator

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
}
