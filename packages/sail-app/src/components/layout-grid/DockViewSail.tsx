import { DockviewReact, DockviewReadyEvent, DockviewApi } from "dockview-react"
import { useState, useEffect, useRef } from "react"

import "./styles.css"
import { FDC3AppPanel } from "../fdc3-iframe/FDC3Panel"
import { useDesktopAgent } from "../../hooks/useDesktopAgent"
import { usePanelStore } from "../../stores/panelStore"

import { LeftControls, PrefixHeaderControls, RightControls } from "./Controls"
import { defaultConfig } from "./config"
import { dockViewComponents, dockViewHeaderComponents } from "./DockViewComponents"
import { DockviewSailProps } from "./types"

// Re-export types for backward compatibility
export type { AppPanel, DockviewSailProps } from "./types"

const DockviewSail = (props: DockviewSailProps) => {
  const api = useRef<DockviewApi | undefined>(undefined)
  const [mountedPanels, setMountedPanels] = useState<Map<string, FDC3AppPanel>>(new Map())

  // Use Zustand store instead of props
  const { panels, activeTabId, addPanel, removePanel } = usePanelStore()
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

    let success = false

    const state = localStorage.getItem("dv-demo-state")
    if (state) {
      try {
        api.current.fromJSON(JSON.parse(state))
        success = true
      } catch {
        localStorage.removeItem("dv-demo-state")
      }
    }

    if (!success && !panels.length) {
      defaultConfig(api.current)
    }

    return () => disposables.forEach(disposable => disposable.dispose())
  }, [mountedPanels, panels, addPanel, removePanel])

  // Sync with store panels when they change
  useEffect(() => {
    if (!api.current || !panels || !activeTabId) return

    const tabPanels = panels.filter(p => p.tabId === activeTabId)
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
  }, [panels, activeTabId, mountedPanels])

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
        components={dockViewComponents}
        defaultTabComponent={dockViewHeaderComponents.default}
        rightHeaderActionsComponent={RightControls}
        leftHeaderActionsComponent={LeftControls}
        prefixHeaderActionsComponent={PrefixHeaderControls}
        onReady={onReady}
        className={props.theme || "dockview-theme-abyss"}
      />
    </div>
  )
}

export default DockviewSail
