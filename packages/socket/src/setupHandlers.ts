import { Socket } from "socket.io"
import { ConnectionState } from "./types"
import { registerDesktopAgentHandlers } from "./handlers/fdc3/desktopAgentHandlers"
import { registerAppHandlers } from "./handlers/fdc3/appHandlers"
import { registerElectronHandlers } from "./handlers/sail/electronHandlers"
import { registerClientStateHandlers } from "./handlers/sail/clientStateHandlers"
import { registerChannelHandlers } from "./handlers/fdc3/channelHandlers"
import { registerMessageHandlers } from "./handlers/fdc3/messageHandlers"
import { registerIntentHandlers } from "./handlers/fdc3/intentHandlers"
import { registerLifecycleHandlers } from "./handlers/lifecycleHandlers"

/**
 * Sets up all event listeners for a new socket connection
 * by delegating to specific handler registration functions.
 *
 * @param socket The newly connected socket instance.
 * @param connectionState The state object associated with this connection.
 */
export async function registerAllSocketHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): Promise<void> {
  console.log(`Setting up all handlers for socket ${socket.id}`)

  Promise.all([
    registerDesktopAgentHandlers(socket, connectionState),
    registerAppHandlers(socket, connectionState),
    registerElectronHandlers(socket, connectionState),
    registerClientStateHandlers(socket, connectionState),
    registerChannelHandlers(socket, connectionState),
    registerMessageHandlers(socket, connectionState),
    registerIntentHandlers(socket, connectionState),
    registerLifecycleHandlers(socket, connectionState),
  ])
    .then(() => {
      console.log(`All handlers registered for socket ${socket.id}`)
    })
    .catch((error) => {
      console.error(
        `Error registering handlers for socket ${socket.id}:`,
        error,
      )
    })
}
