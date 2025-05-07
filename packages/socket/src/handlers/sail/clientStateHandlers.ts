import {
  SailClientStateArgs,
  ChannelReceiverUpdate,
  CHANNEL_RECEIVER_UPDATE,
  SAIL_CLIENT_STATE,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "../../types"
import { Socket } from "socket.io"

export async function handleSailClientState(
  state: ConnectionState,
  props: SailClientStateArgs,
  callback: (success: boolean, err?: string) => void,
): Promise<void> {
  console.log(
    `[ClientStateHandler] Sail Client State for session ${props.userSessionId} (Socket: ${state.socket.id})`,
  )

  if (
    !state.fdc3ServerInstance ||
    state.userSessionId !== props.userSessionId
  ) {
    console.error(
      "  Cannot handle SAIL_CLIENT_STATE: Mismatched session or missing server instance.",
    )
    return callback(
      false,
      "Connection not properly initialized or session mismatch.",
    )
  }

  const { serverContext } = state.fdc3ServerInstance

  try {
    console.log(
      `  Updating state for session ${props.userSessionId}: ${props.directories.length} dirs, ${props.customApps.length} custom, ${props.channels.length} chans, ${props.panels.length} panels.`,
    )
    serverContext.reloadAppDirectories(props.directories, props.customApps)
    serverContext.updateChannelData(props.channels, props.contextHistory)

    // Handle panel changes (potential channel/title updates)
    for (const panel of props.panels) {
      const appDetailState = serverContext.getAppInstanceDetails(panel.panelId)
      if (appDetailState) {
        let updated = false
        if (panel.tabId !== appDetailState.channel) {
          console.log(
            `  Panel ${panel.panelId} channel: ${appDetailState.channel} -> ${panel.tabId}`,
          )
          appDetailState.channel = panel.tabId // Assuming tabId is channelId
          updated = true
          // Notify the specific app instance directly about its channel change
          if (appDetailState.socket && appDetailState.socket.connected) {
            console.log(` Emitting channel-changed event to ${panel.panelId}`)
            appDetailState.socket.emit("channel-changed", {
              channel: panel.tabId,
            }) // Use appropriate event name/payload
          }
        }
        if (panel.title !== appDetailState.instanceTitle) {
          console.log(
            `  Panel ${panel.panelId} title: "${appDetailState.instanceTitle}" -> "${panel.title}"`,
          )
          appDetailState.instanceTitle = panel.title
          updated = true
        }

        if (updated) {
          serverContext.setAppInstanceDetails(panel.panelId, appDetailState)
        }
      } else {
        console.warn(
          `SAIL_CLIENT_STATE: Panel ${panel.panelId} has no corresponding app state.`,
        )
      }
    }

    // Notify connected channel selectors about the updated list of channels
    const connectedApps = await serverContext.getActiveAppInstances()
    for (const app of connectedApps) {
      const appDetailState = serverContext.getAppInstanceDetails(app.instanceId)
      if (
        appDetailState &&
        appDetailState.channelSockets &&
        appDetailState.channelSockets.length > 0
      ) {
        const updateMsg: ChannelReceiverUpdate = { tabs: props.channels }
        console.log(
          `  Sending CHANNEL_RECEIVER_UPDATE to ${app.instanceId} (${appDetailState.channelSockets.length} sockets)`,
        )
        const originalSocketCount = appDetailState.channelSockets.length
        appDetailState.channelSockets = appDetailState.channelSockets.filter(
          (chanSocket) => {
            if (chanSocket.connected) {
              chanSocket.emit(CHANNEL_RECEIVER_UPDATE, updateMsg)
              return true // Keep connected socket
            }
            console.warn(
              `  Channel socket ${chanSocket.id} for ${app.instanceId} disconnected, removing.`,
            )
            return false // Remove disconnected socket
          },
        )
        // If sockets were removed, update the instance details
        if (appDetailState.channelSockets.length < originalSocketCount) {
          serverContext.setAppInstanceDetails(app.instanceId, appDetailState)
        }
      }
    }

    callback(true)
  } catch (error) {
    console.error(
      `  Error in SAIL_CLIENT_STATE for session ${props.userSessionId}:`,
      error,
    )
    callback(
      false,
      (error as Error).message || "Failed to process client state.",
    )
  }
}

/**
 * Registers event listeners related to client state synchronization.
 */
export function registerClientStateHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(SAIL_CLIENT_STATE, (props: SailClientStateArgs, callback) => {
    console.log(
      `[ClientStateHandler Register] Received SAIL_CLIENT_STATE for session ${props.userSessionId}`,
    )
    handleSailClientState(connectionState, props, callback).catch(
      (err: Error) => {
        console.error(
          `Error in SAIL_CLIENT_STATE handler for socket ${socket.id}:`,
          err,
        )
        callback(false, "Internal server error handling SAIL_CLIENT_STATE")
      },
    )
  })
}
