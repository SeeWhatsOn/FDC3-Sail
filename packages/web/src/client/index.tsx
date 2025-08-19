import { createRoot } from "react-dom/client"

import { getServerState, getClientState } from "../state"
import { useServerStore } from "../stores/useServerStore"

import { Frame } from "./frame/frame"

// Modern index entry point using Zustand stores
const container = document.getElementById("app")
const root = createRoot(container!)

// Initialize server connection
const serverStore = useServerStore.getState()
serverStore.connect()

// Register desktop agent with server
serverStore.registerDesktopAgent(getClientState().createArgs()).catch(error => {
  console.error("Error registering desktop agent:", error)
})

// Initialize app state (still using legacy for now)
const appState = getClientState()
getServerState()
  .registerDesktopAgent(appState.createArgs())
  .catch(error => {
    console.error("Error registering desktop agent:", error)
  })

// Render modern Frame component
// The Frame component will handle its own state subscriptions
root.render(<Frame />)

console.log("🚀 FDC3 Sail - Modern Frame Implementation Loaded")
