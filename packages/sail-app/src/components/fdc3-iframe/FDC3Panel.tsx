import { IDockviewPanelProps } from "dockview"
import { useCallback, useEffect, useRef } from "react"
import { useFDC3Connection } from "../../hooks/useFDC3Connection"

/**
 * In this coponent we create the iframe to insert the FDC3 App.
 * WCP happpens like so:
 *    1. Desktop Agent Loads App into Iframe
      2. FDC3 app calls getAgent()
      3. Desktop Agent responds & Establishes Channel
      4. FDC3 api is ready in the fdc3 app

      ```mermaid
      sequenceDiagram
    participant App
    participant Desktop Agent

    App->>Desktop Agent: **Step 1: WCP1Hello** (App Initiates)
    Note over Desktop Agent: (Optional) Can redirect with WCP2LoadUrl
    Desktop Agent-->>App: **Step 3: WCP3Handshake** (DA Responds with Channel)
    Note over App, Desktop Agent: Communication now on secure MessageChannel
    App->>Desktop Agent: **Step 4: WCP4ValidateAppIdentity** (App Sends ID)
    Desktop Agent-->>App: **Step 5: WCP5ValidateAppIdentityResponse** (DA Confirms)
    ```
 *
 */
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
}

export const FDC3Panel = ({ panel }: FDC3PanelProps) => {
  const { registerWindow } = useFDC3Connection(panel.panelId)
  const cleanupRef = useRef<(() => void) | null>(null)

  const handleIframeRef = useCallback(
    (ref: HTMLIFrameElement | null) => {
      // Clean up previous registration
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }

      if (ref) {
        setTimeout(() => {
          const contentWindow = ref.contentWindow
          if (contentWindow) {
            cleanupRef.current = registerWindow(contentWindow)
          }
        }, 10)
      }
    },
    [panel.panelId, registerWindow]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  return (
    <iframe
      ref={handleIframeRef}
      src={panel.url}
      name={panel.panelId}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        margin: 0,
        padding: 0,
        display: "block",
      }}
    />
  )
}
