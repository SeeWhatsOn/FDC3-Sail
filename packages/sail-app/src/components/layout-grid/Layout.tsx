import { DockviewReact, type DockviewReadyEvent, DockviewApi } from "dockview-react"
import { useState, useEffect, useRef } from "react"

import "./styles.css"
import { useDesktopAgent } from "../../hooks/useDesktopAgent"
import { useWorkspaceStore } from "../../stores/workspaceStore"

import type { FDC3AppPanel } from "./panel-templates/FDC3IframePanel"
import { LeftControls, PrefixToolbarControls, RightControls } from "./toolbar/controls/index"
import { Panels } from "./Panels"
import type { DockviewSailProps } from "./types"
import { WatermarkPanel } from "./panel-templates/WatermarkPanel"

// Re-export types for backward compatibility
export type { DockviewSailProps } from "./types"
export type { Panel as WorkspacePanel } from "../../stores/workspaceStore"

const Layout = (props: DockviewSailProps) => {
  const api = useRef<DockviewApi | undefined>(undefined)
  const [mountedPanels, setMountedPanels] = useState<Map<string, FDC3AppPanel>>(new Map())

  // Use Zustand workspace store
  const {
    workspaces,
    activeWorkspaceId,
    addPanel,
    removePanel,
    getPanelsForTab,
    setDockviewLayout,
    getDockviewLayout,
    getTabsForWorkspace
  } = useWorkspaceStore()
  const { disconnectSocket } = useDesktopAgent()

  const activeWorkspace = workspaces.get(activeWorkspaceId)
  const activeTabId = activeWorkspace?.layout.activeTabId || ""
  const panels = activeWorkspace ? getPanelsForTab(activeWorkspaceId, activeTabId) : []

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      disconnectSocket()
    }
  }, [disconnectSocket])

  const onReady = (event: DockviewReadyEvent) => {
    api.current = event.api
  }

  useEffect(() => {
    if (!api.current) {
      return
    }

    const saveState = () => {
      if (api.current && activeWorkspaceId) {
        try {
          const state = api.current.toJSON()
          setDockviewLayout(activeWorkspaceId, state)
        } catch (error) {
          console.warn("Failed to save layout state:", error)
        }
      }
    }

    const disposables = [
      api.current.onDidAddPanel(event => {
        // If this panel was added externally, notify the store
        const panel = mountedPanels.get(event.id)
        if (panel && activeWorkspaceId && activeTabId) {
          // Convert FDC3AppPanel to Panel and add to store
          const workspacePanel = {
            panelId: panel.panelId,
            appId: panel.appId,
            title: panel.title,
            url: panel.url,
            icon: panel.icon,
          }
          addPanel(activeWorkspaceId, activeTabId, workspacePanel)
        }
        // Save state after adding panel
        saveState()
      }),
      api.current.onDidRemovePanel(event => {
        // Clean up desktop agent registration
        // TODO: Implement window unregistration when needed
        // Remove from store
        if (activeWorkspaceId && activeTabId) {
          removePanel(activeWorkspaceId, activeTabId, event.id)
        }
        // Save state after removing panel
        saveState()
      }),
      // Save state on layout changes
      api.current.onDidLayoutChange(() => {
        saveState()
      }),
    ]

    if (activeWorkspaceId) {
      const savedLayoutState = getDockviewLayout(activeWorkspaceId)
      if (savedLayoutState) {
        try {
          console.log("Restoring layout state from workspace store")
          api.current.fromJSON(savedLayoutState)
          console.log("Layout state restored successfully")
        } catch (error) {
          console.warn("Failed to restore layout state:", error)
          setDockviewLayout(activeWorkspaceId, null)
        }
      }
    }

    return () => disposables.forEach(disposable => disposable.dispose())
  }, [mountedPanels, panels, addPanel, removePanel, setDockviewLayout, getDockviewLayout, activeWorkspaceId])

  // Sync with store panels when they change
  useEffect(() => {
    if (!api.current || !panels || !activeTabId || !activeWorkspaceId) return

    const currentPanelIds = Array.from(mountedPanels.keys())
    const externalPanelIds = panels.map(p => p.panelId)

    // Get all existing panels from Dockview to check current state
    const existingDockviewPanels = api.current.panels.map(p => p.id)
    console.log(
      "Sync check - Store panels:",
      externalPanelIds,
      "Mounted:",
      currentPanelIds,
      "Dockview:",
      existingDockviewPanels
    )

    // Remove panels that no longer exist in the store but exist in mounted/dockview
    currentPanelIds
      .filter(id => !externalPanelIds.includes(id))
      .forEach(id => {
        const panel = api.current?.getPanel(id)
        if (panel) {
          console.log(`Removing panel ${id} as it's no longer in store`)
          api.current?.removePanel(panel)
        }
        setMountedPanels(prev => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
      })

    // Add new panels from store that don't exist in Dockview
    panels
      .filter(panel => !currentPanelIds.includes(panel.panelId))
      .forEach(panel => {
        // Double-check that the panel doesn't already exist in Dockview
        if (!api.current?.getPanel(panel.panelId)) {
          console.log(`Creating new panel ${panel.panelId}`)
          const fdc3Panel: FDC3AppPanel = {
            title: panel.title,
            url: panel.url,
            tabId: activeTabId, // Use the active tab ID
            panelId: panel.panelId,
            appId: panel.appId,
            icon: panel.icon,
          }

          api.current?.addPanel({
            id: panel.panelId,
            component: "fdc3",
            title: panel.title,
            params: { panel: fdc3Panel },
          })

          setMountedPanels(prev => new Map(prev).set(panel.panelId, fdc3Panel))
        } else {
          console.warn(
            `Panel ${panel.panelId} already exists in Dockview, updating mounted panels tracking`
          )
          // If panel exists in Dockview but not in mountedPanels, add it to tracking
          const fdc3Panel: FDC3AppPanel = {
            title: panel.title,
            url: panel.url,
            tabId: activeTabId, // Use the active tab ID
            panelId: panel.panelId,
            appId: panel.appId,
            icon: panel.icon,
          }
          setMountedPanels(prev => new Map(prev).set(panel.panelId, fdc3Panel))
        }
      })
  }, [panels, activeTabId, mountedPanels, activeWorkspaceId])

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        flex: 1,
      }}
    >
      <DockviewReact
        components={Panels}
        rightHeaderActionsComponent={RightControls}
        leftHeaderActionsComponent={LeftControls}
        prefixHeaderActionsComponent={PrefixToolbarControls}
        onReady={onReady}
        className={props.theme || "dockview-theme-abyss"}
        watermarkComponent={WatermarkPanel}
      />
    </div>
  )
}

export default Layout
