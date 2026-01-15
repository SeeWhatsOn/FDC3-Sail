import { useContext } from "react"
import type { createSailBrowserDesktopAgent } from "@finos/sail-platform-sdk"

import type { AppDirectoryStore } from "../stores/app-directory-store"
import type { ConnectionStore } from "../stores/connection-store"
import type { IntentResolverStore } from "../stores/intent-resolver-store"

import { SailDesktopAgentContext } from "./SailDesktopAgentContextValue"

type SailDesktopAgentInstance = ReturnType<typeof createSailBrowserDesktopAgent>

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
