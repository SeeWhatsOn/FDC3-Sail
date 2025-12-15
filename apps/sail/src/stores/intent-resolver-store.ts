import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import type { createSailBrowserDesktopAgent } from "@finos/sail-api"

type SailDesktopAgentInstance = ReturnType<typeof createSailBrowserDesktopAgent>

/**
 * Handler option for intent resolution
 */
export interface IntentHandler {
  instanceId?: string
  appId: string
  appName?: string
  appIcon?: string
  isRunning: boolean
}

/**
 * State for the intent resolver dialog
 */
interface IntentResolverState {
  /** Whether the resolver dialog is open */
  isOpen: boolean
  /** Unique request ID for correlation */
  requestId: string | null
  /** Intent name being raised */
  intentName: string | null
  /** Context being passed with intent */
  context: unknown
  /** Available handlers to choose from */
  handlers: IntentHandler[]
}

/**
 * Actions for the intent resolver store
 */
interface IntentResolverActions {
  /** Select a handler and resolve the intent */
  selectHandler: (handler: IntentHandler) => void
  /** Cancel the resolution (user closed dialog) */
  cancel: () => void
}

export interface IntentResolverStore extends IntentResolverState, IntentResolverActions {}

/**
 * Create the intent resolver store with WCPConnector integration.
 *
 * This store:
 * 1. Listens for "intentResolverNeeded" events from WCPConnector
 * 2. Opens a dialog showing available handlers
 * 3. Sends user selection back via wcpConnector.resolveIntentSelection()
 *
 * @param sailAgent - The Sail Desktop Agent instance
 * @returns Zustand store for intent resolution
 */
export const createIntentResolverStore = (sailAgent: SailDesktopAgentInstance) => {
  const store = create<IntentResolverStore>()(
    immer((set, get) => ({
      // Initial state
      isOpen: false,
      requestId: null,
      intentName: null,
      context: null,
      handlers: [],

      // Actions
      selectHandler: (handler: IntentHandler) => {
        const { requestId } = get()
        if (!requestId) {
          console.warn("[IntentResolverStore] Cannot select handler: no active request")
          return
        }

        console.log(`[IntentResolverStore] User selected handler: ${handler.appName || handler.appId}`)

        // Send response back to Desktop Agent via WCPConnector
        sailAgent.wcpConnector.resolveIntentSelection({
          requestId,
          selectedHandler: {
            instanceId: handler.instanceId,
            appId: handler.appId,
          },
        })

        // Close dialog
        set(state => {
          state.isOpen = false
          state.requestId = null
          state.intentName = null
          state.context = null
          state.handlers = []
        })
      },

      cancel: () => {
        const { requestId } = get()
        if (!requestId) {
          console.warn("[IntentResolverStore] Cannot cancel: no active request")
          return
        }

        console.log("[IntentResolverStore] User cancelled intent resolution")

        // Send cancellation response to Desktop Agent
        sailAgent.wcpConnector.resolveIntentSelection({
          requestId,
          selectedHandler: null, // null indicates cancellation
        })

        // Close dialog
        set(state => {
          state.isOpen = false
          state.requestId = null
          state.intentName = null
          state.context = null
          state.handlers = []
        })
      },
    }))
  )

  // Wire up WCP connector event listener
  const connector = sailAgent.wcpConnector

  // Handle intent resolution needed event
  // The payload type matches IntentResolverPayload from wcp-connector
  connector.on("intentResolverNeeded", (payload: {
    requestId: string
    intent: string
    context: unknown
    handlers: IntentHandler[]
  }) => {
    console.log("[IntentResolverStore] Intent resolution needed:", payload)
    store.setState(state => {
      state.isOpen = true
      state.requestId = payload.requestId
      state.intentName = payload.intent
      state.context = payload.context
      state.handlers = payload.handlers
    })
  })

  return store
}
