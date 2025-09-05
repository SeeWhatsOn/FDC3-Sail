import {
  DockviewDefaultTab,
  DockviewReact,
  DockviewReadyEvent,
  IDockviewPanelHeaderProps,
  IDockviewPanelProps,
  DockviewApi,
} from "dockview-react"
import { useState, useEffect, useRef } from "react"

import "./styles.css"
import { FDC3Panel, FDC3AppPanel } from "../fdc3-iframe/FDC3Panel"
import { DefaultTabComponent } from "./DefaultTabComponent"
import { useDesktopAgent } from "../../hooks/useDesktopAgent"

import { LeftControls, PrefixHeaderControls, RightControls } from "./Controls"
import { defaultConfig } from "./config"

// Simple panel interface for Zustand integration
export interface AppPanel {
  title: string
  url: string
  tabId: string
  panelId: string
  appId: string
  icon: string | null
}

const components = {
  default: (props: IDockviewPanelProps) => {
    return (
      <div
        style={{
          height: "100%",
          overflow: "auto",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DefaultTabComponent />
      </div>
    )
  },
  fdc3: (props: IDockviewPanelProps) => {
    const panelData = (props.params as { panel?: FDC3AppPanel })?.panel

    if (!panelData) {
      return <div className="p-4 text-red-500">Error: No panel data provided</div>
    }

    return <FDC3Panel {...props} panel={panelData} />
  },
}

const headerComponents = {
  default: (props: IDockviewPanelHeaderProps) => {
    const onContextMenu = (event: React.MouseEvent) => {
      event.preventDefault()
      alert("context menu")
    }
    return <DockviewDefaultTab onContextMenu={onContextMenu} {...props} />
  },
}

interface DockviewSailProps {
  theme?: string
  // Optional store integration
  externalPanels?: AppPanel[]
  activeTabId?: string
  onPanelAdd?: (panel: FDC3AppPanel) => void
  onPanelRemove?: (panelId: string) => void
  onPanelUpdate?: (panel: FDC3AppPanel) => void
}

const DockviewSail = (props: DockviewSailProps) => {
  const api = useRef<DockviewApi | undefined>(undefined)
  const [mountedPanels, setMountedPanels] = useState<Map<string, FDC3AppPanel>>(new Map())
  const [_panels, setPanels] = useState<string[]>([])
  const [_groups, setGroups] = useState<string[]>([])

  const { disconnectSocket } = useDesktopAgent()

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      disconnectSocket()
    }
  }, [disconnectSocket])

  const onReady = (event: DockviewReadyEvent) => {
    api.current = event.api
    setPanels([])
    setGroups([])
  }

  useEffect(() => {
    if (!api.current) {
      return
    }

    const disposables = [
      api.current.onDidAddPanel(event => {
        setPanels(_ => [..._, event.id])
        // If this panel was added externally, notify the store
        const panel = mountedPanels.get(event.id)
        if (panel && props.onPanelAdd) {
          props.onPanelAdd(panel)
        }
      }),
      api.current.onDidRemovePanel(event => {
        setPanels(_ => {
          const next = [..._]
          next.splice(
            next.findIndex(x => x === event.id),
            1
          )

          return next
        })
        // Clean up desktop agent registration
        // TODO: Implement window unregistration when needed
        // Notify the store about panel removal
        if (props.onPanelRemove) {
          props.onPanelRemove(event.id)
        }
      }),

      api.current.onDidAddGroup(event => {
        setGroups(_ => [..._, event.id])
      }),

      api.current.onDidRemoveGroup(event => {
        setGroups(_ => {
          const next = [..._]
          next.splice(
            next.findIndex(x => x === event.id),
            1
          )

          return next
        })
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

    if (!success && !props.externalPanels?.length) {
      defaultConfig(api.current)
    }

    return () => disposables.forEach(disposable => disposable.dispose())
  }, [mountedPanels, props])

  // Sync with external panels when they change
  useEffect(() => {
    if (!api.current || !props.externalPanels || !props.activeTabId) return

    const tabPanels = props.externalPanels.filter(p => p.tabId === props.activeTabId)
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
  }, [props.externalPanels, props.activeTabId, mountedPanels])

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
        components={components}
        defaultTabComponent={headerComponents.default}
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
