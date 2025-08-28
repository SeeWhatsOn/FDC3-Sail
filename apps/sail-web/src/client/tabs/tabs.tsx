import { TabDetail } from "@finos/fdc3-sail-shared"
import { memo, useCallback } from "react"

import { Icon } from "../icon/icon"
import { useClientStore } from "../../stores/useClientStore"

import styles from "./styles.module.css"

const Tab = memo(({ td, active, onClick }: { td: TabDetail; active: boolean; onClick: () => void }) => {
  return (
    <div
      id={td.id}
      onClick={onClick}
      className={`${styles.tab} ${active ? styles.activeTab : styles.inactiveTab} drop-tab`}
      style={{
        backgroundColor: td.background,
        zIndex: active ? 100 : "none",
      }}
    >
      <Icon text={td.id} image={td.icon} dark={true} />
    </div>
  )
})

Tab.displayName = "Tab"

export const Tabs = memo(() => {
  const { tabs, activeTabId, setActiveTabId } = useClientStore()

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId)
  }, [setActiveTabId])

  return (
    <div className={styles.tabs}>
      {tabs.map(t => (
        <Tab
          key={t.id}
          td={t}
          active={t.id === activeTabId}
          onClick={() => handleTabClick(t.id)}
        />
      ))}
    </div>
  )
})

Tabs.displayName = "Tabs"
