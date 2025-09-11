import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { DirectoryApp } from "@finos/fdc3-web-impl"
import { useDesktopAgent } from "../hooks/useDesktopAgent"

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

export const createAppDirectoryStore = () =>
  create<AppDirectoryStore>()(
    immer((set, get) => ({
      // Initial state
      apps: [],
      isLoading: false,
      error: null,
      lastUpdated: null,

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
            const { getAppDirectories } = useDesktopAgent()
            apps = await getAppDirectories()
          } catch (wsError) {
            console.warn("Failed to load from desktop agent WebSocket, using fallback:", wsError)

            // Fallback to mock data for development
            apps = [
              {
                appId: "example-calculator",
                name: "Calculator",
                title: "Calculator",
                description: "A simple calculator application",
                version: "1.0.0",
                type: "web",
                details: {
                  url: "https://www.calculator.net/",
                },
                icons: [
                  {
                    src: "https://via.placeholder.com/64/4f46e5/ffffff?text=Calc",
                    size: "64x64",
                  },
                ],
              },
              {
                appId: "example-notepad",
                name: "Notepad",
                title: "Online Notepad",
                description: "Simple text editor for quick notes",
                version: "2.1.0",
                type: "web",
                details: {
                  url: "https://notepad-plus-plus.org/online/",
                },
                icons: [
                  {
                    src: "https://via.placeholder.com/64/059669/ffffff?text=Note",
                    size: "64x64",
                  },
                ],
              },
              {
                appId: "example-weather",
                name: "Weather",
                title: "Weather App",
                description: "Check current weather conditions and forecasts",
                version: "3.2.1",
                type: "web",
                details: {
                  url: "https://openweathermap.org/",
                },
                icons: [
                  {
                    src: "https://via.placeholder.com/64/0ea5e9/ffffff?text=☀",
                    size: "64x64",
                  },
                ],
              },
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

export const useAppDirectoryStore = createAppDirectoryStore()
