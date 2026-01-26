import type { AppIdentifier, AppMetadata, BrowserTypes, Context } from "@finos/fdc3"
import type { Transport } from "../interfaces/transport"
import type { AppLauncher } from "../interfaces/app-launcher"
import type { AppDirectoryManager } from "../app-directory/app-directory-manager"
import type { AgentState, StateSetter } from "../state/types"
import type { Logger } from "../interfaces/logger"
import type { DesktopAgentConfig } from "../desktop-agent"
import type { DACPMessageType } from "../dacp-protocol/dacp-messages"

// ============================================================================
// INTENT RESOLUTION CALLBACK
// ============================================================================

/**
 * Handler option for intent resolution UI.
 * Extends FDC3 AppMetadata with runtime state.
 */
export type IntentHandlerOption = AppMetadata & {
  /** Whether this is a running instance (has active listener) */
  isRunning: boolean
}

/**
 * Request payload for intent resolution
 */
export interface IntentResolutionRequest {
  /** Unique request ID for correlation */
  requestId: string
  /** Intent name being raised */
  intent: string
  /** Context being passed with intent */
  context: Context
  /** Available handlers to choose from */
  handlers: IntentHandlerOption[]
}

/**
 * Response from intent resolution
 */
export interface IntentResolutionResponse {
  /** Request ID this is responding to */
  requestId: string
  /** Selected handler, or null if cancelled */
  selectedHandler: AppIdentifier | null
}

/**
 * Callback type for requesting UI-based intent resolution
 * Returns selected handler or throws if cancelled/timeout
 */
export type IntentResolutionCallback = (
  request: IntentResolutionRequest
) => Promise<IntentResolutionResponse>

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
   * Validates a DACP message against its schema
   * @param messageType - The DACP message type (e.g., "broadcastRequest")
   * @param message - The message to validate
   * @returns Validation result with success status and any errors
   */
  validate(messageType: DACPMessageType, message: unknown): ValidationResult
}

// ============================================================================
// DACP MESSAGE TYPES
// ============================================================================

/**
 * Base structure for all DACP messages
 * Messages are validated by the router before being passed to handlers
 */
export type DACPMessage =
  | BrowserTypes.AppRequestMessage
  | BrowserTypes.AgentResponseMessage
  | BrowserTypes.AgentEventMessage

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

  /** App directory manager for app metadata lookups */
  appDirectory: AppDirectoryManager

  /** App launcher for opening/launching applications (optional) */
  appLauncher?: AppLauncher

  /**
   * Callback for requesting UI-based intent resolution when multiple handlers exist.
   * If not provided, the first handler is automatically selected.
   * Injected by browser/server Desktop Agent implementations.
   */
  requestIntentResolution?: IntentResolutionCallback

  /**
   * Optional message validator for validating DACP messages.
   * If not provided, messages are processed without validation.
   * Implementations can inject Zod, AJV, or custom validators.
   */
  validator?: MessageValidator

  /** Logger instance */
  logger: Logger

  /** Implementation metadata for the desktop agent */
  implementationMetadata: DesktopAgentConfig["implementationMetadata"]
}

/**
 * Type for DACP handler functions
 * Handlers receive validated messages from the router
 */
export type DACPHandler = (message: DACPMessage, context: DACPHandlerContext) => void | Promise<void>

