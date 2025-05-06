import {
  SailChannelChangeArgs,
  ChannelReceiverHelloRequest,
  ChannelReceiverUpdate,
  TabDetail, // Needed for getTabs()
  SAIL_CHANNEL_CHANGE,
  CHANNEL_RECEIVER_HELLO,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "./connectionState"
import { SocketType, getFdc3ServerInstance } from "./utils"
import { v4 as uuid } from "uuid"
import { BrowserTypes } from "@finos/fdc3"
import { Socket } from "socket.io"

export async function handleSailChannelChange(
  state: ConnectionState,
  props: SailChannelChangeArgs,
  callback: (success: boolean, err?: string) => void,
): Promise<void> {
  console.log(
    `[ChannelHandler] Sail Channel Change: Instance ${props.instanceId} to channel ${props.channel} (Socket: ${state.socket.id})`,
  )

  if (
    !state.fdc3ServerInstance ||
    !props.instanceId ||
    state.userSessionId !== props.userSessionId
  ) {
    console.error(
      "  Cannot handle SAIL_CHANNEL_CHANGE: Invalid state or mismatched session.",
    )
    return callback(
      false,
      "Connection or instance ID invalid for channel change.",
    )
  }

  const instanceId = props.instanceId // The app instance making the request
  const session = state.fdc3ServerInstance

  try {
    console.log(
      `  App ${instanceId} requesting to join channel ${props.channel}`,
    )
    const response = await session.receive(
      {
        type: "joinUserChannelRequest",
        payload: { channelId: props.channel },
        meta: { requestUuid: uuid(), timestamp: new Date() },
      } as BrowserTypes.JoinUserChannelRequest,
      instanceId,
    )

    console.log(
      `  JOIN USER CHANNEL RESPONSE for ${instanceId}: ${JSON.stringify(response)}`,
    )

    const appState = session.serverContext.getInstanceDetails(instanceId)
    if (appState && appState.channel === props.channel) {
      console.log(
        `  Verified channel for ${instanceId} is now ${appState.channel}`,
      )
    } else {
      console.warn(
        `  Channel state for ${instanceId} might not be updated correctly after join request. Expected: ${props.channel}, Actual: ${appState?.channel}`,
      )
    }

    callback(true) // Assume success if receive didn't throw
  } catch (error) {
    console.error(
      `  Error handling SAIL_CHANNEL_CHANGE for instance ${instanceId}:`,
      error,
    )
    callback(false, (error as Error).message || "Failed to change channel.")
  }
}

export async function handleChannelReceiverHello(
  state: ConnectionState,
  props: ChannelReceiverHelloRequest,
  callback: (success: ChannelReceiverUpdate | undefined, err?: string) => void,
): Promise<void> {
  console.log(
    `[ChannelHandler] Channel Receiver Hello: Instance ${props.instanceId}, Session ${props.userSessionId} (Socket: ${state.socket.id})`,
  )
  state.userSessionId = props.userSessionId
  state.appInstanceId = props.instanceId
  state.type = SocketType.CHANNEL

  try {
    // Ensure we have the correct FDC3 server instance for the session
    const fdc3Server = await getFdc3ServerInstance(
      state.sessions,
      props.userSessionId,
    )
    state.fdc3ServerInstance = fdc3Server

    const appInst = fdc3Server.serverContext.getInstanceDetails(
      props.instanceId,
    )
    if (appInst) {
      appInst.channelSockets = appInst.channelSockets || []
      if (!appInst.channelSockets.some((s) => s.id === state.socket.id)) {
        appInst.channelSockets.push(state.socket)
        fdc3Server.serverContext.setInstanceDetails(props.instanceId, appInst)
        console.log(
          `  Added channel socket ${state.socket.id} to ${props.instanceId}. Total: ${appInst.channelSockets.length}`,
        )
      } else {
        console.log(
          `  Socket ${state.socket.id} already present in channelSockets for ${props.instanceId}.`,
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
}

/**
 * Registers event listeners related to channel interactions.
 */
export function registerChannelHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  // SAIL_CHANNEL_CHANGE Listener
  socket.on(SAIL_CHANNEL_CHANGE, (props: SailChannelChangeArgs, callback) => {
    console.log(
      `[ChannelHandler Register] Received SAIL_CHANNEL_CHANGE for instance ${props.instanceId} to channel ${props.channel}`,
    )
    handleSailChannelChange(connectionState, props, callback).catch(
      (err: Error) => {
        console.error(
          `Error in SAIL_CHANNEL_CHANGE handler for socket ${socket.id}:`,
          err,
        )
        callback(false, "Internal server error handling SAIL_CHANNEL_CHANGE")
      },
    )
  })

  // CHANNEL_RECEIVER_HELLO Listener
  socket.on(
    CHANNEL_RECEIVER_HELLO,
    (props: ChannelReceiverHelloRequest, callback) => {
      console.log(
        `[ChannelHandler Register] Received CHANNEL_RECEIVER_HELLO for instance ${props.instanceId}`,
      )
      handleChannelReceiverHello(connectionState, props, callback).catch(
        (err: Error) => {
          console.error(
            `Error in CHANNEL_RECEIVER_HELLO handler for socket ${socket.id}:`,
            err,
          )
          callback(
            undefined,
            "Internal server error handling CHANNEL_RECEIVER_HELLO",
          )
        },
      )
    },
  )
}
