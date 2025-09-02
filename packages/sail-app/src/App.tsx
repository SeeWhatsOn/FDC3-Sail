import "./App.css"
import { useState } from "react"

import DockviewSail, { AppPanel } from "./components/grid/dockViewSail"
import Layout from "./components/menu/Menu"

// Mock data that simulates what would come from Zustand store
const MOCK_PANELS: AppPanel[] = [
  {
    title: "Trading Terminal",
    url: "https://tradingview.com/chart/",
    tabId: "One",
    panelId: "trading-1",
    appId: "tradingview",
    icon: null,
  },
  {
    title: "Market Data",
    url: "https://polygon.io/dashboard",
    tabId: "One",
    panelId: "market-1",
    appId: "polygon",
    icon: null,
  },
  {
    title: "News Feed",
    url: "https://benzinga.com/news",
    tabId: "Two",
    panelId: "news-1",
    appId: "benzinga",
    icon: null,
  },
]

function App() {
  const [panels] = useState<AppPanel[]>(MOCK_PANELS)
  const [activeTabId] = useState("One")

  return (
    <Layout>
      <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min">
        <DockviewSail
          externalPanels={panels}
          activeTabId={activeTabId}
          onPanelAdd={panel => console.log("Panel added:", panel)}
          onPanelRemove={panelId => console.log("Panel removed:", panelId)}
          onPanelUpdate={panel => console.log("Panel updated:", panel)}
        />
      </div>
    </Layout>
  )
}

export default App
