import { Socket } from "socket.io"
import {
  SailIntentResolveOpenChannelArgs,
  SAIL_INTENT_RESOLVE_ON_CHANNEL,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "../../types"
import { LogCategory, logHandlerEvent } from "../../utils/logs"
import { handleOperationError } from "../../utils"

/**
 * Registers event listeners related to Intent resolution actions.
 */
export async function registerIntentHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): Promise<void> {
  try {
    socket.on(
      SAIL_INTENT_RESOLVE_ON_CHANNEL,
      (data: SailIntentResolveOpenChannelArgs, callback) => {
        try {
          logHandlerEvent({
            category: LogCategory.INTENT,
            event: `Intent Resolve on Channel: App ${data.appId} on channel ${data.channel} (Socket: ${socket.id})`,
            context: { appId: data.appId, channel: data.channel },
            subCategory: "Resolve",
          })

          if (!connectionState.fdc3ServerInstance) {
            handleOperationError({
              operation: "SAIL_INTENT_RESOLVE_ON_CHANNEL",
              contextData: { appId: data.appId, channel: data.channel },
              fallbackMessage: "Connection not properly initialized.",
              callback,
              error: new Error("Connection not properly initialized."),
            })
            return
          }

          // Delegate the action to the server context associated with this connection
          logHandlerEvent({
            category: LogCategory.INTENT,
            event: `Delegating openOnChannel for app ${data.appId} on channel ${data.channel}.`,
            context: { appId: data.appId, channel: data.channel },
            subCategory: "Resolve",
          })

          connectionState.fdc3ServerInstance.serverContext.openOnChannel(
            data.appId,
            data.channel,
          )

          // Call callback with success (no parameters means success)
          callback()
        } catch (error) {
          handleOperationError({
            operation: "SAIL_INTENT_RESOLVE_ON_CHANNEL",
            contextData: { appId: data.appId, channel: data.channel },
            fallbackMessage: "Failed to delegate openOnChannel.",
            callback,
            error,
          })
        }
      },
    )
  } catch (error) {
    console.error("Error registering intent handlers:", error)
    throw error
  }
}
