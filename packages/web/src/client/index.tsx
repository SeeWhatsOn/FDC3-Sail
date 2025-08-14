import { createRoot } from "react-dom/client"

import { getClientState, getAppState, getServerState } from "../state"

import { Frame } from "./frame/frame"

const container = document.getElementById("app")
const root = createRoot(container!)
root.render(<Frame cs={getClientState()} as={getAppState()} />)

getClientState().addStateChangeCallback(() => {
  root.render(<Frame cs={getClientState()} as={getAppState()} />)
})

getAppState().addStateChangeCallback(() => {
  root.render(<Frame cs={getClientState()} as={getAppState()} />)
})

getServerState()
  .registerDesktopAgent(getClientState().createArgs())
  .catch(error => {
    console.error("Error registering desktop agent:", error)
  })

getAppState().init(getServerState(), getClientState())
