import { DockviewReact, DockviewReadyEvent, DockviewApi } from "dockview-react"
import { useState, useEffect, useRef } from "react"

import "./styles.css"
import { useDesktopAgent } from "../../hooks/useDesktopAgent"
import { usePanelStore } from "../../stores/panelStore"

import { FDC3AppPanel } from "./panel-templates/FDC3IframePanel"
import { LeftControls, PrefixToolbarControls, RightControls } from "./toolbar/controls/index"
import { Panels } from "./Panels"
import type { DockviewSailProps } from "./types"
import { WatermarkPanel } from "./panel-templates/WatermarkPanel"

// Re-export types for backward compatibility
export type { AppPanel, DockviewSailProps } from "./types"

const Layout = (props: DockviewSailProps) => {
  const api = useRef<DockviewApi | undefined>(undefined)
  const [mountedPanels, setMountedPanels] = useState<Map<string, FDC3AppPanel>>(new Map())

  // Use Zustand store instead of props
  const { panels, activeTabId, addPanel, removePanel, getTabPanels } = usePanelStore()
  const { disconnectSocket } = useDesktopAgent()

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

    const disposables = [
      api.current.onDidAddPanel(event => {
        // If this panel was added externally, notify the store
        const panel = mountedPanels.get(event.id)
        if (panel) {
          // Convert FDC3AppPanel to AppPanel and add to store
          const appPanel = {
            title: panel.title,
            url: panel.url,
            tabId: panel.tabId,
            panelId: panel.panelId,
            appId: panel.appId,
            icon: panel.icon,
          }
          addPanel(appPanel)
        }
      }),
      api.current.onDidRemovePanel(event => {
        // Clean up desktop agent registration
        // TODO: Implement window unregistration when needed
        // Remove from store
        removePanel(event.id)
      }),
    ]

    const state = localStorage.getItem("dv-demo-state")
    if (state) {
      try {
        api.current.fromJSON(JSON.parse(state))
      } catch {
        localStorage.removeItem("dv-demo-state")
      }
    }

    return () => disposables.forEach(disposable => disposable.dispose())
  }, [mountedPanels, panels, addPanel, removePanel])

  // Sync with store panels when they change
  useEffect(() => {
    if (!api.current || !panels || !activeTabId) return

    const tabPanels = getTabPanels(activeTabId)
    const currentPanelIds = Array.from(mountedPanels.keys())
    const externalPanelIds = tabPanels.map(p => p.panelId)

    // Remove panels that no longer exist
    currentPanelIds
      .filter(id => !externalPanelIds.includes(id))
      .forEach(id => {
        const panel = api.current?.getPanel(id)
        if (panel) api.current?.removePanel(panel)
        setMountedPanels(prev => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
      })

    // Add new panels
    tabPanels
      .filter(panel => !currentPanelIds.includes(panel.panelId))
      .forEach(panel => {
        const fdc3Panel: FDC3AppPanel = {
          title: panel.title,
          url: panel.url,
          tabId: panel.tabId,
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
      })
  }, [panels, activeTabId, mountedPanels, getTabPanels])

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
