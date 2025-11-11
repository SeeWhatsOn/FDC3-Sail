import "./App.css"
import { SidebarProvider } from "sail-ui"

import { AppSidebar } from "./components/sidebar/AppSidebar"
import { IconButton } from "./components/IconButton"
import { ThemeProvider } from "./components/theme/theme-provider"
import { Workspace } from "./components/workspace/Workspace"
import Layout from "./components/layout-grid/Layout"
import { QuickAccessPanel } from "./components/quick-access-panel"

function App() {
  return (
    <ThemeProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <Workspace>
            <Layout />
          </Workspace>
        </main>
        {/* <IconButton /> */}
        <QuickAccessPanel />
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
