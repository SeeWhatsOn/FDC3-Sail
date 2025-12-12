import { io, Socket } from "socket.io-client"
import { SailServerClientAPI, type DirectoryApp } from "@finos/sail-api"

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

// Singleton instances
let sharedSocket: Socket | null = null
let sailClient: SailServerClientAPI | null = null

export interface SessionInfo {
  userSessionId: string
  instanceId: string
  appId: string
}

/**
 * Hook for managing the shared desktop agent connection using SailServerClientAPI.
 * This provides a singleton socket and client that can be shared across all FDC3 panels.
 */
export const useDesktopAgent = () => {
  const getSocket = (): Socket => {
    if (!sharedSocket) {
      // Connect to sail-server on port 8091 with session authentication
      const serverUrl = import.meta.env.VITE_SAIL_SERVER_URL || "http://localhost:8091"
      const sessionId = `sail-ui-${Date.now()}`

      sharedSocket = io(serverUrl, {
        auth: {
          sessionId,
        },
      })

      sharedSocket.on("connect", () => {
        console.log("[DesktopAgent] Connected to sail-server:", sharedSocket?.id)
      })

      sharedSocket.on("connect_error", (error) => {
        console.error("[DesktopAgent] Connection error:", error)
      })

      // Create SailServerClientAPI instance
      sailClient = new SailServerClientAPI(sharedSocket)
    }
    return sharedSocket
  }

  const getClient = (): SailServerClientAPI => {
    if (!sailClient) {
      getSocket() // Ensure socket and client are initialized
    }
    return sailClient!
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
      sailClient = null
    }
  }

  const getAppDirectories = async (): Promise<DirectoryApp[]> => {
    const client = getClient()

    try {
      const allApps = await client.getDirectoryListing()

      // Filter out unwanted apps
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
    getClient,
    getSessionInfo,
    disconnectSocket,
    getAppDirectories,
  }
}
