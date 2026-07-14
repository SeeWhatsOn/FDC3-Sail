/**
 * Browser-resident FDC3 app connection listener.
 *
 * Owns WCP1–3 handshake, MessagePort registry, and minimal WCP4/5 identity validation.
 * DACP traffic (after identity) is forwarded via {@link onAppMessage}.
 */

import { noopLogger, type Logger } from "./logger"
import { MessagePortTransport } from "./message-port"
import { AppConnectionRegistry } from "./app-connection-registry"
import { handleWcp1Hello } from "./wcp/handle-wcp1-hello"
import { handleWcp4ValidateAppIdentity } from "./wcp/handle-wcp4-identity"
import {
  isAppMessage,
  isWCP1Hello,
  isWCP4ValidateAppIdentity,
  isWCP6Goodbye,
  type AppConnectionMetadata,
  type AppConnectionOptions,
  type WCP1HelloMessage,
} from "./wcp/wcp-types"

export type AppMessageHandler = (
  message: unknown,
  instanceId: string,
) => void | Promise<void>

type AppConnectionEventMap = {
  appConnected: (metadata: AppConnectionMetadata) => void
  appDisconnected: (instanceId: string) => void
  handshakeFailed: (error: Error, connectionAttemptUuid: string) => void
}

export class BrowserAppConnection {
  readonly connectionRegistry: AppConnectionRegistry

  private readonly options: {
    getApps: AppConnectionOptions["getApps"]
    fdc3Version: string
    handshakeTimeout: number
    provider: string
    providerVersion?: string
    logger: Logger
    resolveHostIdentifier?: (source: Window) => string | undefined
    adoptInstanceId?: AppConnectionOptions["adoptInstanceId"]
  }

  private isStarted = false
  private messageTarget?: Window | EventTarget
  private appMessageHandler?: AppMessageHandler
  private readonly boundHandleWindowMessage =
    this.handleWindowMessage.bind(this)
  private readonly listeners: {
    [K in keyof AppConnectionEventMap]: Set<AppConnectionEventMap[K]>
  } = {
    appConnected: new Set(),
    appDisconnected: new Set(),
    handshakeFailed: new Set(),
  }

  constructor(options: AppConnectionOptions) {
    this.options = {
      getApps: options.getApps,
      fdc3Version: options.fdc3Version ?? "2.2",
      handshakeTimeout: options.handshakeTimeout ?? 5000,
      provider: options.provider ?? "sail-desktop-agent",
      providerVersion: options.providerVersion,
      logger: options.logger ?? noopLogger,
      resolveHostIdentifier: options.resolveHostIdentifier,
      adoptInstanceId: options.adoptInstanceId,
    }

    this.connectionRegistry = new AppConnectionRegistry({
      logger: this.options.logger,
      disconnectApp: (instanceId) => this.disconnectApp(instanceId),
    })
  }

  onAppMessage(handler: AppMessageHandler): void {
    this.appMessageHandler = handler
  }

  on<E extends keyof AppConnectionEventMap>(
    event: E,
    handler: AppConnectionEventMap[E],
  ): void {
    this.listeners[event].add(handler)
  }

  off<E extends keyof AppConnectionEventMap>(
    event: E,
    handler: AppConnectionEventMap[E],
  ): void {
    this.listeners[event].delete(handler)
  }

  getConnection(instanceId: string): AppConnectionMetadata | undefined {
    return this.connectionRegistry.getConnection(instanceId)
  }

  getConnections(): AppConnectionMetadata[] {
    return this.connectionRegistry.getConnections()
  }

  sendToAppInstance(instanceId: string, message: unknown): void {
    this.connectionRegistry.sendOnPort(instanceId, message)
  }

  /**
   * Start listening for WCP1Hello on `messageTarget` (defaults to `window`).
   * Tests may pass an EventTarget stand-in.
   */
  start(messageTarget?: Window | EventTarget): void {
    if (this.isStarted) {
      throw new Error("BrowserAppConnection is already started")
    }

    const target =
      messageTarget ?? (typeof window !== "undefined" ? window : undefined)

    if (!target) {
      throw new Error("BrowserAppConnection requires a browser environment")
    }

    this.messageTarget = target
    target.addEventListener(
      "message",
      this.boundHandleWindowMessage as EventListener,
    )
    this.isStarted = true
  }

  stop(): void {
    if (!this.isStarted) {
      return
    }

    if (this.messageTarget) {
      this.messageTarget.removeEventListener(
        "message",
        this.boundHandleWindowMessage as EventListener,
      )
      this.messageTarget = undefined
    }

    for (const [instanceId] of this.connectionRegistry.connections) {
      this.disconnectApp(instanceId, { emit: false })
    }

    this.isStarted = false
  }

  disconnectApp(instanceId: string, options?: { emit?: boolean }): void {
    const removed = this.connectionRegistry.remove(instanceId)
    if (removed && options?.emit !== false) {
      this.emit("appDisconnected", instanceId)
    }
  }

  private handleWindowMessage(event: Event): void {
    const messageEvent = event as MessageEvent
    if (!isWCP1Hello(messageEvent.data)) {
      return
    }

    try {
      handleWcp1Hello(messageEvent as MessageEvent<WCP1HelloMessage>, {
        connectionRegistry: this.connectionRegistry,
        options: this.options,
        logger: this.options.logger,
        disconnectApp: (instanceId) => this.disconnectApp(instanceId),
        emitHandshakeFailed: (error, connectionAttemptUuid) => {
          this.emit("handshakeFailed", error, connectionAttemptUuid)
        },
        bridgeAppPort: (transport) => {
          this.bridgeAppPort(transport)
        },
      })
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.options.logger.error("Error handling WCP1Hello:", error)
      const uuid =
        typeof messageEvent.data?.meta?.connectionAttemptUuid === "string"
          ? messageEvent.data.meta.connectionAttemptUuid
          : "unknown"
      this.emit("handshakeFailed", error, uuid)
    }
  }

  private bridgeAppPort(transport: MessagePortTransport): void {
    transport.onMessage((message: unknown) => {
      if (!isAppMessage(message)) {
        this.options.logger.warn(
          "Received invalid message from app, ignoring",
          message,
        )
        return
      }

      const currentInstanceId =
        this.connectionRegistry.transportToInstanceId.get(transport)
      if (!currentInstanceId) {
        this.options.logger.warn(
          "Cannot route message: transport not found in reverse lookup",
        )
        return
      }

      if (isWCP6Goodbye(message)) {
        this.disconnectApp(currentInstanceId)
        return
      }

      if (isWCP4ValidateAppIdentity(message)) {
        handleWcp4ValidateAppIdentity(message, {
          connectionRegistry: this.connectionRegistry,
          tempInstanceId: currentInstanceId,
          getApps: this.options.getApps,
          fdc3Version: this.options.fdc3Version,
          provider: this.options.provider,
          providerVersion: this.options.providerVersion,
          logger: this.options.logger,
          disconnectApp: (id) => this.disconnectApp(id),
          onValidated: (metadata) => this.emit("appConnected", metadata),
          adoptInstanceId: this.options.adoptInstanceId,
        })
        return
      }

      if (!this.appMessageHandler) {
        return
      }

      void Promise.resolve(
        this.appMessageHandler(message, currentInstanceId),
      ).catch((error) => {
        this.options.logger.error("Error ingesting app message:", error)
      })
    })

    transport.onDisconnect(() => {
      const currentInstanceId =
        this.connectionRegistry.transportToInstanceId.get(transport)
      if (currentInstanceId) {
        this.disconnectApp(currentInstanceId)
      }
    })
  }

  private emit<E extends keyof AppConnectionEventMap>(
    event: E,
    ...args: Parameters<AppConnectionEventMap[E]>
  ): void {
    for (const handler of this.listeners[event]) {
      try {
        ;(handler as (...a: unknown[]) => void)(...(args as unknown[]))
      } catch (error) {
        this.options.logger.error(`Error in ${event} listener:`, error)
      }
    }
  }
}
