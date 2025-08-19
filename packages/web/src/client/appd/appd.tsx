import { useState, useEffect, useCallback, memo } from "react"
import { DirectoryApp, WebAppDetails } from "@finos/fdc3-web-impl"
import { AppHosting } from "@finos/fdc3-sail-shared"
import { AppMetadata, Image } from "@finos/fdc3"

import { Icon } from "../icon/icon"
import { getAppState, getClientState } from "../../state"
import { Popup, PopupButton } from "../popups/popup"

import styles from "./styles.module.css"

export const DEFAULT_ICON = "/icons/control/choose-app.svg"

export function getIcon(a: DirectoryApp | AppMetadata | undefined): string {
  if (a) {
    const icons = a.icons ?? []
    if (icons.length > 0) {
      return icons[0].src
    }
  }

  return DEFAULT_ICON
}

type AppPanelProps = { closeAction: () => void }

export const AppDPanel = memo(({ closeAction }: AppPanelProps) => {
  const [chosen, setChosen] = useState<DirectoryApp | null>(null)
  const [apps, setApps] = useState<DirectoryApp[]>([])

  useEffect(() => {
    const relevantApps = getClientState()
      .getKnownApps()
      .filter(app => {
        const sail = app.hostManifests?.sail as { [key: string]: boolean }
        return (
          (sail ? sail.searchable !== false : true) &&
          app.type === "web" &&
          (app.details as WebAppDetails).url != null
        )
      })
    setApps(relevantApps)
  }, [])

  const handleAppSelect = useCallback((app: DirectoryApp) => {
    setChosen(app)
  }, [])

  const handleOpenInFrame = useCallback(() => {
    if (chosen) {
      void getAppState().open(chosen, AppHosting.Frame)
      closeAction()
    }
  }, [chosen, closeAction])

  const handleOpenInTab = useCallback(() => {
    if (chosen) {
      void getAppState().open(chosen, AppHosting.Tab)
      closeAction()
    }
  }, [chosen, closeAction])

  return (
    <Popup
      key="AppDPopup"
      title="Start Application"
      area={
        <div className={styles.appDContent}>
          <div className={styles.appDApps}>
            {apps.map(a => (
              <div
                key={a.appId}
                className={`${styles.appDApp} ${a === chosen ? styles.selected : ""}`}
                onClick={() => handleAppSelect(a)}
              >
                <Icon image={getIcon(a)} text={a.title} dark={false} />
              </div>
            ))}
          </div>

          <div className={styles.appDDetail}>
            {chosen ? (
              <div className={styles.appDInfo}>
                <h2>{chosen.title}</h2>
                <p>{chosen.description}</p>
                <ul>
                  {chosen.categories?.map((c: string) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className={styles.appDScreenshots}>
                  {chosen.screenshots?.map((s: Image) => (
                    <img key={s.src} src={s.src} title={s.label} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      }
      buttons={[
        <PopupButton
          key="open-frame"
          text="Open Here"
          disabled={chosen === null}
          onClick={handleOpenInFrame}
        />,
        <PopupButton
          key="open-tab"
          text="Open In Tab"
          disabled={chosen === null}
          onClick={handleOpenInTab}
        />,
      ]}
      closeAction={closeAction}
      closeName="Cancel"
    />
  )
})

AppDPanel.displayName = "AppDPanel"
