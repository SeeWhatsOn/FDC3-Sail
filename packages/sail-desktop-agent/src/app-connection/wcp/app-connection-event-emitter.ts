import type { AppConnectionEvents } from "../app-connection-events"
import { consoleLogger } from "../../interfaces/logger"

export class AppConnectionEventEmitter {
  private handlers: { [K in keyof AppConnectionEvents]?: Set<AppConnectionEvents[K]> } = {}

  on<EventName extends keyof AppConnectionEvents>(
    event: EventName,
    handler: AppConnectionEvents[EventName],
  ): void {
    if (!this.handlers[event]) {
      ;(this.handlers as Record<EventName, Set<AppConnectionEvents[EventName]>>)[event] = new Set()
    }
    this.handlers[event]!.add(handler)
  }

  off<EventName extends keyof AppConnectionEvents>(
    event: EventName,
    handler: AppConnectionEvents[EventName],
  ): void {
    this.handlers[event]?.delete(handler)
  }

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
