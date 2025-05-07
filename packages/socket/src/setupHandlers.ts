import { Socket } from "socket.io"
import { ConnectionState } from "./handlers/types"
import { registerDesktopAgentHandlers } from "./handlers/fdc3/daHandlers"
import { registerAppHandlers } from "./handlers/appHandlers"
import { registerElectronHandlers } from "./handlers/electronHandlers"
import { registerClientStateHandlers } from "./handlers/sail/clientStateHandlers"
import { registerChannelHandlers } from "./handlers/fdc3/channelHandlers"
import { registerMessageHandlers } from "./handlers/messageHandlers"
import { registerIntentHandlers } from "./handlers/intentHandlers"
import { registerLifecycleHandlers } from "./handlers/lifecycleHandlers"

/**
 * Sets up all event listeners for a new socket connection
 * by delegating to specific handler registration functions.
 *
 * @param socket The newly connected socket instance.
 * @param connectionState The state object associated with this connection.
 */
export function registerAllSocketHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  console.log(`Setting up all handlers for socket ${socket.id}`)

  // Call registration functions from each handler module
  registerDesktopAgentHandlers(socket, connectionState)
  registerAppHandlers(socket, connectionState)
  registerElectronHandlers(socket, connectionState)
  registerClientStateHandlers(socket, connectionState)
  registerChannelHandlers(socket, connectionState)
  registerMessageHandlers(socket, connectionState)
  registerIntentHandlers(socket, connectionState)
  registerLifecycleHandlers(socket, connectionState)
}
