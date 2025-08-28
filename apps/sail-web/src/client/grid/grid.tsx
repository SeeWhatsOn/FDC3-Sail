import { useEffect, useRef, memo, useCallback } from "react"
import { State } from "@finos/fdc3-web-impl"

import { AppState, ClientState, AppPanel } from "../../types"
import { getAppState } from "../../state"
import { useClientStore } from "../../stores/useClientStore"

import styles from "./styles.module.css"
import "gridstack/dist/gridstack.css"
import { GridsState } from "./gridstate"

//import { AppHosting } from "@finos/fdc3-sail-shared"

type GridsProps = { cs: ClientState; gs: GridsState; as: AppState; id: string }

export const Grids = ({ cs, gs, id }: GridsProps) => {
  const hasUpdated = useRef(false)

  useEffect(() => {
    // Update panels on mount and whenever dependencies change
    gs.updatePanels()
    hasUpdated.current = true
  }, [gs])

  useEffect(() => {
    // Update panels on subsequent renders (like componentDidUpdate)
    if (hasUpdated.current) {
      gs.updatePanels()
    }
  })

  return (
    <div className={styles.grids} id={id}>
      {cs.getPanels().map(p => (
        <AppFrame key={p.panelId} panel={p} />
      ))}
    </div>
  )
}

const AppFrame = memo(({ panel }: { panel: AppPanel }) => {
  const handleRef = useCallback(
    (ref: HTMLIFrameElement | null) => {
      if (ref) {
        setTimeout(() => {
          // this is a bit hacky but we need to track the window objects
          // in the app state so we make sure we know who we're talking to
          const contentWindow = ref.contentWindow
          if (contentWindow) {
            getAppState().registerAppWindow(contentWindow, panel.panelId)
          }
        }, 10)
      }
    },
    [panel.panelId]
  )

  return (
    <iframe
      src={panel.url}
      id={"iframe_" + panel.panelId}
      name={panel.panelId}
      slot={"slot_" + panel.panelId}
      className={styles.iframe}
      ref={handleRef}
    />
  )
})

AppFrame.displayName = "AppFrame"

const AppStateIcon = ({ instanceId, as }: { instanceId: string; as: AppState }) => {
  const D = "/icons/app-state/"

  function symbolForState(s: State | undefined): string[] {
    if (s == undefined) {
      return [D + "unknown.svg", "Unknown"]
    } else {
      switch (s) {
        case State.NotResponding:
          return [D + "not-responding.svg", "Not Responding"]
        case State.Connected:
          return [D + "connected.svg", "Connected to FDC3"]
        case State.Pending:
          return [D + "pending.svg", "Pending"]
        case State.Terminated:
          return [D + "terminated.svg", "Terminated"]
      }
    }
  }

  const state = symbolForState(as.getAppState(instanceId))

  return <img src={state[0]} className={styles.contentTitleIcon} title={state[1]} />
}

const CloseIcon = memo(({ action }: { action: () => void }) => {
  const handleClick = useCallback(() => {
    action()
  }, [action])

  return (
    <img
      src="/icons/control/close.svg"
      className={styles.contentTitleIcon}
      title="Close"
      onClick={handleClick}
    />
  )
})

CloseIcon.displayName = "CloseIcon"

const AppSlot = memo(({ panel }: { panel: AppPanel }) => {
  return (
    <div id={"app_" + panel.panelId}>
      <slot name={"slot_" + panel.panelId} />
    </div>
  )
})

AppSlot.displayName = "AppSlot"

export const Content = memo(
  ({
    panel,
    as,
    id,
  }: {
    panel: AppPanel
    cs?: ClientState // Optional for backward compatibility
    as: AppState
    id: string
  }) => {
    const { getActiveTab, removePanel } = useClientStore()
    const activeTab = getActiveTab()

    const handleClose = useCallback(() => {
      removePanel(panel.panelId)
    }, [removePanel, panel.panelId])

    return (
      <div className={styles.content} id={id}>
        <div
          className={styles.contentInner}
          style={{ border: `1px solid ${activeTab.background}` }}
        >
          <div className={styles.contentTitle} style={{ backgroundColor: activeTab.background }}>
            <CloseIcon action={handleClose} />
            <p className={styles.contentTitleText}>
              <span className={styles.contentTitleTextSpan}>{panel.title}</span>
            </p>
            <AppStateIcon instanceId={panel.panelId} as={as} />
          </div>
          <div className={styles.resizeBaffle} />
          <div className={styles.contentBody}>
            {panel.url ? <AppSlot panel={panel} /> : <div />}
          </div>
        </div>
      </div>
    )
  }
)

Content.displayName = "Content"
