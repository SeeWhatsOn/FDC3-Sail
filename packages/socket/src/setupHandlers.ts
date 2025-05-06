import { Socket } from "socket.io"
import { ConnectionState } from "./handlers/connectionState"
import { registerDaHandlers } from "./handlers/daHandlers"
import { registerAppHandlers } from "./handlers/appHandlers"
import { registerElectronHandlers } from "./handlers/electronHandlers"
import { registerClientStateHandlers } from "./handlers/clientStateHandlers"
import { registerChannelHandlers } from "./handlers/channelHandlers"
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
export function setupAllHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  console.log(`Setting up all handlers for socket ${socket.id}`)

  // Call registration functions from each handler module
  registerDaHandlers(socket, connectionState)
  registerAppHandlers(socket, connectionState)
  registerElectronHandlers(socket, connectionState)
  registerClientStateHandlers(socket, connectionState)
  registerChannelHandlers(socket, connectionState)
  registerMessageHandlers(socket, connectionState)
  registerIntentHandlers(socket, connectionState)
  registerLifecycleHandlers(socket, connectionState)
}
