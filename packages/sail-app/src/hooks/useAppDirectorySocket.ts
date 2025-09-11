import { useEffect } from "react"
import { Socket } from "socket.io-client"
import type { DirectoryApp } from "@finos/fdc3-web-impl"
import { useDesktopAgent } from "./useDesktopAgent"
import { useAppDirectoryStore } from "../stores/appDirectoryStore"

interface AppDirectoryEvent {
  type: 'APP_ADDED' | 'APP_REMOVED' | 'APP_UPDATED' | 'DIRECTORY_REFRESH'
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

  useEffect(() => {
    const socket = getSocket()

    const handleAppDirectoryChange = (event: AppDirectoryEvent) => {
      console.log('App directory event received:', event)

      switch (event.type) {
        case 'APP_ADDED':
          if (event.app) {
            addApp(event.app)
          }
          break

        case 'APP_REMOVED':
          if (event.appId) {
            removeApp(event.appId)
          }
          break

        case 'APP_UPDATED':
          if (event.app && event.appId) {
            updateApp(event.appId, event.app)
          }
          break

        case 'DIRECTORY_REFRESH':
          if (event.apps) {
            setApps(event.apps)
          }
          break

        default:
          console.warn('Unknown app directory event type:', event.type)
      }
    }

    // Listen for app directory events from desktop agent
    socket.on('app-directory:change', handleAppDirectoryChange)

    // Request initial app directory load
    socket.emit('app-directory:request-apps')

    // Cleanup on unmount
    return () => {
      socket.off('app-directory:change', handleAppDirectoryChange)
    }
  }, [addApp, removeApp, updateApp, setApps, getSocket])

  return {
    // Could add manual refresh trigger here if needed
    requestRefresh: () => {
      const socket = getSocket()
      socket.emit('app-directory:request-apps')
    }
  }
}