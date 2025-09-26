/**
 * Dual Protocol Handler - Manages both DACP (MessagePort) and Sail (Socket.IO) protocols
 */

import { Socket } from "socket.io"
import {
  registerDACPHandlers,
  cleanupDACPHandlers,
  DACPHandlerContext,
} from "@finos/fdc3-sail-desktop-agent"
import {
  registerDesktopAgentHandlers,
  registerAppHandlers,
  registerChannelHandlers,
  registerDisconnectHandler,
  HandlerContext as SailHandlerContext,
} from "./handlers"

export interface DualProtocolConfig {
  enableDACP: boolean
  enableSailSocket: boolean
  messagePortFactory?: () => MessageChannel
}

export interface DualProtocolContext {
  sailContext: SailHandlerContext
  dacpContext?: DACPHandlerContext
  config: DualProtocolConfig
  messagePortChannel?: MessageChannel
  dacpEnabled: boolean
  sailEnabled: boolean
}

export class DualProtocolHandler {
  private contexts = new Map<string, DualProtocolContext>()
  private defaultConfig: DualProtocolConfig = {
    enableDACP: true,
    enableSailSocket: true,
  }

  registerHandlers(socket: Socket, config: Partial<DualProtocolConfig> = {}): DualProtocolContext {
    const fullConfig = { ...this.defaultConfig, ...config }
    const socketId = socket.id

    console.info(`Registering dual protocol handlers for socket: ${socketId}`, {
      dacpEnabled: fullConfig.enableDACP,
      sailEnabled: fullConfig.enableSailSocket,
    })

    const sailContext: SailHandlerContext = {
      socket,
      connectionState: {},
    }

    const context: DualProtocolContext = {
      sailContext,
      config: fullConfig,
      dacpEnabled: false,
      sailEnabled: false,
    }

    if (fullConfig.enableSailSocket) {
      this.registerSailHandlers(sailContext)
      context.sailEnabled = true
      console.info(`Sail Socket.IO handlers registered for: ${socketId}`)
    }

    if (fullConfig.enableDACP) {
      this.registerDACPHandlersForSocket(socket, context)
    }

    this.contexts.set(socketId, context)

    socket.on("disconnect", () => {
      this.cleanup(socketId)
    })

    return context
  }

  private registerDACPHandlersForSocket(socket: Socket, context: DualProtocolContext): void {
    const socketId = socket.id

    // Allow for custom properties on the socket object by casting to a more specific type.
    type CustomSocket = Socket & { userId?: string }

    socket.on("dacp:init", (callback: (port: MessagePort) => void) => {
      try {
        const channel = new MessageChannel()
        context.messagePortChannel = channel

        const fdc3ServerInstance = context.sailContext.connectionState.fdc3ServerInstance
        const serverContext = fdc3ServerInstance?.serverContext

        if (!fdc3ServerInstance || !serverContext) {
          console.warn(
            `Cannot register DACP handlers - missing FDC3 server for socket: ${socketId}`
          )
          return
        }

        context.dacpContext = {
          messagePort: channel.port1,
          serverContext: serverContext,
          fdc3Server: fdc3ServerInstance,
          socket: socket,
          connectionState: {
            authenticated: true,
            userId: (socket as CustomSocket).userId || "dacp-user",
            socketType: undefined,
          },
        }

        registerDACPHandlers(channel.port1, serverContext, fdc3ServerInstance)

        context.dacpEnabled = true
        console.info(`DACP handlers registered for socket: ${socketId}`)

        callback(channel.port2)
      } catch (error) {
        console.error(`Failed to initialize DACP for socket ${socketId}:`, error)
      }
    })
  }

  private registerSailHandlers(context: SailHandlerContext): void {
    registerDesktopAgentHandlers(context)
    registerAppHandlers(context)
    registerChannelHandlers(context)
    registerDisconnectHandler(context)
  }

  private cleanup(socketId: string): void {
    const context = this.contexts.get(socketId)
    if (!context) return

    console.info(`Cleaning up dual protocol handlers for socket: ${socketId}`)

    if (context.dacpEnabled && context.dacpContext) {
      try {
        cleanupDACPHandlers(socketId)
        if (context.messagePortChannel) {
          context.messagePortChannel.port1.close()
          context.messagePortChannel.port2.close()
        }
        console.debug(`DACP cleanup completed for socket: ${socketId}`)
      } catch (error) {
        console.error(`Error during DACP cleanup for socket ${socketId}:`, error)
      }
    }

    this.contexts.delete(socketId)
    console.debug(`Context cleanup completed for socket: ${socketId}`)
  }
}

export const dualProtocolHandler = new DualProtocolHandler()
