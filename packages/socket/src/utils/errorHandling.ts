/**
 * Standardized handler for try/catch blocks that need to report errors
 * and invoke a callback.
 */
export interface ErrorHandlerOptions<T> {
  /** Description of the operation for logging */
  operation: string
  /** Relevant context data to include in error logs */
  contextData: Record<string, unknown>
  /** Default error message if no message is available */
  fallbackMessage: string
  /** Callback function to invoke with error information */
  callback: (result: T | null, error?: string) => void
  /** The actual error that was caught */
  error: unknown
}

/**
 * Handles operation errors in a standardized way, with logging and callback execution
 *
 * @param options - Configuration options for error handling
 */
export function handleOperationError<T>(options: ErrorHandlerOptions<T>): void {
  const { operation, contextData, fallbackMessage, callback, error } = options
  const err = error as Error
  const errMsg = err.message || fallbackMessage

  // Format the context data as key-value pairs for logging
  const contextString = Object.entries(contextData)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")

  console.error(`Error in ${operation} (${contextString}):`, {
    message: err.message,
    stack: err.stack,
    name: err.name,
  })

  callback(null, errMsg)
}
