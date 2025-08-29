import {
  DockviewDefaultTab,
  DockviewReact,
  DockviewReadyEvent,
  IDockviewPanelHeaderProps,
  IDockviewPanelProps,
  DockviewApi,
} from "dockview"
import { useState, useEffect } from "react"
import "./styles.css"
import { LeftControls, PrefixHeaderControls, RightControls } from "./controls"
import { FDC3Panel, FDC3AppPanel } from "../fdc3-iframe"
import { DockviewStateImpl, LegacyAppPanel } from "./dockviewState"

export function defaultConfig(api: DockviewApi) {
  const panel1 = api.addPanel({
    id: "panel_1",
    component: "default",
    renderer: "always",
    title: "Panel 1",
  })

  api.addPanel({
    id: "panel_2",
    component: "default",
    title: "Panel 2",
    position: { referencePanel: panel1 },
  })

  api.addPanel({
    id: "panel_3",
    component: "default",
    title: "Panel 3",
    position: { referencePanel: panel1 },
  })

  const panel4 = api.addPanel({
    id: "panel_4",
    component: "default",
    title: "Panel 4",
    position: { referencePanel: panel1, direction: "right" },
  })

  const panel5 = api.addPanel({
    id: "panel_5",
    component: "default",
    title: "Panel 5",
    position: { referencePanel: panel4 },
  })

  const panel6 = api.addPanel({
    id: "panel_6",
    component: "default",
    title: "Panel 6",
    position: { referencePanel: panel5, direction: "below" },
  })

  const panel7 = api.addPanel({
    id: "panel_7",
    component: "default",
    title: "Panel 7",
    position: { referencePanel: panel6, direction: "left" },
  })

  api.addPanel({
    id: "panel8",
    component: "default",
    title: "Panel 8",
    position: { referencePanel: panel7, direction: "below" },
  })

  panel1.api.setActive()
}

const components = {
  default: (props: IDockviewPanelProps) => {
    return (
      <div
        style={{
          height: "100%",
          overflow: "auto",
          color: "white",
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
            fontSize: "42px",
            opacity: 0.5,
          }}
        >
          {props.api.title}
        </span>
      </div>
    )
  },
  fdc3: (props: IDockviewPanelProps) => {
    const panelData = (props.params as { panel?: FDC3AppPanel })?.panel

    if (!panelData) {
      return <div className="p-4 text-red-500">Error: No panel data provided</div>
    }

    return (
      <FDC3Panel
        {...props}
        panel={panelData}
        onAppWindowRegister={(contentWindow, panelId) => {
          console.log("App window registered:", panelId, contentWindow)
        }}
        onClose={panelId => {
          console.log("Panel close requested:", panelId)
          props.api.close()
        }}
      />
    )
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
  externalPanels?: LegacyAppPanel[]
  activeTabId?: string
  onPanelAdd?: (panel: FDC3AppPanel) => void
  onPanelRemove?: (panelId: string) => void
  onPanelUpdate?: (panel: FDC3AppPanel) => void
}

const DockviewSail = (props: DockviewSailProps) => {
  const [_panels, setPanels] = useState<string[]>([])
  const [_groups, setGroups] = useState<string[]>([])
  const [api, setApi] = useState<DockviewApi>()
  const [dockviewState] = useState(() => new DockviewStateImpl())

  const [_activePanel, setActivePanel] = useState<string>()
  const [_activeGroup, setActiveGroup] = useState<string>()

  const onReady = (event: DockviewReadyEvent) => {
    setApi(event.api)
    dockviewState.setApi(event.api)
    setPanels([])
    setGroups([])
    setActivePanel(undefined)
    setActiveGroup(undefined)
  }

  useEffect(() => {
    if (!api) {
      return
    }

    const disposables = [
      api.onDidAddPanel(event => {
        setPanels(_ => [..._, event.id])
        // If this panel was added externally (not through Zustand), notify the store
        const panel = dockviewState.getPanel(event.id)
        if (panel && props.onPanelAdd) {
          props.onPanelAdd(panel)
        }
      }),
      api.onDidActivePanelChange(event => {
        setActivePanel(event?.id)
      }),
      api.onDidRemovePanel(event => {
        setPanels(_ => {
          const next = [..._]
          next.splice(
            next.findIndex(x => x === event.id),
            1
          )

          return next
        })
        // Notify the store about panel removal
        if (props.onPanelRemove) {
          props.onPanelRemove(event.id)
        }
      }),

      api.onDidAddGroup(event => {
        setGroups(_ => [..._, event.id])
      }),

      api.onDidRemoveGroup(event => {
        setGroups(_ => {
          const next = [..._]
          next.splice(
            next.findIndex(x => x === event.id),
            1
          )

          return next
        })
      }),
      api.onDidActiveGroupChange(event => {
        setActiveGroup(event?.id)
      }),
    ]

    let success = false

    const state = localStorage.getItem("dv-demo-state")
    if (state) {
      try {
        api.fromJSON(JSON.parse(state))
        success = true
      } catch {
        localStorage.removeItem("dv-demo-state")
      }
    }

    if (!success) {
      defaultConfig(api)
    }

    return disposables.forEach(disposable => disposable.dispose())
  }, [api])

  // Sync with external panels when they change
  useEffect(() => {
    if (props.externalPanels && props.activeTabId) {
      dockviewState.syncWithPanels(props.externalPanels, props.activeTabId)
    }
  }, [props.externalPanels, props.activeTabId, dockviewState])

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        flex: 1
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
