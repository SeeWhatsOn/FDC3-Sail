import type {
  AppRequestMessage,
  WebConnectionProtocolMessage,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import type { MessagePortTransport } from "../message-port"
import type { AppMessageHandler } from "../types"
import type { AppConnectionRegistry } from "../app-connection-registry"
import { isAppMessage } from "./wcp-types"
import type { Logger } from "../../interfaces/logger"
import type { AppConnectionEvents } from "../app-connection-events"

export interface WCPRoutingContext {
  connectionRegistry: AppConnectionRegistry
  onAppMessage: AppMessageHandler
  logger: Logger
  emit: <EventName extends keyof AppConnectionEvents>(
    event: EventName,
    ...args: Parameters<AppConnectionEvents[EventName]>
  ) => void
  enrichMessageWithSource: (
    message: AppRequestMessage | WebConnectionProtocolMessage,
    instanceId: string
  ) => AppRequestMessage | WebConnectionProtocolMessage
  handleWCP6Goodbye: (instanceId: string) => void
  disconnectApp: (instanceId: string) => void
}

/**
 * Bridge app MessagePort → Desktop Agent DACP ingest.
 * Outbound uses {@link AppConnectionRegistry.sendToAppInstance}.
 */
export function bridgeAppPort(
  appTransport: MessagePortTransport,
  context: WCPRoutingContext
): void {
  const { connectionRegistry } = context

  appTransport.onMessage((message: unknown) => {
    if (!isAppMessage(message)) {
      context.logger.warn("Received invalid message from app, ignoring", message)
      return
    }

    const currentInstanceId = connectionRegistry.transportToInstanceId.get(appTransport)
    if (!currentInstanceId) {
      context.logger.warn("Cannot route message: transport not found in reverse lookup")
      return
    }

    if (message.type === "WCP6Goodbye") {
      const enrichedGoodbye = context.enrichMessageWithSource(message, currentInstanceId)
      void Promise.resolve(context.onAppMessage(enrichedGoodbye)).catch(error => {
        context.logger.error("Error ingesting WCP6Goodbye:", error)
      })
      context.handleWCP6Goodbye(currentInstanceId)
      return
    }

    const enrichedMessage = context.enrichMessageWithSource(message, currentInstanceId)
    void Promise.resolve(context.onAppMessage(enrichedMessage)).catch(error => {
      context.logger.error("Error ingesting app message:", error)
    })
  })

  appTransport.onDisconnect(() => {
    const currentInstanceId = connectionRegistry.transportToInstanceId.get(appTransport)
    if (currentInstanceId) {
      context.disconnectApp(currentInstanceId)
    }
    connectionRegistry.transportToInstanceId.delete(appTransport)
  })
}

/** @deprecated Use {@link bridgeAppPort} */
export const bridgeTransports = bridgeAppPort

/** @deprecated Use {@link AppConnectionRegistry.sendToAppInstance} */
export function handleDesktopAgentMessage(message: unknown, context: WCPRoutingContext): void {
  context.connectionRegistry.sendToAppInstance(message)
}

/** @deprecated Use {@link AppConnectionRegistry.sendToAppInstance} */
export function deliverAgentMessage(
  message: unknown,
  connectionRegistry: AppConnectionRegistry
): void {
  connectionRegistry.sendToAppInstance(message)
}
