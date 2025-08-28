import { useState, memo, useMemo, useCallback } from "react"
import { prettyPrintJson } from "pretty-print-json"
import { Context } from "@finos/fdc3-context"

import { Popup } from "../popups/popup"

import styles from "./styles.module.css"

type ContextHistoryPanelProps = {
  history: Context[]
  currentChannel: string
  closeAction: () => void
}

export const ContextHistoryItem = memo(
  ({
    context,
    selected,
    onClick,
  }: {
    context: Context
    selected: boolean
    onClick: () => void
  }) => {
    return (
      <div className={`${styles.contextItem} ${selected ? styles.selected : ""}`} onClick={onClick}>
        <div className={styles.contextType}>{context.type}</div>
        <div className={styles.contextData}>{context.name ?? "No Name"}</div>
      </div>
    )
  }
)

ContextHistoryItem.displayName = "ContextHistoryItem"

export const ContextHistoryPanel = memo(
  ({ history, currentChannel, closeAction }: ContextHistoryPanelProps) => {
    const [chosen, setChosen] = useState<number>(0)

    const json = useMemo(() => {
      if (history[chosen]) {
        return prettyPrintJson.toHtml(history[chosen], {
          indent: 2,
          linkUrls: false,
          trailingCommas: false,
          quoteKeys: true,
        })
      }
      return ""
    }, [history, chosen])

    const handleItemClick = useCallback((index: number) => {
      setChosen(index)
    }, [])

    return (
      <Popup
        key="ContextHistoryPopup"
        title={`Context History On "${currentChannel}"`}
        area={
          <div className={styles.contextContent}>
            <div className={styles.contextArea}>
              {history.map((h, i) => (
                <ContextHistoryItem
                  key={i}
                  context={h}
                  onClick={() => handleItemClick(i)}
                  selected={i === chosen}
                />
              ))}
            </div>
            <div className={styles.contextDetail}>
              <div dangerouslySetInnerHTML={{ __html: json }} />
            </div>
          </div>
        }
        buttons={[]}
        closeAction={closeAction}
        closeName="Close"
      />
    )
  }
)

ContextHistoryPanel.displayName = "ContextHistoryPanel"
