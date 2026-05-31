import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import type { HarnessPanel } from "./types"

type AppProps = {
  initialPanels: HarnessPanel[]
  onPanelsChange?: (setter: Dispatch<SetStateAction<HarnessPanel[]>>) => void
}

/**
 * Minimal unstyled host: one iframe per mounted panel plus a debug list.
 */
export default function App({ initialPanels, onPanelsChange }: AppProps) {
  const [panels, setPanels] = useState<HarnessPanel[]>(initialPanels)

  useEffect(() => {
    onPanelsChange?.(setPanels)
  }, [onPanelsChange])

  return (
    <div>
      <h1>FDC3 Conformance Harness</h1>
      <section>
        <h2>Mounted panels</h2>
        <ul>
          {panels.map(panel => (
            <li key={panel.instanceId}>
              {panel.title ?? panel.appId} — {panel.instanceId}
            </li>
          ))}
        </ul>
      </section>
      <section>
        {panels.map(panel => (
          <div key={panel.instanceId}>
            <div>{panel.title ?? panel.appId}</div>
            <iframe
              name={panel.instanceId}
              src={panel.url}
              title={panel.title ?? panel.appId}
              style={{ width: "100%", height: "600px", border: "1px solid #ccc" }}
            />
          </div>
        ))}
      </section>
    </div>
  )
}
