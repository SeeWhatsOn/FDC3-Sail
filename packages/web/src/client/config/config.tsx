import { useState, memo } from "react"

import { Popup } from "../popups/popup"

import styles from "./styles.module.css"
import { DirectoryList } from "./directories"
import { TabList } from "./tabs"
import { CustomAppList } from "./customApps"

const CONFIG_ITEMS = ["Directories", "Tabs", "Custom Apps"]

type AppPanelProps = {
  closeAction: () => void
}

export const ConfigPanel = memo(({ closeAction }: AppPanelProps) => {
  const [item, setItem] = useState<string>(CONFIG_ITEMS[0])

  return (
    <Popup
      key="AppDConfigPopup"
      title="Sail Configuration"
      area={
        <div className={styles.configContent}>
          <div className={styles.configChoiceLeft}>
            {CONFIG_ITEMS.map(a => (
              <div
                key={a}
                className={`${styles.configItem} ${a === item ? styles.selected : ""}`}
                onClick={() => setItem(a)}
              >
                {a}
              </div>
            ))}
          </div>

          <div className={styles.configChoice}>
            {item === CONFIG_ITEMS[0] ? <DirectoryList /> : null}
            {item === CONFIG_ITEMS[1] ? <TabList /> : null}
            {item === CONFIG_ITEMS[2] ? <CustomAppList /> : null}
          </div>
        </div>
      }
      buttons={[]}
      closeAction={closeAction}
      closeName="Done"
    />
  )
})

ConfigPanel.displayName = "ConfigPanel"
