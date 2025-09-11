import { IDockviewPanelProps } from "dockview-react"

import { FDC3Panel, FDC3AppPanel } from "./panel-templates/FDC3IframePanel"
import { AppDirectory } from "../app-directory/AppDirectory"

export const Panels = {
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
        <AppDirectory />
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
