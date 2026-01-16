import { createContext } from "react"
import type { createSailBrowserDesktopAgent } from "@finos/sail-platform-sdk"
import type { createAppDirectoryStore } from "../stores/app-directory-store"
import type { createConnectionStore } from "../stores/connection-store"
import type { createIntentResolverStore } from "../stores/intent-resolver-store"

type SailDesktopAgentInstance = ReturnType<typeof createSailBrowserDesktopAgent>

export interface SailDesktopAgentContextValue {
  sailAgent: SailDesktopAgentInstance
  useAppDirectoryStore: ReturnType<typeof createAppDirectoryStore>
  useConnectionStore: ReturnType<typeof createConnectionStore>
  useIntentResolverStore: ReturnType<typeof createIntentResolverStore>
}

export const SailDesktopAgentContext = createContext<SailDesktopAgentContextValue>(
  {} as SailDesktopAgentContextValue
)
