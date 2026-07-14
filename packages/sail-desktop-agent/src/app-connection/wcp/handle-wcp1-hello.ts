/**
 * Handle WCP1Hello: MessageChannel + WCP3Handshake + pending registry entry.
 */

import { MessagePortTransport } from "../message-port"
import { createWcp3Handshake } from "./create-wcp3-handshake"
import { resolveHostIdentifierFromSource } from "./wcp-host-identifier"
import type { AppConnectionRegistry } from "../app-connection-registry"
import type {
  AppConnectionMetadata,
  AppConnectionOptions,
  WCP1HelloMessage,
} from "./wcp-types"
import type { Logger } from "../logger"

export type Wcp1HelloContext = {
  connectionRegistry: AppConnectionRegistry
  options: Required<
    Pick<AppConnectionOptions, "fdc3Version" | "handshakeTimeout" | "logger">
  > & {
    resolveHostIdentifier?: (source: Window) => string | undefined
  }
  disconnectApp: (instanceId: string) => void
  emitHandshakeFailed: (error: Error, connectionAttemptUuid: string) => void
  bridgeAppPort: (transport: MessagePortTransport, instanceId: string) => void
  logger: Logger
}

export function handleWcp1Hello(
  event: MessageEvent<WCP1HelloMessage>,
  context: Wcp1HelloContext,
): void {
  if (!event.source) {
    context.logger.warn("WCP1Hello received from null source, ignoring")
    return
  }

  const { connectionAttemptUuid } = event.data.meta
  const instanceId = `temp-${connectionAttemptUuid}`
  const channel = new MessageChannel()
  const appTransport = new MessagePortTransport(channel.port2)

  context.bridgeAppPort(appTransport, instanceId)

  const sourceWindow = event.source as Window
  const hostIdentifier = resolveHostIdentifierFromSource(sourceWindow, {
    resolveHostIdentifier: context.options.resolveHostIdentifier,
  })

  const metadata: AppConnectionMetadata = {
    instanceId,
    appId: "unknown",
    connectionAttemptUuid,
    messageOrigin: event.origin,
    source: sourceWindow,
    port: channel.port2,
    connectedAt: new Date(),
    hostIdentifier,
  }

  context.connectionRegistry.connections.set(instanceId, metadata)
  context.connectionRegistry.messagePortTransports.set(instanceId, appTransport)
  context.connectionRegistry.transportToInstanceId.set(appTransport, instanceId)

  const handshake = createWcp3Handshake({
    connectionAttemptUuid,
    fdc3Version: context.options.fdc3Version,
  })

  ;(event.source as Window).postMessage(handshake, event.origin, [
    channel.port1,
  ])

  setTimeout(() => {
    const connection = context.connectionRegistry.connections.get(instanceId)
    if (connection && connection.appId === "unknown") {
      context.logger.warn(
        `[BrowserAppConnection] Connection ${instanceId} timed out waiting for WCP4, cleaning up`,
      )
      context.disconnectApp(instanceId)
      context.emitHandshakeFailed(
        new Error("WCP4 validation timeout"),
        connectionAttemptUuid,
      )
    }
  }, context.options.handshakeTimeout)
}
