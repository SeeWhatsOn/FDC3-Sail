import { useEffect } from "react"

import type { DirectoryApp } from "../types/common"
import { useDesktopAgent } from "./use-desktop-agent"
import { useAppDirectoryStore } from "../stores/app-directory-store"

interface AppDirectoryEvent {
  type: "APP_ADDED" | "APP_REMOVED" | "APP_UPDATED" | "DIRECTORY_REFRESH"
  app?: DirectoryApp
  appId?: string
  apps?: DirectoryApp[]
}

/**
 * Hook for listening to app directory changes from the desktop agent via WebSocket
 */
export const useAppDirectorySocket = () => {
  const { getSocket } = useDesktopAgent()
  const { addApp, removeApp, updateApp, setApps } = useAppDirectoryStore()

  const isAppAllowed = (appId: string) => {
    const allowedAppIds = ["fdc3-wcp-test", "sail-training-broadcaster", "sail-training-receiver"]
    return (
      allowedAppIds.includes(appId) ||
      appId.startsWith("sail-training-") ||
      appId.startsWith("fdc3-")
    )
  }

  useEffect(() => {
    const socket = getSocket()

    const handleAppDirectoryChange = (event: AppDirectoryEvent) => {
      console.log("App directory event received:", event)

      switch (event.type) {
        case "APP_ADDED":
          if (event.app && typeof event.app.appId === "string" && isAppAllowed(event.app.appId)) {
            addApp(event.app)
          } else if (event.app) {
            console.log(`Filtering out unwanted app: ${event.app.appId}`)
          }
          break

        case "APP_REMOVED":
          if (event.appId) {
            removeApp(event.appId)
          }
          break

        case "APP_UPDATED":
          if (event.app && event.appId && isAppAllowed(event.appId)) {
            updateApp(event.appId, event.app)
          } else if (event.app) {
            console.log(`Filtering out unwanted app update: ${event.appId}`)
          }
          break

        case "DIRECTORY_REFRESH":
          if (event.apps) {
            // Filter apps in directory refresh
            const filteredApps = event.apps.filter(app => isAppAllowed(app.appId))
            console.log(
              `Directory refresh: filtered ${event.apps.length} apps down to ${filteredApps.length}`
            )
            setApps(filteredApps)
          }
          break

        default:
          console.warn("Unknown app directory event type:", event.type)
      }
    }

    // Listen for app directory events from desktop agent
    socket.on("app-directory:change", handleAppDirectoryChange)

    // Request initial app directory load
    socket.emit("app-directory:request-apps")

    // Cleanup on unmount
    return () => {
      socket.off("app-directory:change", handleAppDirectoryChange)
    }
  }, [addApp, removeApp, updateApp, setApps, getSocket])

  return {
    // Could add manual refresh trigger here if needed
    requestRefresh: () => {
      const socket = getSocket()
      socket.emit("app-directory:request-apps")
    },
  }
}
