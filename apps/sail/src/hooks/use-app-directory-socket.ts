import { useEffect } from "react"

import type { DirectoryApp } from "@finos/sail-api"
import { useDesktopAgent } from "./use-desktop-agent"
import { useAppDirectoryStore } from "../stores/app-directory-store"

/**
 * Hook for fetching app directory from the desktop agent once on mount
 */
export const useAppDirectorySocket = () => {
  const { getSocket } = useDesktopAgent()
  const { setApps, setLoading, setError } = useAppDirectoryStore()

  useEffect(() => {
    const socket = getSocket()
    let isMounted = true

    const fetchAppDirectory = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log("[AppDirectory] Fetching apps from desktop agent...")

        // Request app directory from server with acknowledgment
        socket.emit("app-directory:get", (response: { apps: DirectoryApp[] }) => {
          if (!isMounted) return

          console.log("[AppDirectory] Received apps:", response.apps.length)
          setApps(response.apps)
          setLoading(false)
        })

        // Timeout fallback in case server doesn't respond
        setTimeout(() => {
          if (isMounted) {
            console.error("[AppDirectory] Timeout waiting for app directory response")
            setError("Timeout loading app directory")
            setLoading(false)
          }
        }, 5000)
      } catch (error) {
        if (isMounted) {
          console.error("[AppDirectory] Error fetching apps:", error)
          setError(error instanceof Error ? error.message : "Failed to load apps")
          setLoading(false)
        }
      }
    }

    // Fetch once on mount when socket is connected
    if (socket.connected) {
      fetchAppDirectory()
    } else {
      socket.once("connect", fetchAppDirectory)
    }

    // Cleanup
    return () => {
      isMounted = false
    }
  }, [getSocket, setApps, setLoading, setError])

  return {
    // Manual refresh trigger if needed
    requestRefresh: () => {
      const socket = getSocket()
      socket.emit("app-directory:get", (response: { apps: DirectoryApp[] }) => {
        console.log("[AppDirectory] Refresh - received apps:", response.apps.length)
        setApps(response.apps)
      })
    },
  }
}
