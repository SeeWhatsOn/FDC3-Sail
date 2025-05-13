import {
  SailChannelChangeArgs,
  ChannelReceiverHelloRequest,
  TabDetail, // Needed for getTabs()
  SAIL_CHANNEL_CHANGE,
  CHANNEL_RECEIVER_HELLO,
} from "@finos/fdc3-sail-common"
import { ConnectionState } from "../../types"
import { v4 as uuid } from "uuid"
import { BrowserTypes } from "@finos/fdc3"
import { Socket } from "socket.io"
import { handleOperationError } from "../../utils/errorHandling"
import { LogCategory, logHandlerEvent } from "../../utils/logs"
import { SocketType, getOrAwaitFdc3Server } from "../../utils"

function handleSailChannelChange(
  socket: Socket,
  connectionState: ConnectionState,
): void {
  socket.on(
    SAIL_CHANNEL_CHANGE,
    async (data: SailChannelChangeArgs, callback) => {
      logHandlerEvent({
        category: LogCategory.CHANNEL,
        event: `SAIL_CHANNEL_CHANGE`,
        context: { instanceId: data.instanceId, channel: data.channel },
        subCategory: "Register",
      })
      console.log(
        `[ChannelHandler Register] Received SAIL_CHANNEL_CHANGE for instance ${data.instanceId} to channel ${data.channel}`,
      )

      logHandlerEvent({
        category: LogCategory.CHANNEL,
        event: `Sail Channel Change`,
        context: {
          instanceId: data.instanceId,
          channel: data.channel,
          socketId: connectionState.socket.id,
        },
        subCategory: "Change",
      })

      if (
        !connectionState.fdc3ServerInstance ||
        !data.instanceId ||
        connectionState.userSessionId !== data.userSessionId
      ) {
        handleOperationError({
          operation: "SAIL_CHANNEL_CHANGE",
          contextData: {
            instanceId: data.instanceId,
            channel: data.channel,
          },
          fallbackMessage:
            "Cannot handle SAIL_CHANNEL_CHANGE: Invalid state or mismatched session.",
          callback,
          error: new Error(
            "Cannot handle SAIL_CHANNEL_CHANGE: Invalid state or mismatched session. Connection or instance ID invalid for channel change.",
          ),
        })
      }

      try {
        const { instanceId, channel } = data // The app instance making the request
        const session = connectionState.fdc3ServerInstance

        logHandlerEvent({
          category: LogCategory.CHANNEL,
          event: `App ${instanceId} requesting to join channel ${channel}`,
          context: { instanceId, channel },
          subCategory: "Change",
        })

        const response = await session.receive(
          {
            type: "joinUserChannelRequest",
            payload: { channelId: channel },
            meta: { requestUuid: uuid(), timestamp: new Date() },
          } as BrowserTypes.JoinUserChannelRequest,
          instanceId,
        )

        logHandlerEvent({
          category: LogCategory.CHANNEL,
          event: `JOIN USER CHANNEL RESPONSE for ${instanceId}: ${JSON.stringify(response)}`,
          context: { instanceId, channel },
          subCategory: "Change",
        })

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
        handleOperationError({
          operation: "SAIL_CHANNEL_CHANGE",
          contextData: {
            instanceId: data.instanceId,
            channel: data.channel,
          },
          fallbackMessage: "Failed to change channel.",
          callback,
          error,
        })
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
    async (data: ChannelReceiverHelloRequest, callback) => {
      //log event registration
      logHandlerEvent({
        category: LogCategory.CHANNEL,
        event: `Received ${CHANNEL_RECEIVER_HELLO}`,
        context: { instanceId: data.instanceId },
        subCategory: "Register",
      })

      // Log the detailed handler message
      logHandlerEvent({
        category: LogCategory.CHANNEL,
        event: "Channel Receiver Hello",
        context: {
          instanceId: data.instanceId,
          sessionId: data.userSessionId,
          socketId: connectionState.socket.id,
        },
      })

      connectionState.userSessionId = data.userSessionId
      connectionState.appInstanceId = data.instanceId
      connectionState.type = SocketType.CHANNEL

      try {
        // Ensure we have the correct FDC3 server instance for the session
        const fdc3Server = await getOrAwaitFdc3Server(
          connectionState.sessionManager,
          data.userSessionId,
        )
        connectionState.fdc3ServerInstance = fdc3Server

        const appInst = fdc3Server.serverContext.getAppInstanceDetails(
          data.instanceId,
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
              data.instanceId,
              appInst,
            )
            logHandlerEvent({
              category: LogCategory.CHANNEL,
              event: `Added channel socket ${connectionState.socket.id} to ${data.instanceId}. Total: ${appInst.channelSockets.length}`,
              context: { instanceId: data.instanceId },
              subCategory: "Change",
            })
          } else {
            logHandlerEvent({
              category: LogCategory.CHANNEL,
              event: `Socket ${connectionState.socket.id} already present in channelSockets for ${data.instanceId}.`,
              context: { instanceId: data.instanceId },
              subCategory: "Change",
            })
          }
          // Send current channel list back
          const tabs: TabDetail[] = fdc3Server.serverContext.getTabs()
          callback({ tabs: tabs })
        } else {
          throw new Error("App instance not found.")
        }
      } catch (error) {
        handleOperationError({
          operation: "CHANNEL_RECEIVER_HELLO",
          contextData: {
            instanceId: data.instanceId,
            sessionId: data.userSessionId,
          },
          fallbackMessage: "Failed to initialize channel receiver.",
          callback,
          error,
        })
      }
    },
  )
}

/**
 * Registers event listeners related to channel interactions.
 */
export async function registerChannelHandlers(
  socket: Socket,
  connectionState: ConnectionState,
): Promise<void> {
  try {
    // SAIL_CHANNEL_CHANGE Listener
    handleSailChannelChange(socket, connectionState)

    // CHANNEL_RECEIVER_HELLO Listener
    handleChannelReceiverHello(socket, connectionState)
  } catch (error) {
    console.error("Error registering channel handlers:", error)
    throw error
  }
}
