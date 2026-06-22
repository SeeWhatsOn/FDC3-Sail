import { useContext } from "react"
import type { SailDesktopAgent } from "@finos/sail-platform-api"

import type { AppDirectoryStore } from "../stores/app-directory-store"
import type { ConnectionStore } from "../stores/connection-store"
import type { IntentResolverStore } from "../stores/intent-resolver-store"

import { SailDesktopAgentContext } from "./sail-desktop-agent-context-value"

export function useSailDesktopAgent(): SailDesktopAgent {
  const context = useContext(SailDesktopAgentContext)
  if (!context) {
    throw new Error("useSailDesktopAgent must be used within SailDesktopAgentProvider")
  }
  return context.agent
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
