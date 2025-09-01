import { IDockviewPanelProps } from "dockview"
import { useCallback } from "react"

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
}

export const FDC3Panel = ({ panel, onAppWindowRegister }: FDC3PanelProps) => {
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

  return (
    <iframe
      ref={handleIframeRef}
      src={panel.url}
      name={panel.panelId}
      style={{
        width: '100%',
        height: '100%', 
        border: 'none',
        margin: 0,
        padding: 0,
        display: 'block'
      }}
    />
  )
}