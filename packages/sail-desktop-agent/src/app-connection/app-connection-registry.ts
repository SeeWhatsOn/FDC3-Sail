import type {
  AgentEventMessage,
  AgentResponseMessage,
  WebConnectionProtocolMessage,
} from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import type { Logger } from "../interfaces/logger"
import type { MessagePortTransport } from "./message-port"
import type { AppConnectionMetadata } from "./wcp/wcp-types"
import { isAgentMessage } from "./wcp/wcp-types"
import type { AppConnectionEvents } from "./app-connection-events"

type EmitFunction = <EventName extends keyof AppConnectionEvents>(
  event: EventName,
  ...args: Parameters<AppConnectionEvents[EventName]>
) => void

export interface AppConnectionRegistryCallbacks {
  emit: EmitFunction
  logger: Logger
  updateConnectionMetadata: (
    tempInstanceId: string,
    actualInstanceId: string,
    appId: string
  ) => void
  disconnectApp: (instanceId: string) => void
}

/**
 * Runtime registry of connected FDC3 app instances → MessagePorts.
 * Not part of AgentState — ports change on reconnect.
 */
export class AppConnectionRegistry {
  readonly connections = new Map<string, AppConnectionMetadata>()
  readonly messagePortTransports = new Map<string, MessagePortTransport>()
  readonly transportToInstanceId = new Map<MessagePortTransport, string>()

  constructor(private readonly callbacks: AppConnectionRegistryCallbacks) {}

  /** Send outbound DACP/WCP to the app instance identified by message.meta.destination. */
  sendToAppInstance(message: unknown): void {
    if (!isAgentMessage(message)) {
      this.callbacks.logger.warn("Received invalid message from Desktop Agent, ignoring", message)
      return
    }

    const destinationId = extractDestinationInstanceId(message)
    if (!destinationId) {
      this.callbacks.logger.debug("No destinationId, skipping delivery", {
        messageType: message.type,
      })
      return
    }

    if (message.type === "WCP5ValidateAppIdentityResponse") {
      this.deliverWcp5Success(message, destinationId)
      return
    }

    if (message.type === "WCP5ValidateAppIdentityFailedResponse") {
      this.sendOnPort(destinationId, message)
      this.callbacks.disconnectApp(destinationId)
      return
    }

    if (message.type === "channelChangedEvent") {
      this.emitChannelChanged(message)
    }

    this.sendOnPort(destinationId, message)
  }

  sendOnPort(
    instanceId: string,
    message: AgentResponseMessage | AgentEventMessage | WebConnectionProtocolMessage
  ): void {
    const appTransport = this.messagePortTransports.get(instanceId)
    if (!appTransport?.isConnected()) {
      this.callbacks.logger.warn(
        `[AppConnectionRegistry] Cannot send to ${instanceId}: port missing or disconnected`,
        { messageType: message.type }
      )
      return
    }

    try {
      appTransport.send(message)
    } catch (error) {
      this.callbacks.logger.error("[AppConnectionRegistry] Error sending on app MessagePort", {
        instanceId,
        messageType: message.type,
        error,
      })
    }
  }

  private deliverWcp5Success(
    message: AgentResponseMessage | WebConnectionProtocolMessage,
    destinationId: string
  ): void {
    let actualInstanceId: string | undefined
    let appId: string | undefined

    if ("payload" in message && message.payload && typeof message.payload === "object") {
      if ("instanceId" in message.payload && typeof message.payload.instanceId === "string") {
        actualInstanceId = message.payload.instanceId
      }
      if ("appId" in message.payload && typeof message.payload.appId === "string") {
        appId = message.payload.appId
      }
    }

    if (actualInstanceId && appId && destinationId !== actualInstanceId) {
      this.callbacks.updateConnectionMetadata(destinationId, actualInstanceId, appId)
      this.sendOnPort(actualInstanceId, message)
      return
    }

    this.sendOnPort(destinationId, message)
  }

  private emitChannelChanged(
    message: AgentResponseMessage | AgentEventMessage | WebConnectionProtocolMessage
  ): void {
    if (!("payload" in message) || !message.payload || typeof message.payload !== "object") {
      return
    }

    let channelId: string | null | undefined
    let changedInstanceId: string | undefined

    if ("channelId" in message.payload) {
      const ch = message.payload.channelId
      channelId = ch === null || typeof ch === "string" ? ch : undefined
    }
    if (
      "identity" in message.payload &&
      message.payload.identity &&
      typeof message.payload.identity === "object" &&
      "instanceId" in message.payload.identity &&
      typeof message.payload.identity.instanceId === "string"
    ) {
      changedInstanceId = message.payload.identity.instanceId
    }

    if (changedInstanceId) {
      this.callbacks.emit("channelChanged", changedInstanceId, channelId ?? null)
    }
  }
}

function extractDestinationInstanceId(
  message: AgentResponseMessage | AgentEventMessage | WebConnectionProtocolMessage
): string | undefined {
  if (
    "destination" in message.meta &&
    message.meta.destination &&
    typeof message.meta.destination === "object" &&
    "instanceId" in message.meta.destination
  ) {
    return message.meta.destination.instanceId as string | undefined
  }
  return undefined
}
