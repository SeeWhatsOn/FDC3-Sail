import type {
  AppRequestMessage,
  WebConnectionProtocolMessage,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import type { MessagePortTransport } from "../message-port-transport"
import type { InboundAppMessageHandler } from "../../connections/types"
import type { AppConnectionManager } from "../../connections/app-connection-manager"
import { isAppMessage } from "./wcp-types"
import type { Logger } from "../../core/interfaces/logger"
import type { WCPConnectorEvents } from "../wcp-connector-events"

export interface WCPRoutingContext {
  connectionManager: AppConnectionManager
  ingestFromApp: InboundAppMessageHandler
  logger: Logger
  emit: <EventName extends keyof WCPConnectorEvents>(
    event: EventName,
    ...args: Parameters<WCPConnectorEvents[EventName]>
  ) => void
  enrichMessageWithSource: (
    message: AppRequestMessage | WebConnectionProtocolMessage,
    instanceId: string
  ) => AppRequestMessage | WebConnectionProtocolMessage
  handleWCP6Goodbye: (instanceId: string) => void
  disconnectApp: (instanceId: string) => void
}

/**
 * Bridge app MessagePort → Desktop Agent ingest.
 * Outbound delivery uses {@link AppConnectionManager.deliverToApp}.
 */
export function bridgeAppPort(
  appTransport: MessagePortTransport,
  context: WCPRoutingContext
): void {
  const { connectionManager } = context

  appTransport.onMessage((message: unknown) => {
    if (!isAppMessage(message)) {
      context.logger.warn("Received invalid message from app, ignoring", message)
      return
    }

    const currentInstanceId = connectionManager.transportToInstanceId.get(appTransport)
    if (!currentInstanceId) {
      context.logger.warn("Cannot route message: transport not found in reverse lookup")
      return
    }

    if (message.type === "WCP6Goodbye") {
      const enrichedGoodbye = context.enrichMessageWithSource(message, currentInstanceId)
      void Promise.resolve(context.ingestFromApp(enrichedGoodbye)).catch(error => {
        context.logger.error("Error ingesting WCP6Goodbye:", error)
      })
      context.handleWCP6Goodbye(currentInstanceId)
      return
    }

    const enrichedMessage = context.enrichMessageWithSource(message, currentInstanceId)
    void Promise.resolve(context.ingestFromApp(enrichedMessage)).catch(error => {
      context.logger.error("Error ingesting app message:", error)
    })
  })

  appTransport.onDisconnect(() => {
    const currentInstanceId = connectionManager.transportToInstanceId.get(appTransport)
    if (currentInstanceId) {
      context.disconnectApp(currentInstanceId)
    }
    connectionManager.transportToInstanceId.delete(appTransport)
  })
}

/** Deliver an outbound agent message to the correct app port. */
export function deliverAgentMessage(
  message: unknown,
  connectionManager: AppConnectionManager
): void {
  connectionManager.deliverToApp(message)
}

/** @deprecated Use {@link bridgeAppPort} */
export const bridgeTransports = bridgeAppPort

/** @deprecated Use {@link deliverAgentMessage} */
export function handleDesktopAgentMessage(message: unknown, context: WCPRoutingContext): void {
  deliverAgentMessage(message, context.connectionManager)
}
