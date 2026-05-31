import type { AppMetadata, Context } from "@finos/fdc3"

/** Handler option for programmatic intent resolution (matches desktop-agent shape). */
export type IntentHandlerOption = AppMetadata & {
  isRunning: boolean
}

/** Request payload for programmatic intent resolution. */
export type IntentResolutionRequest = {
  requestId: string
  intent: string
  context: Context
  handlers: IntentHandlerOption[]
}

/** One mounted conformance app iframe in the harness host. */
export type HarnessPanel = {
  instanceId: string
  appId: string
  url: string
  title?: string
}

/** React host state for mounted app panels. */
export type HarnessState = {
  panels: HarnessPanel[]
}
