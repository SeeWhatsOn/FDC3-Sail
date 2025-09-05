import { io, Socket } from "socket.io-client"

// Utility functions for extracting URL parameters
function getQueryParam(variable: string): string {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get(variable) || ""
}

function getInstanceId(): string {
  return getQueryParam("instanceId")
}

function getAppId(): string {
  return getQueryParam("appId")
}

// Singleton socket instance
let sharedSocket: Socket | null = null

export interface SessionInfo {
  userSessionId: string
  instanceId: string
  appId: string
}

/**
 * Hook for managing the shared desktop agent socket connection and session information.
 * This should be used at the top level (DockView) to provide a singleton socket
 * that can be shared across all FDC3 panels.
 */
export const useDesktopAgent = () => {
  const getSocket = (): Socket => {
    if (!sharedSocket) {
      sharedSocket = io()
    }
    return sharedSocket
  }

  const getSessionInfo = (): SessionInfo => ({
    userSessionId: getQueryParam("desktopAgentId"),
    instanceId: getInstanceId(),
    appId: getAppId(),
  })

  const disconnectSocket = () => {
    if (sharedSocket) {
      sharedSocket.disconnect()
      sharedSocket = null
    }
  }

  return {
    getSocket,
    getSessionInfo,
    disconnectSocket,
  }
}
