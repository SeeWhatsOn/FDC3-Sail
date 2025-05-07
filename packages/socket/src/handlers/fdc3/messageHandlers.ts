import { Socket } from "socket.io" // Import Socket
import { FDC3_APP_EVENT } from "../../events" // Import event constant
import { ConnectionState, BaseMessageData } from "../../types"

/**
 * Registers event listeners related to FDC3 App messages.
 */
export function registerMessageHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  /**
   * Handles general FDC3 messages received from connected apps.
   *
   * @param data The message data received.
   * @param from The instanceId of the sender.
   */
  socket.on(FDC3_APP_EVENT, (data: BaseMessageData, from: string) => {
    if (!data?.type?.startsWith("heartbeat")) {
      console.log(
        `[MessageHandler] FDC3 App Event: Type=${data?.type}, From=${from}, Socket=${socket.id}`,
      )
    }

    if (!connectionState.fdc3ServerInstance) {
      console.error(
        `  No server instance found for FDC3_APP_EVENT from ${from} on socket ${socket.id}. ` +
          `Connection state: Type=${connectionState.type}, UserSession=${connectionState.userSessionId}, AppInstance=${connectionState.appInstanceId}`,
      )
      return
    }

    try {
      // Delegate processing to the FDC3 server instance
      connectionState.fdc3ServerInstance.receive(data, from)

      // If the receive method doesn't handle broadcast notifications as a side effect,
      // you might need to explicitly call notifyBroadcastContext here.
      if (data?.type === "broadcastRequest") {
        console.log(`  Broadcast detected from ${from}.`)
        // Example: Uncomment if receive() doesn't handle this notification
        // connectionState.fdc3ServerInstance.serverContext.notifyBroadcastContext(data as BroadcastRequest);
      }
    } catch (e) {
      console.error(
        `  Error processing FDC3_APP_EVENT from ${from} on socket ${socket.id}:`,
        e,
      )
    }
  })
}
