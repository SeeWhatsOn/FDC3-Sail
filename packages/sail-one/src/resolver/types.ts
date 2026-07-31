import { Context } from "@finos/fdc3-context"
import { AppMetadata, IntentMetadata } from "@finos/fdc3-standard"
import type { TabDetail } from "../state/ClientState"

export type AugmentedAppMetadata = AppMetadata & {
  channelData: TabDetail | null
  instanceTitle?: string
}

export type AugmentedAppIntent = {
  intent: IntentMetadata
  apps: AugmentedAppMetadata[]
}

export interface IntentResolution {
  appIntents: AugmentedAppIntent[]
  requestId: string
  context: Context
}
