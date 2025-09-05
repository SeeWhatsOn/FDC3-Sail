import "./App.css"
import { SidebarProvider } from "sail-ui"

import DockviewSail from "./components/layout-grid/DockViewSail"
import { AppSidebar } from "./components/menu/AppSidebar"
import { HeaderBar } from "./components/HeaderBar"
import { ThemeProvider } from "./components/theme/theme-provider"

function App() {
  return (
    <ThemeProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <HeaderBar />
          <div className="flex-1 overflow-hidden">
            <DockviewSail />
          </div>
        </main>
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
