import { DockviewApi, SerializedDockview } from "dockview"
import { FDC3AppPanel } from "../fdc3-iframe"

export interface LayoutState {
  updatePanels(): void
  setApi(api: DockviewApi): void
  addPanel(panel: FDC3AppPanel): void
  removePanel(panelId: string): void
  updatePanel(panel: FDC3AppPanel): void
}

// Interface for legacy AppPanel with GridStack positioning
export interface LegacyAppPanel {
  title: string
  url: string
  tabId: string
  panelId: string
  appId: string
  icon: string | null
  x: number
  y: number
  w: number
  h: number
}

// Convert legacy AppPanel (GridStack) to FDC3AppPanel (Dockview)
export function convertLegacyPanel(legacyPanel: LegacyAppPanel): FDC3AppPanel {
  return {
    title: legacyPanel.title,
    url: legacyPanel.url,
    tabId: legacyPanel.tabId,
    panelId: legacyPanel.panelId,
    appId: legacyPanel.appId,
    icon: legacyPanel.icon
  }
}

type MountedPanel = FDC3AppPanel & {
  mountedTab: string
}

export class DockviewStateImpl implements LayoutState {
  private api: DockviewApi | null = null
  private panelsInGrid: MountedPanel[] = []

  setApi(api: DockviewApi) {
    this.api = api
  }

  getPanel(id: string): FDC3AppPanel | undefined {
    return this.panelsInGrid.find(p => p.panelId === id)
  }

  addPanel(panel: FDC3AppPanel) {
    if (!this.api) {
      console.warn('DockviewApi not initialized')
      return
    }

    const dockviewPanel = this.api.addPanel({
      id: panel.panelId,
      component: "fdc3",
      title: panel.title,
      params: { panel }
    })

    this.panelsInGrid.push({
      ...panel,
      mountedTab: panel.tabId
    })

    return dockviewPanel
  }

  removePanel(panelId: string) {
    if (!this.api) {
      console.warn('DockviewApi not initialized')
      return
    }

    const panel = this.api.getPanel(panelId)
    if (panel) {
      this.api.removePanel(panel)
    }

    this.panelsInGrid = this.panelsInGrid.filter(p => p.panelId !== panelId)
  }

  updatePanel(panel: FDC3AppPanel) {
    const existingPanel = this.api?.getPanel(panel.panelId)
    if (existingPanel) {
      existingPanel.setTitle(panel.title)
    }
    
    const mountedIndex = this.panelsInGrid.findIndex(p => p.panelId === panel.panelId)
    if (mountedIndex >= 0) {
      this.panelsInGrid[mountedIndex] = { ...panel, mountedTab: panel.tabId }
    }
  }

  updatePanels(): void {
    if (!this.api) {
      console.warn('DockviewApi not initialized')
      return
    }
  }

  // Sync with external panels array (from Zustand store)
  syncWithPanels(externalPanels: LegacyAppPanel[], activeTabId: string) {
    if (!this.api) {
      console.warn('DockviewApi not initialized')
      return
    }

    // Filter panels for active tab
    const tabPanels = externalPanels.filter(p => p.tabId === activeTabId)
    const currentPanelIds = this.panelsInGrid.map(p => p.panelId)
    const externalPanelIds = tabPanels.map(p => p.panelId)

    // Remove panels that no longer exist
    currentPanelIds
      .filter(id => !externalPanelIds.includes(id))
      .forEach(id => this.removePanel(id))

    // Add new panels
    tabPanels
      .filter(panel => !currentPanelIds.includes(panel.panelId))
      .forEach(panel => this.addPanel(convertLegacyPanel(panel)))

    // Update existing panels
    tabPanels
      .filter(panel => currentPanelIds.includes(panel.panelId))
      .forEach(panel => this.updatePanel(convertLegacyPanel(panel)))
  }

  fromJSON(data: SerializedDockview) {
    this.api?.fromJSON(data)
  }

  toJSON(): SerializedDockview | undefined {
    return this.api?.toJSON()
  }
}