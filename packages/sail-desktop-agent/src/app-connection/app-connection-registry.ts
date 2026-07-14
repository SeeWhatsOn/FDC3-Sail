import type { Logger } from "./logger"
import type { MessagePortTransport } from "./message-port"
import type { AppConnectionMetadata } from "./wcp/wcp-types"

export type AppConnectionRegistryCallbacks = {
  logger: Logger
  disconnectApp: (instanceId: string) => void
}

/**
 * Runtime registry of connected FDC3 app instances → MessagePorts.
 * Ports are not part of durable agent state — they change on reconnect.
 */
export class AppConnectionRegistry {
  readonly connections = new Map<string, AppConnectionMetadata>()
  readonly messagePortTransports = new Map<string, MessagePortTransport>()
  readonly transportToInstanceId = new Map<MessagePortTransport, string>()

  constructor(private readonly callbacks: AppConnectionRegistryCallbacks) {}

  getConnection(instanceId: string): AppConnectionMetadata | undefined {
    return this.connections.get(instanceId)
  }

  getConnections(): AppConnectionMetadata[] {
    return Array.from(this.connections.values())
  }

  sendOnPort(instanceId: string, message: unknown): void {
    const transport = this.messagePortTransports.get(instanceId)
    if (!transport?.isConnected()) {
      this.callbacks.logger.warn(
        `[AppConnectionRegistry] Cannot send to ${instanceId}: port missing or disconnected`,
      )
      return
    }

    try {
      transport.send(message)
    } catch (error) {
      this.callbacks.logger.error(
        "[AppConnectionRegistry] Error sending on app MessagePort",
        { instanceId, error },
      )
    }
  }

  /**
   * Migrate a pending temp connection to the canonical instance id after WCP5 success.
   */
  migrateInstanceId(
    tempInstanceId: string,
    actualInstanceId: string,
    appId: string,
  ): void {
    if (tempInstanceId === actualInstanceId) {
      const existing = this.connections.get(tempInstanceId)
      if (existing) {
        existing.appId = appId
      }
      return
    }

    const metadata = this.connections.get(tempInstanceId)
    const transport = this.messagePortTransports.get(tempInstanceId)
    if (!metadata || !transport) {
      this.callbacks.logger.warn(
        `[AppConnectionRegistry] Cannot migrate ${tempInstanceId} → ${actualInstanceId}: missing entry`,
      )
      return
    }

    metadata.instanceId = actualInstanceId
    metadata.appId = appId

    this.connections.delete(tempInstanceId)
    this.messagePortTransports.delete(tempInstanceId)

    this.connections.set(actualInstanceId, metadata)
    this.messagePortTransports.set(actualInstanceId, transport)
    this.transportToInstanceId.set(transport, actualInstanceId)
  }

  remove(instanceId: string): AppConnectionMetadata | undefined {
    const metadata = this.connections.get(instanceId)
    const transport = this.messagePortTransports.get(instanceId)

    this.connections.delete(instanceId)
    this.messagePortTransports.delete(instanceId)

    if (transport) {
      this.transportToInstanceId.delete(transport)
      if (transport.isConnected()) {
        transport.disconnect()
      }
    }

    return metadata
  }
}
