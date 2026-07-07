import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App"
import { createHarnessBootstrap } from "./harness-bootstrap"

const bootstrap = createHarnessBootstrap()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App
      initialPanels={bootstrap.initialPanels}
      onPanelsChange={bootstrap.onPanelsChange}
      toolboxProfile={bootstrap.toolboxProfile}
      toolboxOrigin={bootstrap.toolboxOrigin}
      fdc3Version={bootstrap.fdc3Version}
    />
  </StrictMode>,
)
