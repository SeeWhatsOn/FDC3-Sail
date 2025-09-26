import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { DirectoryApp } from "../types/common"

interface AppDirectoryState {
  apps: DirectoryApp[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface AppDirectoryActions {
  setApps: (apps: DirectoryApp[]) => void
  addApp: (app: DirectoryApp) => void
  removeApp: (appId: string) => void
  updateApp: (appId: string, updates: Partial<DirectoryApp>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearApps: () => void
  loadApps: () => Promise<void>
  refreshApps: () => Promise<void>
}

export interface AppDirectoryStore extends AppDirectoryState, AppDirectoryActions {}

export const createAppDirectoryStore = (getAppDirectories?: () => Promise<DirectoryApp[]>) =>
  create<AppDirectoryStore>()(
    immer((set, get) => ({
      // Initial state
      apps: [] as DirectoryApp[],
      isLoading: false as boolean,
      error: null as string | null,
      lastUpdated: null as Date | null,

      // Actions
      setApps: (apps: DirectoryApp[]) =>
        set(state => {
          state.apps = apps
          state.lastUpdated = new Date()
          state.error = null
        }),

      addApp: (app: DirectoryApp) =>
        set(state => {
          const existingIndex = state.apps.findIndex(a => a.appId === app.appId)
          if (existingIndex >= 0) {
            state.apps[existingIndex] = app
          } else {
            state.apps.push(app)
          }
          state.lastUpdated = new Date()
        }),

      removeApp: (appId: string) =>
        set(state => {
          state.apps = state.apps.filter(app => app.appId !== appId)
          state.lastUpdated = new Date()
        }),

      updateApp: (appId: string, updates: Partial<DirectoryApp>) =>
        set(state => {
          const appIndex = state.apps.findIndex(app => app.appId === appId)
          if (appIndex >= 0) {
            state.apps[appIndex] = { ...state.apps[appIndex], ...updates }
            state.lastUpdated = new Date()
          }
        }),

      setLoading: (loading: boolean) =>
        set(state => {
          state.isLoading = loading
        }),

      setError: (error: string | null) =>
        set(state => {
          state.error = error
          if (error) {
            state.isLoading = false
          }
        }),

      clearApps: () =>
        set(state => {
          state.apps = []
          state.lastUpdated = new Date()
          state.error = null
        }),

      // Async actions for loading apps
      loadApps: async () => {
        const { setLoading, setError, setApps } = get()

        try {
          setLoading(true)
          setError(null)

          // Try to load from desktop agent via WebSocket
          let apps: DirectoryApp[] = []

          try {
            // Use the desktop agent WebSocket connection
            if (getAppDirectories) {
              apps = await getAppDirectories()
            } else {
              throw new Error("No getAppDirectories function provided")
            }
          } catch (wsError) {
            console.warn("Failed to load from desktop agent WebSocket, using fallback:", wsError)

            // Fallback to essential training apps only
            apps = [
              {
                appId: "fdc3-wcp-test",
                name: "FDC3 WCP Test",
                title: "FDC3 WCP Test",
                description: "Test application for FDC3 Web Connection Protocol debugging and message testing",
                version: "1.0.0",
                type: "web",
                publisher: "FINOS",
                details: {
                  url: "/html/example-apps/wcp-test/index.html",
                },
                icons: [
                  {
                    src: "https://via.placeholder.com/64/dc2626/ffffff?text=WCP",
                    size: "64x64",
                  },
                ],
                hostManifests: {
                  sail: {
                    injectApi: "2.0"
                  }
                },
                interop: {
                  intents: {
                    listensFor: {
                      "fdc3.wcp-test": {
                        displayName: "WCP Test Message",
                        contexts: ["fdc3.wcp-test"]
                      }
                    }
                  }
                }
              },
              {
                appId: "sail-training-broadcaster",
                name: "Sail Broadcaster",
                title: "Sail Broadcaster",
                description: "App will connect to the desktop agent and broadcast on the user channel when you hit the button",
                version: "1.0.0",
                type: "web",
                publisher: "FINOS",
                details: {
                  url: "/html/example-apps/training-broadcast/index.html",
                },
                icons: [
                  {
                    src: "https://via.placeholder.com/64/059669/ffffff?text=📡",
                    size: "64x64",
                  },
                ],
                hostManifests: {
                  sail: {
                    injectApi: "2.0"
                  }
                }
              },
              {
                appId: "sail-training-receiver",
                name: "Sail Receiver",
                title: "Sail Receiver",
                description: "App will connect to the desktop agent on startup and listen to messages",
                version: "1.0.0",
                type: "web",
                publisher: "FINOS",
                details: {
                  url: "/html/example-apps/training-receive/index.html",
                },
                icons: [
                  {
                    src: "https://via.placeholder.com/64/2563eb/ffffff?text=📨",
                    size: "64x64",
                  },
                ],
                hostManifests: {
                  sail: {
                    injectApi: "2.0"
                  }
                }
              }
            ] as DirectoryApp[]
          }

          setApps(apps)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to load apps"
          setError(errorMessage)
          console.error("Failed to load app directory:", error)
        } finally {
          setLoading(false)
        }
      },

      refreshApps: async () => {
        const { loadApps } = get()
        await loadApps()
      },
    }))
  )

// This will be initialized in a React component where useDesktopAgent can be called
export const useAppDirectoryStore = createAppDirectoryStore(undefined)
