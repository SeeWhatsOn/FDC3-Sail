import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { DirectoryApp } from "@finos/fdc3-web-impl"
import { Context } from "@finos/fdc3-context"
import { TabDetail, Directory, ContextHistory } from "@finos/fdc3-sail-shared"
import { AppPanel, IntentResolution } from "../types"
import { v4 as uuidv4 } from "uuid"

interface ClientState {
  // Core state
  userSessionId: string
  activeTabId: string
  tabs: TabDetail[]
  panels: AppPanel[]

  // Directory management
  directories: Directory[]
  knownApps: DirectoryApp[]
  customApps: DirectoryApp[]

  // UI state
  intentResolution: IntentResolution | null
  contextHistory: ContextHistory

  // Actions - Tabs
  getActiveTab: () => TabDetail
  setActiveTabId: (id: string) => void
  addTab: (tab: TabDetail) => void
  removeTab: (id: string) => void
  updateTab: (tab: TabDetail) => void
  moveTab: (id: string, delta: "up" | "down") => void

  // Actions - Panels
  getPanels: () => AppPanel[]
  addPanel: (panel: AppPanel) => void
  removePanel: (panelId: string) => void
  updatePanel: (panel: AppPanel) => void
  newPanel: (app: DirectoryApp, instanceId: string, instanceTitle: string) => void

  // Actions - Directories
  setDirectories: (directories: Directory[]) => void
  getDirectories: () => Directory[]
  updateDirectory: (directory: Directory) => void

  // Actions - Apps
  getKnownApps: () => DirectoryApp[]
  setKnownApps: (apps: DirectoryApp[]) => void
  getCustomApps: () => DirectoryApp[]
  setCustomApps: (apps: DirectoryApp[]) => void

  // Actions - Intent Resolution
  getIntentResolution: () => IntentResolution | null
  setIntentResolution: (resolution: IntentResolution | null) => void

  // Actions - Context History
  getContextHistory: (tabId: string) => Context[]
  appendContextHistory: (tabId: string, context: Context) => void

  // Utility
  getUserSessionID: () => string
}

const DEFAULT_TABS: TabDetail[] = [
  {
    id: "One",
    icon: "/icons/tabs/one.svg",
    background: "#123456",
  },
  {
    id: "Two",
    icon: "/icons/tabs/two.svg",
    background: "#564312",
  },
  {
    id: "Three",
    icon: "/icons/tabs/three.svg",
    background: "#341256",
  },
]

const DEFAULT_DIRECTORIES: Directory[] = [
  {
    label: "Benzinga Apps",
    url: "../../directory/benzinga.json",
    active: false,
  },
  {
    label: "FDC3 Conformance",
    url: "../../directory/conformance.json",
    active: false,
  },
  {
    label: "Polygon Apps",
    url: "../../directory/polygon.json",
    active: true,
  },
  {
    label: "FINOS FDC3 Directory",
    url: "https://directory.fdc3.finos.org/v2/apps/",
    active: false,
  },
  {
    label: "Sail Example Apps",
    url: "../../directory/sail.json",
    active: true,
  },
  {
    label: "TradingView Apps",
    url: "../../directory/trading-view.json",
    active: true,
  },
  {
    label: "Developer Tutorial Training Apps",
    url: "../../directory/training.json",
    active: true,
  },
  {
    label: "FDC3 Workbench",
    url: "../../directory/workbench.json",
    active: true,
  },
]

export const useClientStore = create<ClientState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        userSessionId: `user-${uuidv4()}`,
        activeTabId: DEFAULT_TABS[0].id,
        tabs: DEFAULT_TABS,
        panels: [],
        directories: DEFAULT_DIRECTORIES,
        knownApps: [],
        customApps: [],
        intentResolution: null,
        contextHistory: {},

        // Tab actions
        getActiveTab: () => {
          const { tabs, activeTabId } = get()
          const activeTab = tabs.find(t => t.id === activeTabId)
          if (!activeTab) {
            set({ activeTabId: tabs[0].id })
            return tabs[0]
          }
          return activeTab
        },

        setActiveTabId: (id: string) => {
          set({ activeTabId: id })
        },

        addTab: (tab: TabDetail) => {
          set(state => ({
            tabs: [...state.tabs, tab],
          }))
        },

        removeTab: (id: string) => {
          set(state => ({
            tabs: state.tabs.filter(t => t.id !== id),
            panels: state.panels.filter(p => p.tabId !== id),
          }))
        },

        updateTab: (tab: TabDetail) => {
          set(state => ({
            tabs: state.tabs.map(t => (t.id === tab.id ? tab : t)),
          }))
        },

        moveTab: (id: string, delta: "up" | "down") => {
          set(state => {
            const tabs = [...state.tabs]
            const idx = tabs.findIndex(t => t.id === id)
            if (idx === -1) return state

            if (delta === "up" && idx > 0) {
              ;[tabs[idx - 1], tabs[idx]] = [tabs[idx], tabs[idx - 1]]
            } else if (delta === "down" && idx < tabs.length - 1) {
              ;[tabs[idx], tabs[idx + 1]] = [tabs[idx + 1], tabs[idx]]
            }

            return { tabs }
          })
        },

        // Panel actions
        getPanels: () => get().panels,

        addPanel: (panel: AppPanel) => {
          set(state => ({
            panels: [...state.panels, panel],
          }))
        },

        removePanel: (panelId: string) => {
          set(state => ({
            panels: state.panels.filter(p => p.panelId !== panelId),
          }))
        },

        updatePanel: (panel: AppPanel) => {
          set(state => ({
            panels: state.panels.map(p => (p.panelId === panel.panelId ? panel : p)),
          }))
        },

        newPanel: (app: DirectoryApp, instanceId: string, instanceTitle: string) => {
          const { getActiveTab } = get()
          const activeTab = getActiveTab()

          const panel: AppPanel = {
            title: instanceTitle,
            url: (app.details as { url: string }).url,
            tabId: activeTab.id,
            panelId: instanceId,
            appId: app.appId,
            icon: app.icons?.[0]?.src || null,
            x: 0,
            y: 0,
            w: 6,
            h: 4,
          }

          set(state => ({
            panels: [...state.panels, panel],
          }))
        },

        // Directory actions
        setDirectories: (directories: Directory[]) => {
          set({ directories })
        },

        getDirectories: () => get().directories,

        updateDirectory: (directory: Directory) => {
          set(state => ({
            directories: state.directories.map(d => (d.url === directory.url ? directory : d)),
          }))
        },

        // App actions
        getKnownApps: () => get().knownApps,

        setKnownApps: (apps: DirectoryApp[]) => {
          set({ knownApps: apps })
        },

        getCustomApps: () => get().customApps,

        setCustomApps: (apps: DirectoryApp[]) => {
          set({ customApps: apps })
        },

        // Intent resolution actions
        getIntentResolution: () => get().intentResolution,

        setIntentResolution: (resolution: IntentResolution | null) => {
          set({ intentResolution: resolution })
        },

        // Context history actions
        getContextHistory: (tabId: string) => {
          const { contextHistory } = get()
          return contextHistory[tabId] || []
        },

        appendContextHistory: (tabId: string, context: Context) => {
          set(state => ({
            contextHistory: {
              ...state.contextHistory,
              [tabId]: [...(state.contextHistory[tabId] || []), context],
            },
          }))
        },

        // Utility
        getUserSessionID: () => get().userSessionId,
      }),
      {
        name: "sail-client-store",
        // Only persist essential data, exclude UI state
        partialize: state => ({
          userSessionId: state.userSessionId,
          activeTabId: state.activeTabId,
          tabs: state.tabs,
          panels: state.panels,
          directories: state.directories,
          knownApps: state.knownApps,
          customApps: state.customApps,
          contextHistory: state.contextHistory,
        }),
      }
    ),
    { name: "client-store" }
  )
)
