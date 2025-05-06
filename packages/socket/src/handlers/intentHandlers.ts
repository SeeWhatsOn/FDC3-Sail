import { Socket } from "socket.io"
import {
  SailIntentResolveOpenChannelArgs,
  SAIL_INTENT_RESOLVE_ON_CHANNEL,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "./connectionState"
// Potential imports if needed later
// import { SailFDC3Server } from "./da/SailFDC3Server";
// import { SailServerContext } from "./da/SailServerContext";

/**
 * Handles requests to resolve/open an app directly on a specific channel,
 * typically triggered after intent resolution.
 *
 * @param state The connection state associated with the initiating socket (likely the DA).
 * @param props The arguments containing appId and channelId.
 * @param callback The callback function to acknowledge completion or report errors.
 */
export function handleIntentResolveOnChannel(
  state: ConnectionState,
  props: SailIntentResolveOpenChannelArgs,
  callback: (success?: void, err?: string) => void,
): void {
  console.log(
    `[IntentHandler] Intent Resolve on Channel: App ${props.appId} on channel ${props.channel} (Socket: ${state.socket.id})`,
  )

  if (!state.fdc3ServerInstance) {
    console.error(
      "  Cannot handle SAIL_INTENT_RESOLVE_ON_CHANNEL: Missing server instance on connection state.",
    )
    return callback(undefined, "Connection not properly initialized.")
  }

  try {
    // Delegate the action to the server context associated with this connection
    console.log(
      `  Delegating openOnChannel for app ${props.appId} on channel ${props.channel}.`,
    )
    state.fdc3ServerInstance.serverContext.openOnChannel(
      props.appId,
      props.channel,
    )
    callback() // Indicate success (void)
  } catch (error) {
    console.error(
      `  Error handling SAIL_INTENT_RESOLVE_ON_CHANNEL for app ${props.appId}:`,
      error,
    )
    callback(
      undefined,
      (error as Error).message || "Failed to open app on specified channel.",
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
    (props: SailIntentResolveOpenChannelArgs, callback) => {
      console.log(
        `[IntentHandler Register] Received SAIL_INTENT_RESOLVE_ON_CHANNEL for app ${props.appId} on channel ${props.channel}`,
      )
      try {
        handleIntentResolveOnChannel(connectionState, props, callback)
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
