import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { createSailBrowserDesktopAgent } from "@finos/sail-api"
import type { AppConnectionMetadata } from "@finos/sail-api"

type SailDesktopAgentInstance = ReturnType<typeof createSailBrowserDesktopAgent>

export type ConnectionStatus = "connecting" | "connected" | "disconnected"

export interface Connection {
  instanceId: string
  appId: string
  status: ConnectionStatus
  connectedAt: Date
  panelId?: string // Link to dockview panel
}

interface ConnectionState {
  connections: Map<string, Connection>
  // Map from panelId to instanceId for quick lookup
  panelToConnection: Map<string, string>
}

interface ConnectionActions {
  getConnection: (instanceId: string) => Connection | undefined
  getConnectionByPanelId: (panelId: string) => Connection | undefined
  getAllConnections: () => Connection[]
  registerPanel: (panelId: string, appId: string) => void
  linkPanelToConnection: (panelId: string, instanceId: string) => void
  updateConnectionStatus: (instanceId: string, status: ConnectionStatus) => void
}

export interface ConnectionStore extends ConnectionState, ConnectionActions {}

export const createConnectionStore = (sailAgent: SailDesktopAgentInstance) => {
  const store = create<ConnectionStore>()(
    immer((set, get) => ({
      // Initial state
      connections: new Map(),
      panelToConnection: new Map(),

      // Actions
      getConnection: (instanceId: string) => {
        return get().connections.get(instanceId)
      },

      getConnectionByPanelId: (panelId: string) => {
        const instanceId = get().panelToConnection.get(panelId)
        if (!instanceId) return undefined
        return get().connections.get(instanceId)
      },

      getAllConnections: () => {
        return Array.from(get().connections.values())
      },

      registerPanel: (panelId: string, appId: string) =>
        set(state => {
          // When a panel is registered, check if there's already a connection for this appId
          // This happens when the app connects before we register the panel
          for (const connection of state.connections.values()) {
            if (connection.appId === appId && !connection.panelId) {
              // Link this connection to the panel
              connection.panelId = panelId
              state.panelToConnection.set(panelId, connection.instanceId)
              console.log(`[ConnectionStore] Linked panel ${panelId} to existing connection ${connection.instanceId}`)
              break
            }
          }
        }),

      linkPanelToConnection: (panelId: string, instanceId: string) =>
        set(state => {
          const connection = state.connections.get(instanceId)
          if (connection) {
            connection.panelId = panelId
            state.panelToConnection.set(panelId, instanceId)
          }
        }),

      updateConnectionStatus: (instanceId: string, status: ConnectionStatus) =>
        set(state => {
          const connection = state.connections.get(instanceId)
          if (connection) {
            connection.status = status
          }
        }),
    }))
  )

  // Wire up WCP connector event listeners
  const connector = sailAgent.wcpConnector

  // Handle app connected event
  connector.on("appConnected", (metadata: AppConnectionMetadata) => {
    console.log("[ConnectionStore] App connected:", metadata)
    store.setState(state => {
      state.connections.set(metadata.instanceId, {
        instanceId: metadata.instanceId,
        appId: metadata.appId,
        status: "connected",
        connectedAt: metadata.connectedAt,
      })
    })
  })

  // Handle app disconnected event
  connector.on("appDisconnected", (instanceId: string) => {
    console.log("[ConnectionStore] App disconnected:", instanceId)
    store.setState(state => {
      const connection = state.connections.get(instanceId)
      if (connection) {
        connection.status = "disconnected"
      }
    })
  })

  // Handle handshake failed event
  connector.on("handshakeFailed", (error: Error, connectionAttemptUuid: string) => {
    console.error("[ConnectionStore] Handshake failed:", error, connectionAttemptUuid)
    // Could add temporary "failed" connection entries here if needed
  })

  return store
}
