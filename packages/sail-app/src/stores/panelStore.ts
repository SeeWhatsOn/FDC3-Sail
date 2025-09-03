import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface AppPanel {
  title: string
  url: string
  tabId: string
  panelId: string
  appId: string
  icon: string | null
}

interface PanelState {
  panels: AppPanel[]
  activeTabId: string
}

interface PanelActions {
  setPanels: (panels: AppPanel[]) => void
  setActiveTab: (tabId: string) => void
  addPanel: (panel: AppPanel) => void
  removePanel: (panelId: string) => void
  getTabPanels: (tabId: string) => AppPanel[]
}

export interface PanelStore extends PanelState, PanelActions {}

export const createPanelStore = () =>
  create<PanelStore>()(
    immer((set, get) => ({
      // Initial state
      panels: [],
      activeTabId: "One",

      // Actions using Immer for clean immutable updates
      setPanels: (panels: AppPanel[]) =>
        set((state) => {
          state.panels = panels
        }),

      setActiveTab: (tabId: string) =>
        set((state) => {
          state.activeTabId = tabId
        }),

      addPanel: (panel: AppPanel) =>
        set((state) => {
          // Check if panel already exists (prevent duplicates)
          const existingIndex = state.panels.findIndex(p => p.panelId === panel.panelId)
          if (existingIndex !== -1) {
            // Update existing panel
            state.panels[existingIndex] = panel
          } else {
            // Add new panel
            state.panels.push(panel)
          }
        }),

      removePanel: (panelId: string) =>
        set((state) => {
          state.panels = state.panels.filter(panel => panel.panelId !== panelId)
        }),

      // Computed getter - doesn't need Immer
      getTabPanels: (tabId: string) => {
        return get().panels.filter(panel => panel.tabId === tabId)
      },
    }))
  )

export const usePanelStore = createPanelStore()