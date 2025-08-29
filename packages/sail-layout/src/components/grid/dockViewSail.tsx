import {
  DockviewDefaultTab,
  DockviewReact,
  DockviewReadyEvent,
  IDockviewPanelHeaderProps,
  IDockviewPanelProps,
  DockviewApi,
} from "dockview"
import React from "react"
import "./styles.css"
import { LeftControls, PrefixHeaderControls, RightControls } from "./controls"

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
  iframe: (props: IDockviewPanelProps) => {
    return (
      <iframe
        onMouseDown={() => {
          if (!props.api.isActive) {
            props.api.setActive()
          }
        }}
        style={{
          width: "100%",
          height: "100%",
        }}
        src="https://dockview.dev"
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

const DockviewSail = (props: { theme?: string }) => {
  const [panels, setPanels] = React.useState<string[]>([])
  const [groups, setGroups] = React.useState<string[]>([])
  const [api, setApi] = React.useState<DockviewApi>()

  const [activePanel, setActivePanel] = React.useState<string>()
  const [activeGroup, setActiveGroup] = React.useState<string>()

  const onReady = (event: DockviewReadyEvent) => {
    setApi(event.api)
    setPanels([])
    setGroups([])
    setActivePanel(undefined)
    setActiveGroup(undefined)
  }

  React.useEffect(() => {
    if (!api) {
      return
    }

    const disposables = [
      api.onDidAddPanel(event => {
        setPanels(_ => [..._, event.id])
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

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        // padding: "8px",
        backgroundColor: "rgba(0,0,50,0.25)",
        borderRadius: "8px",
      }}
    >
      <div
        style={{
          flexGrow: 1,
          overflow: "hidden",
          // flexBasis: 0
          height: 0,
          display: "flex",
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
    </div>
  )
}

export default DockviewSail
