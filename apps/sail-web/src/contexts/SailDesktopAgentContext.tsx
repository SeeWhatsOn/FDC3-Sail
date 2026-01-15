import { useMemo, type ReactNode } from "react"
import type { createSailBrowserDesktopAgent } from "@finos/sail-platform-sdk"

import { createAppDirectoryStore } from "../stores/app-directory-store"
import { createConnectionStore } from "../stores/connection-store"
import { createIntentResolverStore } from "../stores/intent-resolver-store"

import { SailDesktopAgentContext } from "./SailDesktopAgentContextValue"

type SailDesktopAgentInstance = ReturnType<typeof createSailBrowserDesktopAgent>

interface SailDesktopAgentProviderProps {
  sailAgent: SailDesktopAgentInstance
  children: ReactNode
}

export function SailDesktopAgentProvider({ sailAgent, children }: SailDesktopAgentProviderProps) {
  // Create the app directory store once with the sailAgent injected
  const appDirectoryStore = useMemo(() => createAppDirectoryStore(sailAgent), [sailAgent])

  // Create the connection store once with the sailAgent injected
  const connectionStore = useMemo(() => createConnectionStore(sailAgent), [sailAgent])

  // Create the intent resolver store once with the sailAgent injected
  const intentResolverStore = useMemo(() => createIntentResolverStore(sailAgent), [sailAgent])

  const value = useMemo(
    () => ({
      sailAgent,
      useAppDirectoryStore: appDirectoryStore,
      useConnectionStore: connectionStore,
      useIntentResolverStore: intentResolverStore,
    }),
    [sailAgent, appDirectoryStore, connectionStore, intentResolverStore]
  )

  return (
    <SailDesktopAgentContext.Provider value={value}>{children}</SailDesktopAgentContext.Provider>
  )
}
