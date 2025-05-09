import {
  SailChannelChangeArgs,
  ChannelReceiverHelloRequest,
  ChannelReceiverUpdate,
  TabDetail, // Needed for getTabs()
  SAIL_CHANNEL_CHANGE,
  CHANNEL_RECEIVER_HELLO,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "../../types"
import { SocketType, getOrAwaitFdc3Server } from "../utils"
import { v4 as uuid } from "uuid"
import { BrowserTypes } from "@finos/fdc3"
import { Socket } from "socket.io"

function handleSailChannelChange(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(
    SAIL_CHANNEL_CHANGE,
    async (
      data: SailChannelChangeArgs,
      callback: (success: boolean, err?: string) => void,
    ) => {
      console.log(
        `[ChannelHandler Register] Received SAIL_CHANNEL_CHANGE for instance ${data.instanceId} to channel ${data.channel}`,
      )
      console.log(
        `[ChannelHandler] Sail Channel Change: Instance ${data.instanceId} to channel ${data.channel} (Socket: ${connectionState.socket.id})`,
      )

      if (
        !connectionState.fdc3ServerInstance ||
        !data.instanceId ||
        connectionState.userSessionId !== data.userSessionId
      ) {
        console.error(
          "  Cannot handle SAIL_CHANNEL_CHANGE: Invalid state or mismatched session.",
        )
        return callback(
          false,
          "Connection or instance ID invalid for channel change.",
        )
      }

      try {
        const { instanceId, channel } = data // The app instance making the request
        const session = connectionState.fdc3ServerInstance

        console.log(`  App ${instanceId} requesting to join channel ${channel}`)
        const response = await session.receive(
          {
            type: "joinUserChannelRequest",
            payload: { channelId: channel },
            meta: { requestUuid: uuid(), timestamp: new Date() },
          } as BrowserTypes.JoinUserChannelRequest,
          instanceId,
        )

        console.log(
          `  JOIN USER CHANNEL RESPONSE for ${instanceId}: ${JSON.stringify(response)}`,
        )

        const appState = session.serverContext.getAppInstanceDetails(instanceId)
        if (appState && appState.channel === channel) {
          console.log(
            `  Verified channel for ${instanceId} is now ${appState.channel}`,
          )
        } else {
          console.warn(
            `  Channel state for ${instanceId} might not be updated correctly after join request. Expected: ${channel}, Actual: ${appState?.channel}`,
          )
        }

        callback(true) // Assume success if receive didn't throw
      } catch (error) {
        console.error(
          `  Error handling SAIL_CHANNEL_CHANGE for instance ${data.instanceId}:`,
          error,
        )
        callback(false, (error as Error).message || "Failed to change channel.")
      }
    },
  )
}

function handleChannelReceiverHello(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(
    CHANNEL_RECEIVER_HELLO,
    async (
      props: ChannelReceiverHelloRequest,
      callback: (
        success: ChannelReceiverUpdate | undefined,
        err?: string,
      ) => void,
    ) => {
      console.log(
        `[ChannelHandler Register] Received CHANNEL_RECEIVER_HELLO for instance ${props.instanceId}`,
      )
      console.log(
        `[ChannelHandler] Channel Receiver Hello: Instance ${props.instanceId}, Session ${props.userSessionId} (Socket: ${connectionState.socket.id})`,
      )
      connectionState.userSessionId = props.userSessionId
      connectionState.appInstanceId = props.instanceId
      connectionState.type = SocketType.CHANNEL

      try {
        // Ensure we have the correct FDC3 server instance for the session
        const fdc3Server = await getOrAwaitFdc3Server(
          connectionState.sessionManager,
          props.userSessionId,
        )
        connectionState.fdc3ServerInstance = fdc3Server

        const appInst = fdc3Server.serverContext.getAppInstanceDetails(
          props.instanceId,
        )
        if (appInst) {
          appInst.channelSockets = appInst.channelSockets || []
          if (
            !appInst.channelSockets.some(
              (socket: Socket) => socket.id === connectionState.socket.id,
            )
          ) {
            appInst.channelSockets.push(connectionState.socket)
            fdc3Server.serverContext.setAppInstanceDetails(
              props.instanceId,
              appInst,
            )
            console.log(
              `  Added channel socket ${connectionState.socket.id} to ${props.instanceId}. Total: ${appInst.channelSockets.length}`,
            )
          } else {
            console.log(
              `  Socket ${connectionState.socket.id} already present in channelSockets for ${props.instanceId}.`,
            )
          }
          // Send current channel list back
          const tabs: TabDetail[] = fdc3Server.serverContext.getTabs()
          callback({ tabs: tabs })
        } else {
          console.error(
            `  Channel receiver hello failed: App instance ${props.instanceId} not found in session ${props.userSessionId}.`,
          )
          callback(undefined, "App instance not found.")
        }
      } catch (error) {
        console.error(
          `  Error handling CHANNEL_RECEIVER_HELLO for instance ${props.instanceId}:`,
          error,
        )
        callback(
          undefined,
          (error as Error).message || "Failed to initialize channel receiver.",
        )
      }
    },
  )
}

/**
 * Registers event listeners related to channel interactions.
 */
export function registerChannelHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  // SAIL_CHANNEL_CHANGE Listener
  handleSailChannelChange(socket, connectionState)

  // CHANNEL_RECEIVER_HELLO Listener
  handleChannelReceiverHello(socket, connectionState)
}
