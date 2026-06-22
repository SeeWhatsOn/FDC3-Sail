import type { AppConnectionEvents } from "../app-connection-events"
import { consoleLogger } from "../../interfaces/logger"

export class WCPEventEmitter {
  private handlers: { [K in keyof AppConnectionEvents]?: Set<AppConnectionEvents[K]> } = {}

  /**
   * Register an event handler
   *
   * @param event - Event name
   * @param handler - Event handler function
   */
  on<EventName extends keyof AppConnectionEvents>(
    event: EventName,
    handler: AppConnectionEvents[EventName],
  ): void {
    if (!this.handlers[event]) {
      // Type assertion needed: TypeScript can't infer the relationship between
      // generic EventName and the mapped type in handlers
      ;(this.handlers as Record<EventName, Set<AppConnectionEvents[EventName]>>)[event] = new Set()
    }
    this.handlers[event]!.add(handler)
  }

  /**
   * Remove an event handler
   *
   * @param event - Event name
   * @param handler - Event handler function
   */
  off<EventName extends keyof AppConnectionEvents>(
    event: EventName,
    handler: AppConnectionEvents[EventName],
  ): void {
    this.handlers[event]?.delete(handler)
  }

  /**
   * Emit an event to all registered handlers
   */
  protected emit<EventName extends keyof AppConnectionEvents>(
    event: EventName,
    ...args: Parameters<AppConnectionEvents[EventName]>
  ): void {
    const handlers = this.handlers[event]
    if (!handlers) {
      return
    }

    for (const handler of handlers) {
      try {
        ;(handler as (...args: Parameters<AppConnectionEvents[EventName]>) => void)(...args)
      } catch (error) {
        consoleLogger.error(`Error in ${event} handler:`, error)
      }
    }
  }
}
