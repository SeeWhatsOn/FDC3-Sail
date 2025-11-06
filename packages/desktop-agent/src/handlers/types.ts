import type { Transport } from "../interfaces/Transport"
import type { AppLauncher } from "../interfaces/AppLauncher"
import type { AppInstanceRegistry } from "../state/AppInstanceRegistry"
import type { IntentRegistry } from "../state/IntentRegistry"
import type { ChannelContextRegistry } from "../state/ChannelContextRegistry"
import type { AppChannelRegistry } from "../state/AppChannelRegistry"
import type { UserChannelRegistry } from "../state/UserChannelRegistry"
import type { AppDirectoryManager } from "../app-directory/appDirectoryManager"

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
    if (process.env.DACP_DEBUG_MODE === "true") {
      console.log(`[DACP ${LogLevel.DEBUG}] ${message}`, ...args)
    }
  },
}