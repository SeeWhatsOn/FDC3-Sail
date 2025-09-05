import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

export interface AppPanel {
  title: string
  url: string
  tabId: string
  panelId: string
  appId: string
  icon: string | null
}

interface PanelState {
  panels: Map<string, AppPanel>
  activeTabId: string
}

interface PanelActions {
  setPanels: (panels: Map<string, AppPanel>) => void
  setActiveTab: (tabId: string) => void
  addPanel: (panel: AppPanel) => void
  removePanel: (panelId: string) => void
  getPanel: (panelId: string) => AppPanel | undefined
  getTabPanels: (tabId: string) => AppPanel[]
  getAllPanels: () => AppPanel[]
}

export interface PanelStore extends PanelState, PanelActions {}

// Mock data that simulates what would come from external sources
const MOCK_PANELS_DATA: AppPanel[] = [
  {
    title: "Trading Terminal",
    url: "https://tradingview.com/chart/",
    tabId: "One",
    panelId: "tradingview-1", // Combined appId-instanceId format
    appId: "tradingview",
    icon: null,
  },
  {
    title: "Market Data",
    url: "https://polygon.io/dashboard",
    tabId: "One",
    panelId: "polygon-1", // Combined appId-instanceId format
    appId: "polygon",
    icon: null,
  },
  {
    title: "News Feed",
    url: "https://benzinga.com/news",
    tabId: "Two",
    panelId: "benzinga-1", // Combined appId-instanceId format
    appId: "benzinga",
    icon: null,
  },
]

// Convert array to Map for better performance
const MOCK_PANELS = new Map(MOCK_PANELS_DATA.map(panel => [panel.panelId, panel]))

export const createPanelStore = () =>
  create<PanelStore>()(
    immer((set, get) => ({
      // Initial state with mock data
      panels: MOCK_PANELS,
      activeTabId: "One",

      // Actions using Immer for clean immutable updates
      setPanels: (panels: Map<string, AppPanel>) =>
        set(state => {
          state.panels = panels
        }),

      setActiveTab: (tabId: string) =>
        set(state => {
          state.activeTabId = tabId
        }),

      addPanel: (panel: AppPanel) =>
        set(state => {
          // Map automatically handles updates/inserts
          state.panels.set(panel.panelId, panel)
        }),

      removePanel: (panelId: string) =>
        set(state => {
          state.panels.delete(panelId)
        }),

      // Computed getters - don't need Immer
      getPanel: (panelId: string) => {
        return get().panels.get(panelId)
      },

      getTabPanels: (tabId: string) => {
        const panels = get().panels
        return Array.from(panels.values()).filter(panel => panel.tabId === tabId)
      },

      getAllPanels: () => {
        return Array.from(get().panels.values())
      },
    }))
  )

export const usePanelStore = createPanelStore()
