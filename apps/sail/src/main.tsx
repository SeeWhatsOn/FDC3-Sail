import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserDesktopAgent } from "@finos/sail-api"

import "./index.css"
import App from "./App"

// Initialize the FDC3 Desktop Agent BEFORE React renders
// This ensures the agent is listening for WCP1Hello messages when getAgent() is called
console.log("[Sail] Initializing FDC3 Desktop Agent")

const browserAgent = createBrowserDesktopAgent({
  wcpOptions: {
    // Sail UI controls resolver/selector, so return false
    getIntentResolverUrl: () => false,
    getChannelSelectorUrl: () => false,
  },
  appDirectories: [],
})

// Start the agent - this begins listening for WCP1Hello messages
browserAgent.start()

console.log("[Sail] FDC3 Browser Desktop Agent started and listening for connections")
// Store reference globally for debugging/access
;(window as Window).__sailDesktopAgent = browserAgent
console.log(browserAgent.desktopAgent.getAppDirectory())
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
