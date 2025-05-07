import { Socket } from "socket.io"
import {
  SailIntentResolveOpenChannelArgs,
  SAIL_INTENT_RESOLVE_ON_CHANNEL,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "../../types"

/**
 * Registers event listeners related to Intent resolution actions.
 */
export function registerIntentHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(
    SAIL_INTENT_RESOLVE_ON_CHANNEL,
    (
      data: SailIntentResolveOpenChannelArgs,
      callback: (success?: void, err?: string) => void,
    ) => {
      try {
        console.log(
          `[IntentHandler] Intent Resolve on Channel: App ${data.appId} on channel ${data.channel} (Socket: ${socket.id})`,
        )

        if (!connectionState.fdc3ServerInstance) {
          const errorMsg = "Connection not properly initialized."
          console.error(
            `  Cannot handle SAIL_INTENT_RESOLVE_ON_CHANNEL: Missing server instance on connection state.`,
          )
          callback(undefined, errorMsg)
          return
        }

        // Delegate the action to the server context associated with this connection
        console.log(
          `  Delegating openOnChannel for app ${data.appId} on channel ${data.channel}.`,
        )

        connectionState.fdc3ServerInstance.serverContext.openOnChannel(
          data.appId,
          data.channel,
        )

        // Call callback with success (no parameters means success)
        callback()
      } catch (error) {
        console.error(
          `  Error handling SAIL_INTENT_RESOLVE_ON_CHANNEL for app ${data.appId}:`,
          error,
        )
        callback(
          undefined,
          (error as Error).message ||
            "Failed to open app on specified channel.",
        )
      }
    },
  )
}
