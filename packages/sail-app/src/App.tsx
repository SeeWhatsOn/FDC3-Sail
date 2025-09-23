import "./App.css"
import { SidebarProvider, Sheet, SheetContent } from "sail-ui"

import { AppSidebar } from "./components/sidebar/AppSidebar"
import { IconButton } from "./components/IconButton"
import { ThemeProvider } from "./components/theme/theme-provider"
import { Workspace } from "./components/workspace/Workspace"
import Layout from "./components/layout-grid/Layout"
import { AppDirectory } from "./components/app-directory/AppDirectory"
import { useUIStore } from "./stores/uiStore"

function App() {
  const { displayAppDirectory, closeAppDirectory } = useUIStore()

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

        <Sheet open={displayAppDirectory} onOpenChange={closeAppDirectory}>
          <SheetContent
            side="left"
            className="w-full sm:max-w-none p-0 overflow-y-auto"
          >
            <AppDirectory />
          </SheetContent>
        </Sheet>
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default App
