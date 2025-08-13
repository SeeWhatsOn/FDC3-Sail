import { useClientStore } from "./useClientStore"
import { useServerStore } from "./useServerStore"
import { WebClientState } from "../types"
import { AppState, ServerState } from "../types"
import { SailAppStateArgs, SailClientStateArgs } from "@finos/fdc3-sail-shared"

/**
 * Legacy adapter to bridge between old singleton pattern and new Zustand stores
 * This allows gradual migration by providing the old interface backed by new stores
 */
export interface LegacyStateAdapter {
  getClientState: () => WebClientState
  getServerState: () => ServerState
  getAppState: () => AppState
}

/**
 * Creates adapter objects that implement the old interfaces but use Zustand stores
 */
export function createLegacyStateAdapter(): LegacyStateAdapter {
  const clientAdapter: WebClientState = {
    // User session
    getUserSessionID: () => useClientStore.getState().getUserSessionID(),

    // Tabs
    getActiveTab: () => useClientStore.getState().getActiveTab(),
    setActiveTabId: async (id: string) =>
      useClientStore.getState().setActiveTabId(id),
    getTabs: () => useClientStore.getState().tabs,
    addTab: async (tab) => useClientStore.getState().addTab(tab),
    removeTab: async (id) => useClientStore.getState().removeTab(id),
    updateTab: async (tab) => useClientStore.getState().updateTab(tab),
    moveTab: async (id, delta) => useClientStore.getState().moveTab(id, delta),

    // Directories
    setDirectories: async (directories) =>
      useClientStore.getState().setDirectories(directories),
    getDirectories: () => useClientStore.getState().getDirectories(),
    updateDirectory: async (directory) =>
      useClientStore.getState().updateDirectory(directory),

    // Apps
    getKnownApps: () => useClientStore.getState().getKnownApps(),
    setKnownApps: async (apps) => useClientStore.getState().setKnownApps(apps),
    getCustomApps: () => useClientStore.getState().getCustomApps(),
    setCustomApps: async (apps) =>
      useClientStore.getState().setCustomApps(apps),

    // Intent Resolution
    getIntentResolution: () => useClientStore.getState().getIntentResolution(),
    setIntentResolution: (resolution) =>
      useClientStore.getState().setIntentResolution(resolution),

    // Context History
    getContextHistory: (tabId) =>
      useClientStore.getState().getContextHistory(tabId),
    appendContextHistory: async (tabId, context) =>
      useClientStore.getState().appendContextHistory(tabId, context),

    // Callbacks (legacy - now handled by store subscriptions)
    addStateChangeCallback: (cb: () => void) => {
      return useClientStore.subscribe(cb)
    },

    // Client args for server communication
    createArgs: (): SailClientStateArgs => {
      const state = useClientStore.getState()
      return {
        userSessionId: state.userSessionId,
        channels: state.tabs,
        panels: state.panels,
        directories: state.directories.filter((d) => d.active).map((d) => d.url),
        customApps: state.customApps,
        contextHistory: state.contextHistory,
      }
    },

    // Panel methods (these were missing from the interface but exist in implementation)
    getPanels: () => useClientStore.getState().getPanels(),
    addPanel: (panel) => useClientStore.getState().addPanel(panel),
    removePanel: (panelId) => useClientStore.getState().removePanel(panelId),
    updatePanel: (panel) => useClientStore.getState().updatePanel(panel),
    newPanel: (app, instanceId, instanceTitle) =>
      useClientStore.getState().newPanel(app, instanceId, instanceTitle),
  } as WebClientState

  const serverAdapter: ServerState = {
    init: async () => {
      const serverStore = useServerStore.getState()
      serverStore.connect()
    },

    registerDesktopAgent: async (clientArgs) => {
      const serverStore = useServerStore.getState()
      await serverStore.registerDesktopAgent(clientArgs)
    },

    registerAppLaunch: async (appId, hosting, channel, instanceTitle) => {
      const serverStore = useServerStore.getState()
      return await serverStore.registerAppLaunch({
        appId,
        hosting,
        channel,
        instanceTitle,
      })
    },

    sendClientState: async (clientArgs) => {
      const serverStore = useServerStore.getState()
      await serverStore.sendClientState(clientArgs)
    },

    intentChosen: (requestId, appId, intentId, channelId) => {
      const serverStore = useServerStore.getState()
      serverStore.intentChosen(requestId, appId || "", intentId || "", channelId)
    },

    getApplications: async () => {
      // This would need to be implemented or delegated to the server store
      return []
    },

    setUserChannel: async (instanceId: string, channel: string) => {
      // This would need to be implemented in the server store
      console.log("setUserChannel called", instanceId, channel)
    },
  } as ServerState

  const appAdapter: AppState = {
    getAppState: (instanceId: string) => {
      const serverStore = useServerStore.getState()
      return serverStore.appStates.find((s) => s.instanceId === instanceId)
        ?.state
    },

    setAppState: (states: SailAppStateArgs) => {
      const serverStore = useServerStore.getState()
      serverStore._setAppStates(states)
    },

    getServerState: () => serverAdapter,
    getClientState: () => clientAdapter,

    addStateChangeCallback: (cb: () => void) => {
      return useServerStore.subscribe((state, prevState) => {
        if (state.appStates !== prevState.appStates) {
          cb()
        }
      })
    },

    // These methods from DefaultAppState would need more complex migration
    getDirectoryAppForUrl: () => undefined,
    init: () => {},
    registerAppWindow: () => {},
    getInstanceIdForWindow: async () => undefined,
    createTitle: () => "App",
    open: async () => ({ instanceId: "", channel: null, instanceTitle: "" }),
  } as AppState

  return {
    getClientState: () => clientAdapter,
    getServerState: () => serverAdapter,
    getAppState: () => appAdapter,
  }
}

/**
 * Hook to gradually replace the old singleton getters
 * Usage: const { clientState, serverState, appState } = useLegacyStates()
 */
export function useLegacyStates() {
  const adapter = createLegacyStateAdapter()
  return {
    clientState: adapter.getClientState(),
    serverState: adapter.getServerState(),
    appState: adapter.getAppState(),
  }
}

/**
 * Utility to sync localStorage state to Zustand stores on app startup
 */
export function migrateFromLocalStorage() {
  const STORAGE_KEY = "sail-client-state"
  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored) {
    try {
      const data = JSON.parse(stored)
      const {
        tabs,
        panels,
        activeTabId,
        userSessionId,
        directories,
        knownApps,
        customApps,
        contextHistory,
      } = data

      // Migrate to Zustand stores
      useClientStore.setState({
        userSessionId: userSessionId || `user-${Date.now()}`,
        activeTabId: activeTabId || tabs?.[0]?.id || "One",
        tabs: tabs || [],
        panels: panels || [],
        directories: directories || [],
        knownApps: knownApps || [],
        customApps: customApps || [],
        contextHistory: contextHistory || {},
      })

      console.log("Migrated localStorage state to Zustand stores")
    } catch (error) {
      console.warn("Failed to migrate localStorage state:", error)
    }
  }
}

/**
 * Development utility to compare old vs new state
 */
export function compareLegacyState(oldClientState: WebClientState) {
  const newState = useClientStore.getState()

  console.group("State Migration Comparison")
  console.log("Old tabs:", oldClientState.getTabs?.())
  console.log("New tabs:", newState.tabs)
  console.log("Old panels:", oldClientState.getPanels?.())
  console.log("New panels:", newState.panels)
  console.log("Old activeTab:", oldClientState.getActiveTab?.())
  console.log("New activeTab:", newState.getActiveTab())
  console.groupEnd()
}
