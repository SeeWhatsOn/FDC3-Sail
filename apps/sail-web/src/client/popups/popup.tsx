import { useEffect, ReactNode, memo, useCallback } from "react"

import { Logo } from "../top/top"

import styles from "./styles.module.css"

type PopupProps = {
  buttons: ReactNode[]
  area: ReactNode
  closeAction: () => void
  title: string
  closeName: string
}

export const Popup = memo(({ buttons, area, closeAction, title, closeName }: PopupProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      document.getElementById("backdrop")?.setAttribute("data-loaded", "true")
    }, 10)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div>
      <div id="backdrop" className={styles.popup}>
        <div id="popup" className={styles.popupInner}>
          <div className={styles.popupTitle}>
            <p className={styles.popupTitleText}>{title}</p>
            <Logo />
          </div>
          <div className={styles.popupArea}>{area}</div>
          <div className={styles.popupButtons}>
            {buttons}
            <PopupButton key="cancel" onClick={closeAction} text={closeName} disabled={false} />
          </div>
        </div>
      </div>
    </div>
  )
})

Popup.displayName = "Popup"

export const PopupButton = memo(
  ({ text, onClick, disabled }: { text: string; onClick: () => void; disabled: boolean }) => {
    const handleClick = useCallback(() => {
      onClick()
    }, [onClick])

    return (
      <button id="cancel" className={styles.popupButton} onClick={handleClick} disabled={disabled}>
        {text}
      </button>
    )
  }
)

PopupButton.displayName = "PopupButton"
