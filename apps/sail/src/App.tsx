import { SidebarProvider } from "sail-ui"

import { AppSidebar } from "./components/sidebar/AppSidebar"
import { ThemeProvider } from "./components/theme/theme-provider"
import { Workspace } from "./components/workspace/Workspace"
import Layout from "./components/layout-grid/Layout"
import { QuickAccessPanel } from "./components/quick-access-panel"
import { useBrowserAgent } from "./hooks/use-browser-agent"

function App() {
  // Initialize the browser-side FDC3 Desktop Agent for the Sail UI
  // This makes fdc3.getAgent() available for programmatic FDC3 access
  useBrowserAgent()

  return (
    <ThemeProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <Workspace>
            <Layout />
          </Workspace>
        </main>
        <QuickAccessPanel />
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
