import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createSailBrowserDesktopAgent } from "@finos/sail-api"
import { allApplications } from "@finos/fdc3-sail-example-apps/manifests"

import "./index.css"
import App from "./App"
import { SailDesktopAgentProvider } from "./contexts/SailDesktopAgentContext"

// Initialize the FDC3 Desktop Agent BEFORE React renders
// This ensures the agent is listening for WCP1Hello messages when getAgent() is called
console.log("[Sail] Initializing FDC3 Desktop Agent")

const sailAgent = createSailBrowserDesktopAgent({
  debug: true,
})

// Load example apps into the app directory
const appDirectory = sailAgent.desktopAgent.getAppDirectory()
for (const app of allApplications) {
  appDirectory.add(app)
}
console.log(`[Sail] Loaded ${allApplications.length} apps into app directory`)

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
