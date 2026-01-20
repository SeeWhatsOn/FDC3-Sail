import type { Transport } from "../interfaces/transport"
import type { AppLauncher } from "../interfaces/app-launcher"
import type { AppInstanceRegistry } from "../state/app-instance-registry"
import type { IntentRegistry } from "../state/intent-registry"
import type { ChannelContextRegistry } from "../state/channel-context-registry"
import type { AppChannelRegistry } from "../state/app-channel-registry"
import type { UserChannelRegistry } from "../state/user-channel-registry"
import type { AppDirectoryManager } from "../app-directory/app-directory-manager"

// ============================================================================
// INTENT RESOLUTION CALLBACK
// ============================================================================

/**
 * Handler option for intent resolution UI
 */
export interface IntentHandlerOption {
  /** Instance ID if this is a running listener */
  instanceId?: string
  /** App ID from directory */
  appId: string
  /** Display name for the app */
  appName?: string
  /** Icon URL for the app */
  appIcon?: string
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
  context: unknown
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
  selectedHandler: { instanceId?: string; appId: string } | null
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
  validate(messageType: string, message: unknown): ValidationResult
}

// ============================================================================
// DACP MESSAGE TYPES
// ============================================================================

/**
 * Base structure for all DACP messages
 * Messages are validated by the router before being passed to handlers
 */
export interface DACPMessage {
  /** Message type (e.g., "broadcastRequest", "raiseIntentRequest") */
  type: string
  /** Message payload - specific structure depends on message type */
  payload: Record<string, unknown>
  /** Message metadata */
  meta: {
    requestUuid: string
    timestamp: Date
    responseUuid?: string
    eventUuid?: string
    source?: { instanceId: string }
    destination?: { instanceId: string }
  }
}

// ============================================================================
// DACP HANDLER CONTEXT
// ============================================================================

/**
 * Context passed to all DACP message handlers
 * Contains state registries and the message transport for sending responses
 */
export interface DACPHandlerContext {
  /** Message transport for sending responses to this specific app instance */
  transport: Transport

  /** Unique identifier for this app instance */
  instanceId: string

  /** Registry of all app instances and their state */
  appInstanceRegistry: AppInstanceRegistry

  /** Registry of intent listeners and capabilities */
  intentRegistry: IntentRegistry

  /** Registry of channel contexts (last broadcast context per channel) */
  channelContextRegistry: ChannelContextRegistry

  /** Registry of app channels (dynamically created channels) */
  appChannelRegistry: AppChannelRegistry

  /** Registry of user channels (pre-defined FDC3 channels: fdc3.channel.1 through fdc3.channel.8) */
  userChannelRegistry: UserChannelRegistry

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
}

/**
 * Type for DACP handler functions
 * Handlers receive validated messages from the router
 */
export type DACPHandler = (message: DACPMessage, context: DACPHandlerContext) => void | Promise<void>

// ============================================================================
// LOGGING
// ============================================================================

// Log levels for structured logging
export enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
}

// Logging utility for DACP handlers
export const logger = {
  error: (message: string, ...args: unknown[]) => {
    console.error(`[DACP ${LogLevel.ERROR}] ${message}`, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[DACP ${LogLevel.WARN}] ${message}`, ...args)
  },
  info: (message: string, ...args: unknown[]) => {
    console.log(`[DACP ${LogLevel.INFO}] ${message}`, ...args)
  },
  debug: (message: string, ...args: unknown[]) => {
    if (typeof process !== "undefined" && process.env?.DACP_DEBUG_MODE === "true") {
      console.log(`[DACP ${LogLevel.DEBUG}] ${message}`, ...args)
    }
  },
}
