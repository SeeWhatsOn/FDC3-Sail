import { useState, useCallback, useMemo, memo } from "react"

import { useClientStore } from "../../stores/useClientStore"
import { useServerStore } from "../../stores/useServerStore"
import { Tabs } from "../tabs/tabs"
import { ContextHistory, Logo, Settings } from "../top/top"
import { Bin, Controls, NewPanel } from "../controls/controls"
import { AppDPanel } from "../appd/appd"
import { Content, Grids } from "../grid/grid"
import { GridsStateImpl } from "../grid/gridstate"
import { ConfigPanel } from "../config/config"
import { ResolverPanel } from "../resolver/resolver"
import { ContextHistoryPanel } from "../context/ContextHistory"

import styles from "./styles.module.css"

enum Popup {
  NONE = "none",
  APPD = "appd",
  SETTINGS = "settings",
  RESOLVER = "resolver",
  CONTEXT_HISTORY = "context_history",
}

const CONTAINER_ID = "container-id"

export const Frame = memo(() => {
  // Modern state management with Zustand
  const { getActiveTab, tabs, getContextHistory, getIntentResolution, setIntentResolution } =
    useClientStore()

  const { intentChosen } = useServerStore()

  // Local popup state
  const [popup, setPopup] = useState<Popup>(Popup.NONE)

  // Get current active tab
  const activeTab = getActiveTab()

  // Close popup handler
  const closePopup = useCallback(() => setPopup(Popup.NONE), [])

  // Intent resolution data
  const intentResolution = getIntentResolution()

  // Context history for active tab
  const contextHistory = getContextHistory(activeTab.id)

  // Create GridsState instance (memoized to prevent recreation)
  // Note: This will be cleaned up when Grid component is migrated
  const gridsState = useMemo(() => {
    return new GridsStateImpl(
      CONTAINER_ID,
      (ap, id) => (
        <Content
          panel={ap}
          cs={useClientStore.getState() as unknown as import("../../types").WebClientState}
          as={{} as import("../../types").AppState} // Will be removed when Grid is migrated
          id={id}
        />
      ),
      useClientStore.getState() as unknown as import("../../types").WebClientState // Legacy adapter - will be removed
    )
  }, []) // Empty deps - only create once

  // Popup handlers
  const showAppD = useCallback(() => setPopup(Popup.APPD), [])
  const showSettings = useCallback(() => setPopup(Popup.SETTINGS), [])
  const showContextHistory = useCallback(() => setPopup(Popup.CONTEXT_HISTORY), [])

  // Intent resolution handlers
  const closeIntentResolution = useCallback(() => {
    setIntentResolution(null)
  }, [setIntentResolution])

  const handleIntentChoice = useCallback(
    (
      chosenApp: import("@finos/fdc3").AppIdentifier | null,
      chosenIntent: string | null,
      chosenChannel: string | null
    ) => {
      if (intentResolution && chosenApp && chosenIntent && chosenChannel) {
        intentChosen(intentResolution.requestId, chosenApp.appId, chosenIntent, chosenChannel)
      }
    },
    [intentResolution, intentChosen]
  )

  return (
    <div className={styles.outer} data-testid="frame-modern">
      {/* Top bar */}
      <div className={styles.top} data-testid="frame-top">
        <Logo />
        <ContextHistory onClick={showContextHistory} contextHistory={contextHistory} />
        <Settings onClick={showSettings} />
      </div>

      {/* Left sidebar */}
      <div className={styles.left} data-testid="frame-left">
        <Tabs />
        <Controls>
          <NewPanel onClick={showAppD} />
          <Bin />
        </Controls>
      </div>

      {/* Main content area */}
      <div
        className={styles.main}
        data-testid="frame-main"
        style={{ border: `1px solid ${activeTab.background}` }}
      >
        <Grids
          cs={useClientStore.getState() as unknown as import("../../types").WebClientState}
          gs={gridsState}
          as={{} as import("../../types").AppState}
          id={CONTAINER_ID}
        />
      </div>

      {/* Popup modals */}
      {popup === Popup.APPD && <AppDPanel key="appd" closeAction={closePopup} />}

      {popup === Popup.SETTINGS && (
        <ConfigPanel
          key="config"
          closeAction={closePopup}
        />
      )}

      {popup === Popup.CONTEXT_HISTORY && (
        <ContextHistoryPanel
          key="context-history"
          history={contextHistory}
          currentChannel={activeTab.id}
          closeAction={closePopup}
        />
      )}

      {/* Intent Resolution Modal */}
      {intentResolution && (
        <ResolverPanel
          key="resolver"
          appIntents={intentResolution.appIntents}
          context={intentResolution.context}
          currentChannel={activeTab.id}
          channelDetails={tabs}
          closeAction={closeIntentResolution}
          chooseAction={handleIntentChoice}
        />
      )}
    </div>
  )
})

Frame.displayName = "Frame"
