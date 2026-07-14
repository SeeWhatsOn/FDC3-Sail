/**
 * Minimal logger for MessagePort transport. Hosts can inject a richer logger;
 * OTEL / structured logging can replace this later.
 */

export type Logger = {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

/** Silent default so production paths do not spam the console. */
export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}
