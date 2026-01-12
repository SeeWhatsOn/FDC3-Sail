import { createContext } from "react"
import type { createSailBrowserDesktopAgent } from "@finos/sail-api"

import type { AppDirectoryStore } from "../stores/app-directory-store"
import type { ConnectionStore } from "../stores/connection-store"
import type { IntentResolverStore } from "../stores/intent-resolver-store"

type SailDesktopAgentInstance = ReturnType<typeof createSailBrowserDesktopAgent>

export interface SailDesktopAgentContextValue {
  sailAgent: SailDesktopAgentInstance
  useAppDirectoryStore: () => AppDirectoryStore
  useConnectionStore: () => ConnectionStore
  useIntentResolverStore: () => IntentResolverStore
}

export const SailDesktopAgentContext = createContext<SailDesktopAgentContextValue | null>(null)



