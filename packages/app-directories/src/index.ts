// Export app directory entries for programmatic access

// Example apps (our internal examples)
import benzingaDirectory from "../examples/benzinga.json"
import polygonDirectory from "../examples/polygon.json"
import tradingViewDirectory from "../examples/trading-view.json"
import trainingDirectory from "../examples/training.json"
import sailDirectory from "../examples/sail.json"

// External apps (reference implementations)
import workbenchDirectory from "../external/workbench.json"
import conformanceDirectory from "../external/conformance.json"

// Re-export individual directories
export {
  benzingaDirectory,
  polygonDirectory,
  tradingViewDirectory,
  trainingDirectory,
  sailDirectory,
  workbenchDirectory,
  conformanceDirectory,
}

// Convenience exports
export const exampleDirectories = [
  benzingaDirectory,
  polygonDirectory,
  tradingViewDirectory,
  trainingDirectory,
  sailDirectory,
]

export const externalDirectories = [workbenchDirectory, conformanceDirectory]

export const allDirectories = [...exampleDirectories, ...externalDirectories]
