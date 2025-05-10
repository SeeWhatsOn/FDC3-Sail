import {
  SailClientStateArgs,
  ChannelReceiverUpdate,
  CHANNEL_RECEIVER_UPDATE,
  SAIL_CLIENT_STATE,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "../../types"
import { Socket } from "socket.io"
import { LogCategory } from "../../utils/logs"
import { logHandlerEvent } from "../../utils/logs"
import { handleOperationError } from "../../utils/errorHandling"

export async function handleSailClientState(
  state: ConnectionState,
  data: SailClientStateArgs,
  callback: (result: boolean | null, error?: string | undefined) => void,
): Promise<void> {
  logHandlerEvent({
    category: LogCategory.CLIENT_STATE,
    event: `Sail Client State for session ${data.userSessionId} (Socket: ${state.socket.id})`,
    context: { userSessionId: data.userSessionId, socketId: state.socket.id },
  })

  if (!state.fdc3ServerInstance || state.userSessionId !== data.userSessionId) {
    handleOperationError({
      operation: "SAIL_CLIENT_STATE",
      contextData: {
        userSessionId: data.userSessionId,
        socketId: state.socket.id,
      },
      fallbackMessage:
        "Connection not properly initialized or session mismatch.",
      callback,
      error: new Error(
        "Connection not properly initialized or session mismatch.",
      ),
    })
  }

  const { serverContext } = state.fdc3ServerInstance

  try {
    logHandlerEvent({
      category: LogCategory.CLIENT_STATE,
      event: `Updating state for session ${data.userSessionId}: ${data.directories.length} dirs, ${data.customApps.length} custom, ${data.channels.length} chans, ${data.panels.length} panels.`,
      context: {
        userSessionId: data.userSessionId,
        directories: data.directories.length,
        customApps: data.customApps.length,
        channels: data.channels.length,
        panels: data.panels.length,
      },
    })
    serverContext.reloadAppDirectories(data.directories, data.customApps)
    serverContext.updateChannelData(data.channels, data.contextHistory)

    // Handle panel changes (potential channel/title updates)
    for (const panel of data.panels) {
      const appDetailState = serverContext.getAppInstanceDetails(panel.panelId)
      if (appDetailState) {
        let updated = false
        if (panel.tabId !== appDetailState.channel) {
          logHandlerEvent({
            category: LogCategory.CLIENT_STATE,
            event: `Panel ${panel.panelId} channel: ${appDetailState.channel} -> ${panel.tabId}`,
            context: {
              panelId: panel.panelId,
              channel: appDetailState.channel,
              newChannel: panel.tabId,
            },
          })
          appDetailState.channel = panel.tabId // Assuming tabId is channelId
          updated = true
          // Notify the specific app instance directly about its channel change
          if (appDetailState.socket && appDetailState.socket.connected) {
            logHandlerEvent({
              category: LogCategory.CLIENT_STATE,
              event: `Emitting channel-changed event to ${panel.panelId}`,
              context: {
                panelId: panel.panelId,
                channel: panel.tabId,
              },
            })
            appDetailState.socket.emit("channel-changed", {
              channel: panel.tabId,
            }) // Use appropriate event name/payload
          }
        }
        if (panel.title !== appDetailState.instanceTitle) {
          logHandlerEvent({
            category: LogCategory.CLIENT_STATE,
            event: `Panel ${panel.panelId} title: "${appDetailState.instanceTitle}" -> "${panel.title}"`,
            context: {
              panelId: panel.panelId,
              oldTitle: appDetailState.instanceTitle,
              newTitle: panel.title,
            },
          })
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
        const updateMsg: ChannelReceiverUpdate = { tabs: data.channels }
        logHandlerEvent({
          category: LogCategory.CLIENT_STATE,
          event: `Sending CHANNEL_RECEIVER_UPDATE to ${app.instanceId} (${appDetailState.channelSockets.length} sockets)`,
          context: {
            instanceId: app.instanceId,
            socketCount: appDetailState.channelSockets.length,
          },
        })
        const originalSocketCount = appDetailState.channelSockets.length
        appDetailState.channelSockets = appDetailState.channelSockets.filter(
          (channelSocket: Socket) => {
            if (channelSocket.connected) {
              channelSocket.emit(CHANNEL_RECEIVER_UPDATE, updateMsg)
              return true // Keep connected socket
            }
            console.warn(
              `  Channel socket ${channelSocket.id} for ${app.instanceId} disconnected, removing.`,
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
    handleOperationError({
      operation: "SAIL_CLIENT_STATE",
      contextData: {
        userSessionId: data.userSessionId,
        socketId: state.socket.id,
      },
      fallbackMessage: "Failed to process client state.",
      callback,
      error,
    })
  }
}

/**
 * Registers event listeners related to client state synchronization.
 */
export function registerClientStateHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(SAIL_CLIENT_STATE, async (data: SailClientStateArgs, callback) => {
    logHandlerEvent({
      category: LogCategory.CLIENT_STATE,
      event: `Received SAIL_CLIENT_STATE for session ${data.userSessionId}`,
      context: { userSessionId: data.userSessionId },
    })
    try {
      await handleSailClientState(connectionState, data, callback)
    } catch (error) {
      handleOperationError({
        operation: "SAIL_CLIENT_STATE",
        contextData: { userSessionId: data.userSessionId, socketId: socket.id },
        fallbackMessage:
          "Failed to process client state. Internal server error handling SAIL_CLIENT_STATE",
        callback,
        error,
      })
    }
  })
}
