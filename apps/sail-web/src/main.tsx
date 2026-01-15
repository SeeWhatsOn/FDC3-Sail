import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createSailBrowserDesktopAgent, SailAppLauncher, type DirectoryApp } from "@finos/sail-platform-sdk"
import { defaultApplications } from "@finos/fdc3-sail-example-apps/manifests"
import type { AppMetadata } from "@finos/fdc3"

import "./index.css"
import App from "./App"
import { SailDesktopAgentProvider } from "./contexts"
import { useWorkspaceStore } from "./stores/workspace-store"

// Initialize the FDC3 Desktop Agent BEFORE React renders
// This ensures the agent is listening for WCP1Hello messages when getAgent() is called
console.log("[Sail] Initializing FDC3 Desktop Agent")

// Create app launcher that integrates with Sail UI workspace store
const appLauncher = new SailAppLauncher({
  onLaunchApp: async (appMetadata: AppMetadata, instanceId: string, _context?: unknown) => {
    const workspaceStore = useWorkspaceStore.getState()
    const { activeWorkspaceId } = workspaceStore

    if (!activeWorkspaceId) {
      throw new Error("No active workspace available")
    }

    // Get active tab for the workspace
    const workspace = workspaceStore.getWorkspace(activeWorkspaceId)
    if (!workspace) {
      throw new Error(`Workspace ${activeWorkspaceId} not found`)
    }

    const activeTabId = workspace.layout.activeTabId
    if (!activeTabId) {
      throw new Error(`No active tab in workspace ${activeWorkspaceId}`)
    }

    // Extract app details from metadata
    const metadata = appMetadata as any
    const webDetails = metadata.details as { url?: string } | undefined
    const url = webDetails?.url
    if (!url) {
      throw new Error(`App ${appMetadata.appId} has no URL in metadata`)
    }

    // Pre-register the instance in the Desktop Agent's AppInstanceRegistry
    // This allows the app to reconnect to this instanceId via WCP4
    // We'll need to access the desktop agent after it's created, so we'll do this
    // in a callback after sailAgent is created

    // Create panel for the app
    const panel = {
      panelId: instanceId,
      appId: appMetadata.appId,
      title: appMetadata.title || appMetadata.name || appMetadata.appId,
      url,
      icon: appMetadata.icons?.[0]?.src || null,
    }

    // Add panel to the active workspace and tab
    workspaceStore.addPanel(activeWorkspaceId, activeTabId, panel)

    console.log(`[Sail] Launched app ${appMetadata.appId} as panel ${instanceId}`, {
      workspaceId: activeWorkspaceId,
      tabId: activeTabId,
      url,
    })
  },
})

const sailAgent = createSailBrowserDesktopAgent({
  debug: true,
  appLauncher,
})

// Load default apps into the app directory (news, charts, yahoo, tradingview, benzinga, wcp-test)
const appDirectory = sailAgent.desktopAgent.getAppDirectory()
for (const app of defaultApplications) {
  appDirectory.add(app as unknown as DirectoryApp)
}
console.log(`[Sail] Loaded ${defaultApplications.length} apps into app directory`)

// Sync app directory to intent registry so apps can be found for intents
sailAgent.desktopAgent.syncAppDirectoryToIntentRegistry()
console.log("[Sail] Synced app directory to intent registry")

// Start the agent - this begins listening for WCP1Hello messages
sailAgent.start()

console.log("[Sail] FDC3 Browser Desktop Agent started and listening for connections")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SailDesktopAgentProvider sailAgent={sailAgent}>
      <App />
    </SailDesktopAgentProvider>
  </StrictMode>
)
