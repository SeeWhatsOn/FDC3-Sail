import { useCallback } from "react"
import { Socket } from "socket.io-client"
import {
  AppHosting,
  HandshakeMessages,
  AppHelloArgs,
  AppManagementMessages,
} from "@finos/fdc3-sail-shared"
import { BrowserTypes } from "@finos/fdc3"
import { isWebConnectionProtocol1Hello } from "@finos/fdc3-schema/dist/generated/api/BrowserTypes"
import { InstanceID } from "@finos/fdc3-web-impl"
import { useDesktopAgent, SessionInfo } from "./useDesktopAgent"

/**
 * Links socket and MessageChannel for bidirectional FDC3 communication
 */
function link(socket: Socket, channel: MessageChannel, source: InstanceID) {
  socket.on(AppManagementMessages.FDC3_DA_EVENT, (data: unknown) => {
    channel.port2.postMessage(data)
  })

  channel.port2.onmessage = function (event) {
    socket.emit(AppManagementMessages.FDC3_APP_EVENT, event.data, source)
  }
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
        link(socket, channel, sessionInfo.instanceId)

        const response = (await socket.emitWithAck(HandshakeMessages.APP_HELLO, {
          userSessionId: sessionInfo.userSessionId,
          instanceId: sessionInfo.instanceId,
          appId: sessionInfo.appId,
        } as AppHelloArgs)) as AppHosting

        // Response received from desktop agent

        const suffix = `?desktopAgentId=${sessionInfo.userSessionId}&instanceId=${sessionInfo.instanceId}`
        const intentResolverUrl =
          response == AppHosting.Tab
            ? window.location.origin + `/html/ui/intent-resolver.html${suffix}`
            : undefined
        const channelSelectorUrl =
          response == AppHosting.Tab
            ? window.location.origin + `/html/ui/channel-selector.html${suffix}`
            : undefined

        // Send handshake response to the app window
        targetWindow.postMessage(
          {
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
          } as BrowserTypes.WebConnectionProtocol3Handshake,
          "*",
          [channel.port1]
        )
      } catch (e) {
        console.error(`Error in FDC3 handshake for panel ${panelId}:`, e)
      }
    },
    [panelId]
  )

  const handleWCPMessage = useCallback(
    async (event: MessageEvent, contentWindow: Window) => {
      const messageData = event.data as BrowserTypes.WebConnectionProtocol1Hello

      if (isWebConnectionProtocol1Hello(messageData) && event.source === contentWindow) {
        console.debug(`FDC3 Panel ${panelId} received WCP1Hello:`, messageData)

        const socket = getSocket()
        const channel = new MessageChannel()
        const sessionInfo = getSessionInfo()

        await handleSocketConnection(socket, channel, sessionInfo, messageData, contentWindow)
      }
    },
    [panelId, getSocket, getSessionInfo, handleSocketConnection]
  )

  const registerWindow = useCallback(
    (contentWindow: Window) => {
      console.log(`FDC3 Panel ${panelId} registering window`)

      const messageListener = (event: MessageEvent) => {
        handleWCPMessage(event, contentWindow)
      }

      window.addEventListener("message", messageListener)

      // Return cleanup function
      return () => {
        console.log(`FDC3 Panel ${panelId} unregistering window`)
        window.removeEventListener("message", messageListener)
      }
    },
    [panelId, handleWCPMessage]
  )

  return {
    registerWindow,
  }
}
