import { Socket } from "socket.io"
import {
  SailIntentResolveOpenChannelArgs,
  SAIL_INTENT_RESOLVE_ON_CHANNEL,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "../../types"

/**
 * Handles requests to resolve/open an app directly on a specific channel,
 * typically triggered after intent resolution.
 *
 * @param state The connection state associated with the initiating socket (likely the DA).
 * @param props The arguments containing appId and channelId.
 * @param callback The callback function to acknowledge completion or report errors.
 */
export async function resolveIntentOnChannel(
  state: ConnectionState,
  props: SailIntentResolveOpenChannelArgs,
): Promise<string | void> {
  try {
    console.log(
      `[IntentHandler] Intent Resolve on Channel: App ${props.appId} on channel ${props.channel} (Socket: ${state.socket.id})`,
    )

    if (!state.fdc3ServerInstance) {
      console.error(
        "  Cannot handle SAIL_INTENT_RESOLVE_ON_CHANNEL: Missing server instance on connection state.",
      )
      throw new Error("Connection not properly initialized.")
    }
    // Delegate the action to the server context associated with this connection
    console.log(
      `  Delegating openOnChannel for app ${props.appId} on channel ${props.channel}.`,
    )
    state.fdc3ServerInstance.serverContext.openOnChannel(
      props.appId,
      props.channel,
    )
    return
  } catch (error) {
    console.error(
      `  Error handling SAIL_INTENT_RESOLVE_ON_CHANNEL for app ${props.appId}:`,
      error,
    )
    return (
      (error as Error).message || "Failed to open app on specified channel."
    )
  }
}

/**
 * Registers event listeners related to Intent resolution actions.
 */
export function registerIntentHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(
    SAIL_INTENT_RESOLVE_ON_CHANNEL,
    async (
      props: SailIntentResolveOpenChannelArgs,
      callback: (success?: void, err?: string) => void,
    ) => {
      console.log(
        `[IntentHandler Register] Received SAIL_INTENT_RESOLVE_ON_CHANNEL for app ${props.appId} on channel ${props.channel}`,
      )
      try {
        //! ideally should confirm that the app is open on the channel
        await resolveIntentOnChannel(connectionState, props)
      } catch (err) {
        console.error(
          `Unexpected error calling handleIntentResolveOnChannel for socket ${socket.id}:`,
          err,
        )
        callback(
          undefined,
          "Internal server error during intent resolve on channel.",
        )
      }
    },
  )
}
