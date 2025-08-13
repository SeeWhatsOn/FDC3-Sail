import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { io, Socket } from "socket.io-client"
import {
  SailAppStateArgs,
  AppHosting,
  SailClientStateArgs,
} from "@finos/fdc3-sail-shared"

interface AppLaunchParams {
  appId: string
  hosting: AppHosting
  channel?: string | null
  instanceTitle: string
}

interface ServerState {
  // Connection state
  socket: Socket | null
  isConnected: boolean
  connectionError: string | null

  // App state from server
  appStates: SailAppStateArgs

  // Actions
  connect: () => void
  disconnect: () => void
  registerDesktopAgent: (clientArgs: SailClientStateArgs) => Promise<void>
  registerAppLaunch: (params: AppLaunchParams) => Promise<string>
  sendClientState: (clientArgs: SailClientStateArgs) => Promise<void>
  intentChosen: (
    requestId: string,
    appId: string,
    intentId: string,
    channelId: string,
  ) => void

  // Internal methods
  _setAppStates: (states: SailAppStateArgs) => void
  _setConnectionState: (connected: boolean, error?: string) => void
}

export const useServerStore = create<ServerState>()(
  devtools(
    (set, get) => ({
      // Initial state
      socket: null,
      isConnected: false,
      connectionError: null,
      appStates: [],

      connect: () => {
        const { socket } = get()
        if (socket?.connected) return

        const newSocket = io("ws://localhost:8090", {
          transports: ["websocket"],
        })

        newSocket.on("connect", () => {
          console.log("Connected to FDC3 server")
          get()._setConnectionState(true)
        })

        newSocket.on("disconnect", (reason) => {
          console.log("Disconnected from FDC3 server:", reason)
          get()._setConnectionState(false)
        })

        newSocket.on("connect_error", (error) => {
          console.error("Connection error:", error)
          get()._setConnectionState(false, error.message)
        })

        // Listen for app state updates from server
        newSocket.on("appStateUpdate", (states: SailAppStateArgs) => {
          get()._setAppStates(states)
        })

        set({ socket: newSocket })
      },

      disconnect: () => {
        const { socket } = get()
        if (socket) {
          socket.disconnect()
          set({
            socket: null,
            isConnected: false,
            connectionError: null,
          })
        }
      },

      registerDesktopAgent: (clientArgs: SailClientStateArgs) => {
        return new Promise((resolve, reject) => {
          const { socket, isConnected } = get()

          if (!socket || !isConnected) {
            reject(new Error("Not connected to server"))
            return
          }

          socket.emit(
            "registerDesktopAgent",
            clientArgs,
            (response: { error?: string }) => {
              if (response.error) {
                reject(new Error(response.error))
              } else {
                resolve()
              }
            },
          )
        })
      },

      registerAppLaunch: (params: AppLaunchParams) => {
        return new Promise((resolve, reject) => {
          const { socket, isConnected } = get()

          if (!socket || !isConnected) {
            reject(new Error("Not connected to server"))
            return
          }

          socket.emit(
            "registerAppLaunch",
            params,
            (response: { instanceId?: string; error?: string }) => {
              if (response.error) {
                reject(new Error(response.error))
              } else if (response.instanceId) {
                resolve(response.instanceId)
              } else {
                reject(new Error("No instance ID received"))
              }
            },
          )
        })
      },

      sendClientState: (clientArgs: SailClientStateArgs) => {
        return new Promise((resolve, reject) => {
          const { socket, isConnected } = get()

          if (!socket || !isConnected) {
            reject(new Error("Not connected to server"))
            return
          }

          socket.emit(
            "sendClientState",
            clientArgs,
            (response: { error?: string }) => {
              if (response.error) {
                reject(new Error(response.error))
              } else {
                resolve()
              }
            },
          )
        })
      },

      intentChosen: (
        requestId: string,
        appId: string,
        intentId: string,
        channelId: string,
      ) => {
        const { socket, isConnected } = get()

        if (!socket || !isConnected) {
          console.error("Cannot send intent choice: not connected to server")
          return
        }

        socket.emit("intentChosen", {
          requestId,
          appId,
          intentId,
          channelId,
        })
      },

      // Internal methods
      _setAppStates: (states: SailAppStateArgs) => {
        set({ appStates: states })
      },

      _setConnectionState: (connected: boolean, error?: string) => {
        set({
          isConnected: connected,
          connectionError: error || null,
        })
      },
    }),
    { name: "server-store" },
  ),
)
