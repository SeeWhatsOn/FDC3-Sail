/// <reference types="vite/client" />

import { Frame } from "./frame/frame"
import { createRoot } from "react-dom/client"
import {
  AppHosting,
  getClientState,
  getAppState,
  getServerState,
} from "@finos/fdc3-sail-common"

const CONFORMANCE_APP_TITLE = "FDC3 2.0 Conformance Framework"
const CONFORMANCE_DIRECTORY_LABEL = "FDC3 Conformance"
const E2E_BOOTSTRAP_KEY = "sail-e2e-conformance-bootstrapped"
const isE2ETest =
  import.meta.env.VITE_E2E_TEST === "1" ||
  import.meta.env.VITE_E2E_TEST === "true"

let e2eBootstrapInFlight = false

function renderApp() {
  root.render(<Frame cs={getClientState()} as={getAppState()} />)
}

async function maybeBootstrapConformanceForE2E() {
  if (!isE2ETest) {
    return
  }

  if (sessionStorage.getItem(E2E_BOOTSTRAP_KEY) === "1") {
    return
  }

  if (e2eBootstrapInFlight) {
    return
  }

  e2eBootstrapInFlight = true
  try {
    const cs = getClientState()
    const as = getAppState()

    const directories = cs.getDirectories()
    const conformanceDirectory = directories.find(
      (d) => d.label === CONFORMANCE_DIRECTORY_LABEL,
    )

    if (conformanceDirectory && !conformanceDirectory.active) {
      await cs.updateDirectory({
        ...conformanceDirectory,
        active: true,
      })
      return
    }

    const conformanceApp = cs
      .getKnownApps()
      .find((app) => app.title === CONFORMANCE_APP_TITLE)

    if (!conformanceApp) {
      return
    }

    const alreadyOpen = cs
      .getPanels()
      .some((panel) => panel.appId === conformanceApp.appId)
    if (alreadyOpen) {
      sessionStorage.setItem(E2E_BOOTSTRAP_KEY, "1")
      return
    }

    await as.open(conformanceApp, AppHosting.Frame)
    sessionStorage.setItem(E2E_BOOTSTRAP_KEY, "1")
  } finally {
    e2eBootstrapInFlight = false
  }
}

const container = document.getElementById("app")
const root = createRoot(container!)
renderApp()

getClientState().addStateChangeCallback(() => {
  renderApp()
  maybeBootstrapConformanceForE2E().catch((e: unknown) => {
    console.error("Failed to bootstrap conformance app for E2E", e)
  })
})

getAppState().addStateChangeCallback(() => {
  renderApp()
})

getServerState().registerDesktopAgent(getClientState().createArgs())

getAppState().init(getServerState(), getClientState())

maybeBootstrapConformanceForE2E().catch((e: unknown) => {
  console.error("Failed to bootstrap conformance app for E2E", e)
})
