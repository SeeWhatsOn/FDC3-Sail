import "./App.css"
import { useState } from "react"
import { SidebarProvider } from "sail-ui"

import DockviewSail, { AppPanel } from "./components/layout-grid/DockViewSail"
import { AppSidebar } from "./components/menu/AppSidebar"
import { HeaderBar } from "./components/HeaderBar"
import { ThemeProvider } from "./components/theme/theme-provider"

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
    <ThemeProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <HeaderBar />
          <div className="flex-1 overflow-hidden">
            <DockviewSail
              externalPanels={panels}
              activeTabId={activeTabId}
              onPanelAdd={panel => console.log("Panel added:", panel)}
              onPanelRemove={panelId => console.log("Panel removed:", panelId)}
              onPanelUpdate={panel => console.log("Panel updated:", panel)}
            />
          </div>
        </main>
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
