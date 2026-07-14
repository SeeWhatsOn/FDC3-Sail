import "./styles/global.css"
import { Frame } from "./frame/frame"
import { createRoot } from "react-dom/client"
import { getClientState, getServerState, bindClientStateToHost } from "./state"
import { useSailState } from "./state/useSailState"

function App() {
  useSailState()
  return <Frame cs={getClientState()} />
}

const container = document.getElementById("app")
const root = createRoot(container!)
root.render(<App />)

bindClientStateToHost()
void getServerState()
  .registerDesktopAgent(getClientState().createArgs())
  .catch((e) => {
    console.error("Failed to start browser Desktop Agent", e)
  })
