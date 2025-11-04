import type { MessageTransport } from "../transport/MessageTransport"
import type { AppInstanceRegistry } from "../state/AppInstanceRegistry"
import type { IntentRegistry } from "../state/IntentRegistry"
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
  transport: MessageTransport

  /** Unique identifier for this app instance */
  instanceId: string

  /** Registry of all app instances and their state */
  appInstanceRegistry: AppInstanceRegistry

  /** Registry of intent listeners and capabilities */
  intentRegistry: IntentRegistry

  /** App directory manager for app metadata lookups */
  appDirectory: AppDirectoryManager
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