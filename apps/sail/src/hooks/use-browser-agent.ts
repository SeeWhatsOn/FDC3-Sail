import { useEffect, useRef } from "react"
import { createBrowserDesktopAgent, type BrowserDesktopAgentResult } from "@finos/sail-api"
import { getAgent } from "@finos/fdc3"

/**
 * Hook to initialize and provide the browser-side FDC3 Desktop Agent for the Sail UI.
 *
 * This creates a local FDC3 Desktop Agent that the Sail UI can use via `fdc3.getAgent()`.
 * This is separate from the iframe app connections which use WCP.
 *
 * The agent will be available globally via the standard FDC3 `getAgent()` method.
 */
export const useBrowserAgent = () => {
  const browserAgentRef = useRef<BrowserDesktopAgentResult | null>(null)
  const isInitialized = useRef(false)

  useEffect(() => {
    // Only initialize once
    if (isInitialized.current) {
      return
    }

    console.log("[BrowserAgent] Initializing FDC3 Desktop Agent for Sail UI")

    // Use async IIFE to avoid blocking
    const initAgent = async () => {
      try {
        // Create the browser desktop agent
        const browserAgent = createBrowserDesktopAgent({
          wcpOptions: {
            // Sail UI doesn't need WCP since it's not in an iframe
            // But we create the agent for programmatic FDC3 access
            getIntentResolverUrl: () => false,
            getChannelSelectorUrl: () => false,
          },
        })

        // Start the agent
        browserAgent.start()

        browserAgentRef.current = browserAgent
        isInitialized.current = true

        console.log("[BrowserAgent] Desktop Agent initialized successfully")
        console.log("[BrowserAgent] FDC3 agent available via fdc3.getAgent()")

        // Test that getAgent() works
        try {
          const agent = await getAgent()
          console.log("[BrowserAgent] Verified fdc3.getAgent() is working:", agent)
        } catch (err) {
          console.error("[BrowserAgent] Error testing fdc3.getAgent():", err)
        }
      } catch (error) {
        console.error("[BrowserAgent] Failed to initialize Desktop Agent:", error)
        console.error("[BrowserAgent] Stack trace:", error)
      }
    }

    // Initialize asynchronously without blocking render
    void initAgent()

    // Cleanup on unmount
    return () => {
      if (browserAgentRef.current) {
        console.log("[BrowserAgent] Cleaning up Desktop Agent")
        try {
          browserAgentRef.current.desktopAgent.stop()
          browserAgentRef.current.wcpConnector.stop()
        } catch (error) {
          console.error("[BrowserAgent] Error during cleanup:", error)
        }
        browserAgentRef.current = null
        isInitialized.current = false
      }
    }
  }, [])

  return {
    browserAgent: browserAgentRef.current,
    isReady: isInitialized.current,
  }
}
