import { io, Socket } from "socket.io-client"
import {
  type DirectoryApp,
  AppManagementMessages,
  type DesktopAgentDirectoryListingArgs,
} from "../types/common"

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

  const getAppDirectories = async (): Promise<DirectoryApp[]> => {
    const socket = getSocket()
    const { userSessionId } = getSessionInfo()

    if (!userSessionId) {
      throw new Error("No user session ID available")
    }

    try {
      const response = await socket.emitWithAck(AppManagementMessages.DA_DIRECTORY_LISTING, {
        userSessionId,
      } as DesktopAgentDirectoryListingArgs)

      // Filter out unwanted apps
      const allApps = response as DirectoryApp[]
      const allowedAppIds = ["fdc3-wcp-test", "sail-training-broadcaster", "sail-training-receiver"]
      const filteredApps = allApps.filter(
        app =>
          allowedAppIds.includes(app.appId) ||
          app.appId.startsWith("sail-training-") ||
          app.appId.startsWith("fdc3-")
      )

      console.log(`Filtered ${allApps.length} apps down to ${filteredApps.length} allowed apps`)
      return filteredApps
    } catch (error) {
      console.error("Failed to get app directories:", error)
      throw new Error("Failed to retrieve app directories from desktop agent")
    }
  }

  return {
    getSocket,
    getSessionInfo,
    disconnectSocket,
    getAppDirectories,
  }
}
