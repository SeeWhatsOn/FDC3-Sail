import { SailMessages } from "../../protocol/sail-messages";
import { DACPMessage, processDACPMessage, appInstanceRegistry, intentRegistry } from "@finos/fdc3-sail-desktop-agent";
import { HandlerContext, LogLevel, CONFIG } from "../types";

const logger = {
    error: (message: string, ...args: unknown[]) => {
      console.error(`[${LogLevel.ERROR}] ${message}`, ...args)
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`[${LogLevel.WARN}] ${message}`, ...args)
    },
    info: (message: string, ...args: unknown[]) => {
      console.log(`[${LogLevel.INFO}] ${message}`, ...args)
    },
    debug: (message: string, ...args: unknown[]) => {
      if (CONFIG.DEBUG_MODE) {
        console.log(`[${LogLevel.DEBUG}] ${message}`, ...args)
      }
    },
  }

/**
 * Routes DACP messages from the socket to the transport-agnostic DACP processor.
 * @param dacpMessage - The DACP message to route.
 * @param sourceId - Source identifier for the message.
 * @param context - Handler context with connection state.
 */
async function routeDACPMessage(
  dacpMessage: DACPMessage,
  sourceId: string,
  context: HandlerContext
): Promise<void> {
  const { socket, connectionState } = context

  if (!connectionState.fdc3ServerInstance) {
    logger.error("No server instance available for DACP message")
    return
  }

  const fdc3ServerInstance = connectionState.fdc3ServerInstance!
  const { serverContext } = fdc3ServerInstance

  // The context for the DACP engine, without transport-specific details.
  const dacpContext = {
    instanceId: sourceId,
    serverContext: serverContext,
    fdc3Server: fdc3ServerInstance,
    appInstanceRegistry,
    intentRegistry,
  }

  // The reply function that sends a message back over the socket.
  const reply = (response: any) => {
    socket.emit(SailMessages.FDC3_EVENT, response)
  }

  await processDACPMessage(dacpMessage, dacpContext, reply)
}


/**
 * Registers FDC3-specific socket handlers
 */
export function registerFdc3Handlers(context: HandlerContext): void {
  const { socket } = context

  // Register single fdc3_event handler for all DACP messages (Socket.IO best practice)
  socket.on(SailMessages.FDC3_EVENT, async (dacpMessage: DACPMessage, sourceId: string) => {
    await routeDACPMessage(dacpMessage, sourceId, context)
  })
}
