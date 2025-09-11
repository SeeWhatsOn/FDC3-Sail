import "./App.css"
import { SidebarProvider } from "sail-ui"

import { AppSidebar } from "./components/sidebar/AppSidebar"
import { IconButton } from "./components/IconButton"
import { ThemeProvider } from "./components/theme/theme-provider"
import { Workspace } from "./components/workspace/Workspace"
import Layout from "./components/layout-grid/Layout"

function App() {
  return (
    <ThemeProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Workspace>
            <Layout />
          </Workspace>
        </main>
        <IconButton />
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
