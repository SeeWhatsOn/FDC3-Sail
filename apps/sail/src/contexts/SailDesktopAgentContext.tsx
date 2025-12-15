import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { createSailBrowserDesktopAgent } from "@finos/sail-api"
import { createAppDirectoryStore, type AppDirectoryStore } from "../stores/app-directory-store"
import { createConnectionStore, type ConnectionStore } from "../stores/connection-store"
import { createIntentResolverStore, type IntentResolverStore } from "../stores/intent-resolver-store"

type SailDesktopAgentInstance = ReturnType<typeof createSailBrowserDesktopAgent>

interface SailDesktopAgentContextValue {
  sailAgent: SailDesktopAgentInstance
  useAppDirectoryStore: () => AppDirectoryStore
  useConnectionStore: () => ConnectionStore
  useIntentResolverStore: () => IntentResolverStore
}

const SailDesktopAgentContext = createContext<SailDesktopAgentContextValue | null>(null)

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
    <SailDesktopAgentContext.Provider value={value}>
      {children}
    </SailDesktopAgentContext.Provider>
  )
}

export function useSailDesktopAgent(): SailDesktopAgentInstance {
  const context = useContext(SailDesktopAgentContext)
  if (!context) {
    throw new Error("useSailDesktopAgent must be used within SailDesktopAgentProvider")
  }
  return context.sailAgent
}

export function useAppDirectoryStore(): AppDirectoryStore {
  const context = useContext(SailDesktopAgentContext)
  if (!context) {
    throw new Error("useAppDirectoryStore must be used within SailDesktopAgentProvider")
  }
  return context.useAppDirectoryStore()
}

export function useConnectionStore(): ConnectionStore {
  const context = useContext(SailDesktopAgentContext)
  if (!context) {
    throw new Error("useConnectionStore must be used within SailDesktopAgentProvider")
  }
  return context.useConnectionStore()
}

export function useIntentResolverStore(): IntentResolverStore {
  const context = useContext(SailDesktopAgentContext)
  if (!context) {
    throw new Error("useIntentResolverStore must be used within SailDesktopAgentProvider")
  }
  return context.useIntentResolverStore()
}
