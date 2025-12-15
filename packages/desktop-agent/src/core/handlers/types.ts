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

  /** Registry of user channels (pre-defined channels like red, blue, green) */
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
}

/**
 * Type for DACP handler functions
 */
export type DACPHandler = (message: unknown, context: DACPHandlerContext) => void | Promise<void>

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
