import { IDockviewPanelProps } from "dockview"
import { useCallback, useState } from "react"

export interface FDC3AppPanel {
  title: string
  url: string
  tabId: string
  panelId: string
  appId: string
  icon: string | null
}

interface FDC3PanelProps extends IDockviewPanelProps {
  panel: FDC3AppPanel
  onAppWindowRegister?: (contentWindow: Window, panelId: string) => void
  onClose?: (panelId: string) => void
}

export const FDC3Panel = ({ api, panel, onAppWindowRegister, onClose }: FDC3PanelProps) => {
  const [appState, _setAppState] = useState<"pending" | "connected" | "not-responding" | "terminated">("pending")

  const handleIframeRef = useCallback(
    (ref: HTMLIFrameElement | null) => {
      if (ref && onAppWindowRegister) {
        setTimeout(() => {
          const contentWindow = ref.contentWindow
          if (contentWindow) {
            onAppWindowRegister(contentWindow, panel.panelId)
          }
        }, 10)
      }
    },
    [panel.panelId, onAppWindowRegister]
  )

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose(panel.panelId)
    }
  }, [onClose, panel.panelId])

  const handleMouseDown = useCallback(() => {
    if (!api.isActive) {
      api.setActive()
    }
  }, [api])

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-100 border-b text-sm">
        <div className="flex items-center gap-2">
          {panel.icon && (
            <img src={panel.icon} alt="" className="w-4 h-4" />
          )}
          <span className="font-medium text-gray-700">{panel.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <div 
            className={`w-2 h-2 rounded-full ${
              appState === "connected" ? "bg-green-500" : 
              appState === "pending" ? "bg-yellow-500" : 
              appState === "not-responding" ? "bg-orange-500" : "bg-red-500"
            }`}
            title={appState}
          />
          <button 
            onClick={handleClose}
            className="w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded text-gray-500"
          >
            ×
          </button>
        </div>
      </div>
      <div className="flex-1 relative">
        <iframe
          ref={handleIframeRef}
          src={panel.url}
          name={panel.panelId}
          onMouseDown={handleMouseDown}
          className="w-full h-full border-none"
        />
      </div>
    </div>
  )
}