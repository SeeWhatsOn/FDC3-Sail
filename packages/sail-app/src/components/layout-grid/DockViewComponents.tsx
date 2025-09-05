import { IDockviewPanelHeaderProps, IDockviewPanelProps } from "dockview-react"
import { DockviewDefaultTab } from "dockview-react"

import { FDC3Panel, FDC3AppPanel } from "./panels/FDC3IframePanel"
import { DefaultTabComponent } from "./panels/DefaultTabComponent"

export const dockViewComponents = {
  default: () => {
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

export const dockViewHeaderComponents = {
  default: (props: IDockviewPanelHeaderProps) => {
    return <DockviewDefaultTab {...props} />
  },
}
