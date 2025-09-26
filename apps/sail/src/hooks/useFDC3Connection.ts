import { useCallback } from "react"
import { Socket } from "socket.io-client"
import {
  AppHosting,
  HandshakeMessages,
  type AppHelloArgs,
  AppManagementMessages,
  type InstanceID,
} from "../types/common"
import { BrowserTypes } from "@finos/fdc3"
import { isWebConnectionProtocol1Hello } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { useDesktopAgent, type SessionInfo } from "./useDesktopAgent"

/**
 * Links socket and MessageChannel for bidirectional FDC3 communication
 */
function link(socket: Socket, channel: MessageChannel, source: InstanceID) {
  console.log(`[WCP-Link] Setting up bidirectional link for instance: ${source}`)

  socket.on(AppManagementMessages.FDC3_DA_EVENT, (data: unknown) => {
    console.log(`[WCP-Link] Desktop Agent -> App:`, data)
    channel.port2.postMessage(data)
  })

  channel.port2.onmessage = function (event) {
    console.log(`[WCP-Link] App -> Desktop Agent:`, event.data)
    socket.emit(AppManagementMessages.FDC3_APP_EVENT, event.data, source)
  }

  console.log(`[WCP-Link] Bidirectional link established for instance: ${source}`)
}

/**
 * Hook for handling FDC3 Web Connection Protocol (WCP) at the panel level.
 * This manages the handshake process between FDC3 apps and the desktop agent.
 */
export const useFDC3Connection = (panelId: string) => {
  const { getSocket, getSessionInfo } = useDesktopAgent()

  const handleSocketConnection = useCallback(
    async (
      socket: Socket,
      channel: MessageChannel,
      sessionInfo: SessionInfo,
      messageData: BrowserTypes.WebConnectionProtocol1Hello,
      targetWindow: Window
    ) => {
      try {
        console.log(
          `[WCP-Handler] ${panelId} - Starting socket connection for session:`,
          sessionInfo
        )
        console.log(`[WCP-Handler] ${panelId} - WCP1Hello message data:`, messageData)

        link(socket, channel, sessionInfo.instanceId)

        console.log(`[WCP-Handler] ${panelId} - Sending APP_HELLO to desktop agent`)
        const appHelloArgs = {
          userSessionId: sessionInfo.userSessionId,
          instanceId: sessionInfo.instanceId,
          appId: sessionInfo.appId,
        } as AppHelloArgs

        console.log(`[WCP-Handler] ${panelId} - APP_HELLO args:`, appHelloArgs)

        const response = (await socket.emitWithAck(
          HandshakeMessages.APP_HELLO,
          appHelloArgs
        )) as AppHosting

        console.log(`[WCP-Handler] ${panelId} - Desktop agent response:`, response)

        const suffix = `?desktopAgentId=${sessionInfo.userSessionId}&instanceId=${sessionInfo.instanceId}`
        const intentResolverUrl =
          response == AppHosting.Tab
            ? window.location.origin + `/html/ui/intent-resolver.html${suffix}`
            : undefined
        const channelSelectorUrl =
          response == AppHosting.Tab
            ? window.location.origin + `/html/ui/channel-selector.html${suffix}`
            : undefined

        console.log(`[WCP-Handler] ${panelId} - Generated URLs:`, {
          intentResolverUrl,
          channelSelectorUrl,
        })

        const handshakeResponse = {
          type: "WCP3Handshake",
          meta: {
            connectionAttemptUuid: messageData.meta.connectionAttemptUuid,
            timestamp: new Date(),
          },
          payload: {
            fdc3Version: "2.2",
            intentResolverUrl,
            channelSelectorUrl,
          },
        } as BrowserTypes.WebConnectionProtocol3Handshake

        console.log(`[WCP-Handler] ${panelId} - Sending WCP3Handshake response:`, handshakeResponse)

        // Send handshake response to the app window
        targetWindow.postMessage(handshakeResponse, "*", [channel.port1])

        console.log(`[WCP-Handler] ${panelId} - WCP handshake completed successfully`)
      } catch (e) {
        console.error(`[WCP-Handler] ${panelId} - Error in FDC3 handshake:`, e)
      }
    },
    [panelId]
  )

  const handleWCPMessage = useCallback(
    async (event: MessageEvent, contentWindow: Window) => {
      console.log(`[WCP-Message] ${panelId} - Received message from:`, event.origin)
      console.log(`[WCP-Message] ${panelId} - Message data:`, event.data)
      console.log(
        `[WCP-Message] ${panelId} - Event source === contentWindow:`,
        event.source === contentWindow
      )

      const messageData = event.data as BrowserTypes.WebConnectionProtocol1Hello

      if (isWebConnectionProtocol1Hello(messageData) && event.source === contentWindow) {
        console.log(`[WCP-Message] ${panelId} - Valid WCP1Hello message received:`, messageData)

        const socket = getSocket()
        const channel = new MessageChannel()
        const sessionInfo = getSessionInfo()

        console.log(
          `[WCP-Message] ${panelId} - Initiating socket connection with session:`,
          sessionInfo
        )

        await handleSocketConnection(socket, channel, sessionInfo, messageData, contentWindow)
      } else {
        if (!isWebConnectionProtocol1Hello(messageData)) {
          console.log(`[WCP-Message] ${panelId} - Message is not a valid WCP1Hello:`, messageData)
        }
        if (event.source !== contentWindow) {
          console.log(`[WCP-Message] ${panelId} - Message source mismatch, ignoring`)
        }
      }
    },
    [panelId, getSocket, getSessionInfo, handleSocketConnection]
  )

  const registerWindow = useCallback(
    (contentWindow: Window) => {
      console.log(`[WCP-Register] ${panelId} - Registering window for WCP message handling`)
      console.log(`[WCP-Register] ${panelId} - Content window:`, contentWindow)

      const messageListener = (event: MessageEvent) => {
        console.log(`[WCP-Register] ${panelId} - Message listener triggered for event:`, {
          origin: event.origin,
          type: event.data?.type,
          source: event.source,
        })
        void handleWCPMessage(event, contentWindow)
      }

      console.log(`[WCP-Register] ${panelId} - Adding message event listener to window`)
      window.addEventListener("message", messageListener)

      // Return cleanup function
      return () => {
        console.log(`[WCP-Register] ${panelId} - Cleaning up: removing message event listener`)
        window.removeEventListener("message", messageListener)
      }
    },
    [panelId, handleWCPMessage]
  )

  return {
    registerWindow,
  }
}
