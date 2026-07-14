/**
 * MessagePort transport for WCP / DACP browser app connections (FDC3 2.2 WCP).
 */

import { noopLogger, type Logger } from "./logger"

type MessageHandler = (message: unknown) => void | Promise<void>
type DisconnectHandler = () => void

export type MessagePortTransportOptions = {
  logger?: Logger
}

export class MessagePortTransport {
  private readonly port: MessagePort
  private readonly logger: Logger
  private messageHandler?: MessageHandler
  private disconnectHandler?: DisconnectHandler
  private connected = true
  private portDisposed = false
  private readonly boundHandleMessage = this.handleMessage.bind(this)
  private readonly boundHandleError = this.handleError.bind(this)

  constructor(port: MessagePort, options?: MessagePortTransportOptions) {
    if (typeof MessagePort === "undefined") {
      throw new Error(
        "MessagePort is not available (browser environment required)",
      )
    }

    this.port = port
    this.logger = options?.logger ?? noopLogger
    this.port.start()
    this.port.addEventListener("message", this.boundHandleMessage)
    this.port.addEventListener("messageerror", this.boundHandleError)
  }

  send(message: unknown): void {
    if (!this.connected) {
      throw new Error("Cannot send message: MessagePort is disconnected")
    }

    try {
      this.port.postMessage(message)
    } catch (error) {
      this.logger.error("[MessagePortTransport] Error sending message:", error)
      this.handleDisconnect()
      throw error
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect(): void {
    if (this.portDisposed && !this.connected) {
      return
    }

    const wasConnected = this.connected
    this.connected = false
    this.disposePort()

    if (wasConnected) {
      this.notifyDisconnectHandler()
    }
  }

  private disposePort(): void {
    if (this.portDisposed) {
      return
    }
    this.portDisposed = true
    this.port.removeEventListener("message", this.boundHandleMessage)
    this.port.removeEventListener("messageerror", this.boundHandleError)
    this.port.close()
  }

  private notifyDisconnectHandler(): void {
    if (!this.disconnectHandler) {
      return
    }
    try {
      this.disconnectHandler()
    } catch (error) {
      this.logger.error(
        "[MessagePortTransport] Error in disconnect handler:",
        error,
      )
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (!this.connected || !this.messageHandler) {
      return
    }
    void this.messageHandler(event.data)
  }

  private handleError(event: MessageEvent): void {
    this.logger.error(
      "[MessagePortTransport] messageerror on MessagePort:",
      event.data,
    )
  }

  private handleDisconnect(): void {
    if (!this.connected) {
      return
    }
    this.connected = false
    this.disposePort()
    this.notifyDisconnectHandler()
  }
}
