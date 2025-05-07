import { Socket } from "socket.io" // Import Socket
import { ConnectionState } from "./types"
import { FDC3_APP_EVENT } from "../events" // Import event constant

/**
 * Handles general FDC3 messages received from connected apps.
 *
 * @param state The connection state associated with the emitting socket.
 * @param data The message data received.
 * @param from The instanceId of the sender.
 */
export function processAppMessage(
  state: ConnectionState,
  data: any,
  from: string,
): void {
  if (!data?.type?.startsWith("heartbeat")) {
    console.log(
      `[MessageHandler] FDC3 App Event: Type=${data?.type}, From=${from}, Socket=${state.socket.id}`,
    )
  }

  if (state.fdc3ServerInstance) {
    try {
      // Delegate processing to the FDC3 server instance
      state.fdc3ServerInstance.receive(data, from)

      // If the receive method doesn't handle broadcast notifications as a side effect,
      // you might need to explicitly call notifyBroadcastContext here.
      if (data?.type === "broadcastRequest") {
        console.log(`  Broadcast detected from ${from}.`)
        // Example: Uncomment if receive() doesn't handle this notification
        // state.fdc3ServerInstance.serverContext.notifyBroadcastContext(data as BroadcastRequest);
      }
    } catch (e) {
      console.error(
        `  Error processing FDC3_APP_EVENT from ${from} on socket ${state.socket.id}:`,
        e,
      )
    }
  } else {
    // This scenario might occur if an app sends messages before its APP_HELLO
    // is fully processed, or if the associated DA session has terminated.
    console.warn(
      `  No server instance found for FDC3_APP_EVENT from ${from} on socket ${state.socket.id}. ` +
        `Connection state: Type=${state.type}, UserSession=${state.userSessionId}, AppInstance=${state.appInstanceId}`,
    )
  }
}

/**
 * Registers event listeners related to FDC3 App messages.
 */
export function registerMessageHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(FDC3_APP_EVENT, (data: any, from: string) => {
    processAppMessage(connectionState, data, from)
    // Note: No explicit error handling here in the original main.ts,
    // processAppMessage handles internal errors.
  })
}
