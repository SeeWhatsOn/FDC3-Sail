/**
 * DACP Utility Functions
 *
 * Helper functions for DACP protocol operations including timeouts, UUID generation, and logging.
 */

import { DACPTimeoutError } from "./dacp-errors"
import { DACP_TIMEOUTS } from "./dacp-constants"
import { consoleLogger } from "../interfaces/logger"

/**
 * Wraps a promise with a timeout, rejecting with DACPTimeoutError if exceeded.
 */
export function withDACPTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DACP_TIMEOUTS.DEFAULT,
  operation: string = "DACP operation"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new DACPTimeoutError(`${operation} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

/**
 * Generates a UUID for events.
 */
export function generateEventUuid(): string {
  return crypto.randomUUID()
}

/**
 * Logs DACP messages for debugging (with sensitive data filtering).
 */
export function logDACPMessage(
  direction: "incoming" | "outgoing",
  message: unknown,
  source?: string
): void {
  try {
    // Basic message logging without validation dependency
    if (typeof message === "object" && message !== null) {
      const msg = message as Record<string, unknown>
      const logEntry = {
        direction,
        type: msg.type,
        meta: msg.meta,
        source,
      }

      consoleLogger.debug(`[DACP ${direction.toUpperCase()}]`, logEntry)
    } else {
      consoleLogger.warn(`[DACP INVALID ${direction.toUpperCase()}]`, {
        message: "Invalid message format",
        source,
      })
    }
  } catch (error) {
    consoleLogger.error(`[DACP LOG ERROR]`, error)
  }
}
