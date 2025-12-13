import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createSailBrowserDesktopAgent } from "@finos/sail-api"

import "./index.css"
import App from "./App"
import { SailDesktopAgentProvider } from "./contexts/SailDesktopAgentContext"

// Initialize the FDC3 Desktop Agent BEFORE React renders
// This ensures the agent is listening for WCP1Hello messages when getAgent() is called
console.log("[Sail] Initializing FDC3 Desktop Agent")

const sailAgent = createSailBrowserDesktopAgent({
  debug: true,
  // App directories will be loaded by the app directory store
  appDirectories: [],
})

// Start the agent - this begins listening for WCP1Hello messages
sailAgent.start()

console.log("[Sail] FDC3 Browser Desktop Agent started and listening for connections")
console.log(sailAgent.desktopAgent.getAppDirectory())

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SailDesktopAgentProvider sailAgent={sailAgent}>
      <App />
    </SailDesktopAgentProvider>
  </StrictMode>
)
